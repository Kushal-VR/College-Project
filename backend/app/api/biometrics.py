import json
import cv2
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.logging import logger
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.academic import Student
from app.models.biometrics import StudentFaceEmbedding, SecurityAuditLog, SecurityEventType
from app.schemas.biometrics import (
    FaceEnrollRequest,
    FaceEnrollResponse,
    FaceRecognizeRequest,
    FaceRecognizeResponse,
    RecognizedStudentItem,
    DetectedFaceItem,
    IDCardScanRequest,
    IDCardScanResponse,
    SecurityAuditResponse
)
from app.services.biometric_service import (
    decode_base64_image,
    detect_faces,
    extract_face_embedding,
    compute_cosine_similarity,
    check_anti_spoofing,
    detect_and_decode_id_card
)

router = APIRouter(prefix="/biometrics", tags=["Biometric Face Training & Anti-Spoofing"])

@router.post("/enroll", response_model=FaceEnrollResponse)
def enroll_student_face(
    req: FaceEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Capture/upload photo to enroll student facial biometric:
    1. Decodes image and detects face bounding box.
    2. Runs anti-spoofing validation (blocks paper prints and phone screen replays).
    3. Extracts normalized 128-dimensional embedding.
    4. Saves embedding to database and updates student enrollment status.
    """
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    image = decode_base64_image(req.image_base64)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid base64 image data")

    faces = detect_faces(image)
    if not faces:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the image. Please ensure proper lighting and face the camera directly."
        )

    # Use the primary/largest face in the frame
    faces.sort(key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]
    face_crop = image[y:y+h, x:x+w]

    # Anti-spoofing check
    is_spoof, liveness_score, details = check_anti_spoofing(face_crop)
    if is_spoof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Biometric Anti-Spoofing Validation Failed: {details}. Please present a live person."
        )

    # Extract 128-d embedding
    embedding = extract_face_embedding(face_crop)

    # Save to database
    face_emb = StudentFaceEmbedding(
        student_id=student.id,
        embedding=json.dumps(embedding),
        quality_score=round(float(min(1.0, (w * h) / (120.0 * 120.0))), 2),
        liveness_score=liveness_score,
        is_primary=True
    )
    db.add(face_emb)

    # Update Student record
    student.biometric_enrolled = True
    student.biometric_face_count += 1
    db.commit()
    db.refresh(face_emb)

    return FaceEnrollResponse(
        success=True,
        student_id=student.id,
        student_name=student.user.full_name,
        roll_number=student.student_id,
        quality_score=face_emb.quality_score,
        liveness_score=face_emb.liveness_score,
        total_faces_enrolled=student.biometric_face_count,
        message="Student facial biometrics successfully trained and committed to database."
    )

@router.get("/student/{student_id}")
def get_student_biometrics(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve enrolled face biometric metadata for a student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    embeddings = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == student_id).all()
    return {
        "student_id": student.id,
        "roll_number": student.student_id,
        "full_name": student.user.full_name,
        "biometric_enrolled": student.biometric_enrolled,
        "face_count": len(embeddings),
        "embeddings": [
            {
                "id": emb.id,
                "quality_score": emb.quality_score,
                "liveness_score": emb.liveness_score,
                "created_at": emb.created_at
            }
            for emb in embeddings
        ]
    }

@router.delete("/{face_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_face_embedding(
    face_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a face embedding record."""
    emb = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.id == face_id).first()
    if not emb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face record not found")
    student = db.query(Student).filter(Student.id == emb.student_id).first()
    db.delete(emb)
    if student:
        student.biometric_face_count = max(0, student.biometric_face_count - 1)
        if student.biometric_face_count == 0:
            student.biometric_enrolled = False
    db.commit()
    return None

@router.post("/recognize", response_model=FaceRecognizeResponse)
def recognize_face_frame(
    req: FaceRecognizeRequest,
    db: Session = Depends(get_db)
):
    """Test facial recognition on a frame against all enrolled student embeddings."""
    image = decode_base64_image(req.image_base64)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image")

    effective_session_id = req.session_id
    if not effective_session_id and req.timetable_id:
        try:
            from app.models.timetable import ClassSession, SessionStatus
            target_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            sess = db.query(ClassSession).filter(
                ClassSession.timetable_id == req.timetable_id,
                ClassSession.date == target_date
            ).first()
            if not sess:
                sess = ClassSession(
                    timetable_id=req.timetable_id,
                    date=target_date,
                    status=SessionStatus.IN_PROGRESS.value,
                    started_at=datetime.now(timezone.utc)
                )
                db.add(sess)
                db.commit()
                db.refresh(sess)
            effective_session_id = sess.id
        except Exception as sess_err:
            logger.debug(f"Auto session resolution note: {sess_err}")

    recognized = []
    spoofs = []

    # 1. Check for Student ID Barcode / QR Code in camera frame
    barcode_found, code_data, code_type = detect_and_decode_id_card(image)
    scanned_barcode = None

    if barcode_found and code_data:
        clean_code = code_data.strip().upper()
        # Look up student by student_id or email
        bc_student = db.query(Student).filter(
            (Student.student_id == clean_code) | (Student.student_id.ilike(f"%{clean_code}%"))
        ).first()

        if bc_student:
            scanned_barcode = IDCardScanResponse(
                success=True,
                barcode_data=clean_code,
                student_id=bc_student.id,
                student_name=bc_student.user.full_name,
                roll_number=bc_student.student_id,
                message=f"ID Card {code_type} verified for {bc_student.user.full_name} ({bc_student.student_id})"
            )
            # If session_id provided, mark attendance
            if req.session_id:
                try:
                    from app.models.timetable import AttendanceRecord, AttendanceStatus, VerificationMethod
                    existing = db.query(AttendanceRecord).filter(
                        AttendanceRecord.session_id == req.session_id,
                        AttendanceRecord.student_id == bc_student.id
                    ).first()
                    if existing:
                        existing.status = AttendanceStatus.PRESENT
                        existing.verification_method = VerificationMethod.BARCODE_FALLBACK
                    else:
                        new_att = AttendanceRecord(
                            session_id=req.session_id,
                            student_id=bc_student.id,
                            status=AttendanceStatus.PRESENT,
                            verification_method=VerificationMethod.BARCODE_FALLBACK,
                            confidence_score=1.0,
                            in_duration_seconds=3600
                        )
                        db.add(new_att)
                    db.commit()
                except Exception as att_err:
                    logger.debug(f"Barcode auto-attendance update: {att_err}")

            recognized.append(
                RecognizedStudentItem(
                    student_id=bc_student.id,
                    roll_number=bc_student.student_id,
                    full_name=bc_student.user.full_name,
                    confidence=1.0,
                    bounding_box=[20, 20, 160, 80],
                    liveness_score=1.0,
                    spoof_detected=False,
                    verification_method="BARCODE_FALLBACK"
                )
            )

    all_detected_faces = []

    # 2. Check for faces in camera frame
    faces = detect_faces(image)
    if faces:
        all_embeddings = db.query(StudentFaceEmbedding).all()
        student_map = {s.id: s for s in db.query(Student).all()}

        for (x, y, w, h) in faces:
            face_crop = image[y:y+h, x:x+w]
            is_spoof, liveness, details = check_anti_spoofing(face_crop)
            if is_spoof:
                spoofs.append(details)

            emb = extract_face_embedding(face_crop)
            best_student = None
            best_sim = 0.0

            for stored in all_embeddings:
                try:
                    stored_vec = json.loads(stored.embedding)
                    sim = compute_cosine_similarity(emb, stored_vec)
                    if sim > best_sim:
                        best_sim = sim
                        best_student = student_map.get(stored.student_id)
                except Exception:
                    pass

            is_matched = bool(best_student and best_sim >= 0.58)
            if is_matched:
                # Automatic attendance recording when session or timetable is active
                if effective_session_id and not is_spoof:
                    try:
                        from app.models.timetable import AttendanceRecord, AttendanceStatus, VerificationMethod
                        existing = db.query(AttendanceRecord).filter(
                            AttendanceRecord.session_id == effective_session_id,
                            AttendanceRecord.student_id == best_student.id
                        ).first()
                        now = datetime.now(timezone.utc)
                        if existing:
                            existing.status = AttendanceStatus.PRESENT.value
                            existing.verification_method = VerificationMethod.FACE_RECOGNITION.value
                            existing.confidence_score = float(best_sim)
                            existing.in_time = existing.in_time or now
                            existing.total_minutes_present = max(existing.total_minutes_present, 60.0)
                            existing.presence_ratio = 1.0
                        else:
                            new_att = AttendanceRecord(
                                session_id=effective_session_id,
                                student_id=best_student.id,
                                date=now.strftime("%Y-%m-%d"),
                                status=AttendanceStatus.PRESENT.value,
                                verification_method=VerificationMethod.FACE_RECOGNITION.value,
                                confidence_score=float(best_sim),
                                in_time=now,
                                total_minutes_present=60.0,
                                presence_ratio=1.0
                            )
                            db.add(new_att)
                        db.commit()
                    except Exception as att_err:
                        logger.debug(f"Face auto-attendance update error: {att_err}")

                # Avoid duplicate if already added by barcode
                if not any(r.student_id == best_student.id for r in recognized):
                    recognized.append(
                        RecognizedStudentItem(
                            student_id=best_student.id,
                            roll_number=best_student.student_id,
                            full_name=best_student.user.full_name,
                            confidence=round(best_sim, 2),
                            bounding_box=[int(x), int(y), int(w), int(h)],
                            liveness_score=liveness,
                            spoof_detected=is_spoof,
                            verification_method="FACE_RECOGNITION"
                        )
                    )
                all_detected_faces.append(
                    DetectedFaceItem(
                        bounding_box=[int(x), int(y), int(w), int(h)],
                        is_recognized=True,
                        student_id=best_student.id,
                        roll_number=best_student.student_id,
                        full_name=best_student.user.full_name,
                        confidence=round(best_sim, 2),
                        liveness_score=liveness,
                        spoof_detected=is_spoof,
                        verification_method="FACE_RECOGNITION"
                    )
                )
            else:
                all_detected_faces.append(
                    DetectedFaceItem(
                        bounding_box=[int(x), int(y), int(w), int(h)],
                        is_recognized=False,
                        student_id=None,
                        roll_number=None,
                        full_name=None,
                        confidence=round(best_sim, 2) if best_student else 0.0,
                        liveness_score=liveness,
                        spoof_detected=is_spoof,
                        verification_method="FACE_DETECTION"
                    )
                )

    return FaceRecognizeResponse(
        matched=len(recognized) > 0,
        faces_detected=len(faces),
        recognized_students=recognized,
        all_detected_faces=all_detected_faces,
        spoof_alerts=spoofs,
        scanned_barcode=scanned_barcode
    )

@router.post("/scan-id-card", response_model=IDCardScanResponse)
def scan_id_card_barcode(
    req: IDCardScanRequest,
    db: Session = Depends(get_db)
):
    """
    ID Card Barcode / QR Code Fallback Scanner:
    Scans camera frame for barcode/QR code or matches direct barcode string.
    Finds the matching student by roll number (`student_id`).
    """
    barcode_val = ""
    if req.barcode_data and len(req.barcode_data.strip()) > 0:
        barcode_val = req.barcode_data.strip()
    elif req.image_base64:
        image = decode_base64_image(req.image_base64)
        if image is not None:
            ok, decoded, _ = detect_and_decode_id_card(image)
            if ok:
                barcode_val = decoded

    if not barcode_val:
        return IDCardScanResponse(
            success=False,
            barcode_data="",
            message="No barcode or QR code detected. Please align the Student ID Card clearly in frame."
        )

    # Match in database by student_id / roll number
    student = db.query(Student).filter(Student.student_id == barcode_val).first()
    if not student:
        # Check if roll number without dashes/spaces matches
        student = db.query(Student).filter(Student.student_id.ilike(f"%{barcode_val}%")).first()

    if not student:
        return IDCardScanResponse(
            success=False,
            barcode_data=barcode_val,
            message=f"ID Card read ({barcode_val}) but no registered student found with this roll number."
        )

    # Log security audit entry for barcode fallback
    audit = SecurityAuditLog(
        event_type=SecurityEventType.BARCODE_FALLBACK_USED.value,
        student_id=student.id,
        details=f"Attendance marked via Student ID Card Barcode Fallback ({barcode_val})",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    db.commit()

    return IDCardScanResponse(
        success=True,
        barcode_data=barcode_val,
        student_id=student.id,
        student_name=student.user.full_name,
        roll_number=student.student_id,
        message=f"Successfully verified Student ID Card for {student.user.full_name} ({student.student_id})"
    )

@router.get("/security-logs", response_model=List[SecurityAuditResponse])
def get_security_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve security audit logs (spoofs, covered face departures, barcode usage)."""
    logs = db.query(SecurityAuditLog).order_by(SecurityAuditLog.timestamp.desc()).limit(100).all()
    return logs

@router.get("/demo-kushal-photo")
def get_demo_kushal_photo():
    """Returns base64 data URI of Kushal VR's test photo for instant offline/locked webcam testing."""
    import os, glob, base64
    candidate_paths = [
        "My photo for test/image.png",
        "../My photo for test/image.png",
        "My photo for test/image copy 3.png",
        "../My photo for test/image copy 3.png",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            with open(p, "rb") as f:
                b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
                return {"image_base64": b64, "filename": os.path.basename(p), "student_name": "Kushal VR", "roll_number": "1EW23CS065"}
    return {"image_base64": "", "filename": "", "student_name": "Kushal VR", "roll_number": "1EW23CS065"}

