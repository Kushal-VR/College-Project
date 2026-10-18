from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, date

from app.core.database import get_db
from app.api.deps import get_current_user, require_faculty_or_admin, require_admin
from app.models.user import User, UserRole
from app.models.academic import Student, Faculty, Subject, Enrollment
from app.models.cctv import Camera
from app.models.timetable import Timetable, ClassSession, AttendanceRecord, AttendanceStatus, SessionStatus, VerificationMethod
from app.models.biometrics import SecurityAuditLog, SecurityEventType, StudentFaceEmbedding
from app.schemas.timetable import (
    TimetableCreate,
    TimetableResponse,
    ClassSessionResponse,
    AttendanceRecordItem,
    ProcessFrameRequest,
    ProcessFrameResponse,
    TeacherDashboardStats,
    StudentCumulativeStats,
    DayByDaySessionRecord,
    TakePeriodAttendanceRequest,
    TakePeriodAttendanceResponse,
    ClassTeacherDailyLedgerResponse,
    StudentPeriodAttendance,
    StudentSubjectMatrixItem,
    StudentSubjectAttendanceDetail,
)
from app.services.biometric_service import (
    decode_base64_image,
    detect_and_decode_id_card,
    detect_faces,
    detect_faces_detailed,
    extract_face_embedding,
    check_anti_spoofing,
    compute_cosine_similarity,
    calculate_match_confidence,
    SFACE_MATCH_THRESHOLD,
)
from app.services.presence_engine import presence_engine
from app.services.email_service import send_class_attendance_report, send_occluded_exit_security_alert
import json

router = APIRouter(prefix="/timetable", tags=["Timetable, Sessions & Attendance Ledger"])

@router.get("", response_model=List[TimetableResponse])
def list_timetable(
    faculty_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    day_of_week: Optional[str] = None,
    classroom: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List timetable slots with optional filters."""
    query = db.query(Timetable)
    
    # If logged in as faculty, default filter to their own classes if not admin
    if current_user.role == UserRole.FACULTY and not faculty_id:
        faculty = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
        if faculty:
            query = query.filter(Timetable.faculty_id == faculty.id)

    if faculty_id:
        query = query.filter(Timetable.faculty_id == faculty_id)
    if subject_id:
        query = query.filter(Timetable.subject_id == subject_id)
    if day_of_week:
        query = query.filter(Timetable.day_of_week.ilike(day_of_week))
    if classroom:
        query = query.filter(Timetable.classroom.ilike(classroom))

    slots = query.order_by(Timetable.day_of_week.asc(), Timetable.start_time.asc()).all()
    
    results = []
    for s in slots:
        results.append(
            TimetableResponse(
                id=s.id,
                subject_id=s.subject_id,
                faculty_id=s.faculty_id,
                camera_id=s.camera_id,
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                classroom=s.classroom,
                section=s.section,
                batch_year=s.batch_year,
                is_recurring=s.is_recurring,
                single_date=s.single_date,
                is_active=s.is_active,
                created_at=s.created_at,
                subject_name=s.subject.name if s.subject else None,
                subject_code=s.subject.code if s.subject else None,
                faculty_name=s.faculty.user.full_name if s.faculty and s.faculty.user else None,
                faculty_email=s.faculty.user.email if s.faculty and s.faculty.user else None,
                camera_name=s.camera.name if s.camera else None
            )
        )
    return results

@router.post("", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def create_timetable_slot(
    slot_in: TimetableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a timetable slot / single class period:
    e.g. 13:00 to 14:00 with assigned Subject, Faculty, Classroom, and Camera.
    """
    subject = db.query(Subject).filter(Subject.id == slot_in.subject_id).first()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    faculty = db.query(Faculty).filter(Faculty.id == slot_in.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty not found")

    if slot_in.camera_id:
        cam = db.query(Camera).filter(Camera.id == slot_in.camera_id).first()
        if not cam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    slot = Timetable(
        subject_id=slot_in.subject_id,
        faculty_id=slot_in.faculty_id,
        camera_id=slot_in.camera_id,
        day_of_week=slot_in.day_of_week,
        start_time=slot_in.start_time,
        end_time=slot_in.end_time,
        classroom=slot_in.classroom,
        section=slot_in.section,
        batch_year=slot_in.batch_year,
        is_recurring=slot_in.is_recurring,
        single_date=slot_in.single_date,
        is_active=True
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    return TimetableResponse(
        id=slot.id,
        subject_id=slot.subject_id,
        faculty_id=slot.faculty_id,
        camera_id=slot.camera_id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        classroom=slot.classroom,
        section=slot.section,
        batch_year=slot.batch_year,
        is_recurring=slot.is_recurring,
        single_date=slot.single_date,
        is_active=slot.is_active,
        created_at=slot.created_at,
        subject_name=slot.subject.name if slot.subject else None,
        subject_code=slot.subject.code if slot.subject else None,
        faculty_name=slot.faculty.user.full_name if slot.faculty and slot.faculty.user else None,
        faculty_email=slot.faculty.user.email if slot.faculty and slot.faculty.user else None,
        camera_name=slot.camera.name if slot.camera else None
    )

@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove a timetable slot."""
    slot = db.query(Timetable).filter(Timetable.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
    db.delete(slot)
    db.commit()
    return None

@router.post("/sessions/start", response_model=ClassSessionResponse)
def start_or_get_class_session(
    timetable_id: int,
    session_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start or retrieve an active class session for a timetable slot."""
    timetable = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not timetable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable slot not found")

    target_date = session_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Find existing session
    session = (
        db.query(ClassSession)
        .filter(ClassSession.timetable_id == timetable_id, ClassSession.date == target_date)
        .first()
    )
    if not session:
        session = ClassSession(
            timetable_id=timetable_id,
            date=target_date,
            status=SessionStatus.IN_PROGRESS.value,
            started_at=datetime.now(timezone.utc)
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Initialize roster records for enrolled students if not already present
    enrolled_students = (
        db.query(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .filter(Enrollment.subject_id == timetable.subject_id)
        .all()
    )
    for st in enrolled_students:
        rec = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == st.id)
            .first()
        )
        if not rec:
            rec = AttendanceRecord(
                session_id=session.id,
                student_id=st.id,
                date=session.date,
                status=AttendanceStatus.ABSENT.value
            )
            db.add(rec)
    db.commit()

    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    present_cnt = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    left_early_cnt = sum(1 for r in records if r.status == AttendanceStatus.LEFT_EARLY.value)
    absent_cnt = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)

    return ClassSessionResponse(
        id=session.id,
        timetable_id=session.timetable_id,
        date=session.date,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        email_report_sent=session.email_report_sent,
        subject_name=timetable.subject.name if timetable.subject else None,
        subject_code=timetable.subject.code if timetable.subject else None,
        faculty_name=timetable.faculty.user.full_name if timetable.faculty and timetable.faculty.user else None,
        faculty_email=timetable.faculty.user.email if timetable.faculty and timetable.faculty.user else None,
        classroom=timetable.classroom,
        total_enrolled=len(records),
        present_count=present_cnt,
        absent_count=absent_cnt,
        left_early_count=left_early_cnt
    )

@router.get("/sessions/{session_id}/ledger", response_model=List[AttendanceRecordItem])
def get_session_ledger(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full live attendance roster for a session."""
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    results = []
    for r in records:
        results.append(
            AttendanceRecordItem(
                id=r.id,
                student_id=r.student_id,
                roll_number=r.student.student_id if r.student else "N/A",
                student_name=r.student.user.full_name if r.student and r.student.user else "Unknown",
                in_time=r.in_time,
                out_time=r.out_time,
                total_minutes_present=r.total_minutes_present,
                presence_ratio=r.presence_ratio,
                status=r.status,
                verification_method=r.verification_method,
                photo_proof_url=r.photo_proof_url,
                email_notified=r.email_notified,
                remarks=r.remarks
            )
        )
    return results

@router.post("/sessions/{session_id}/process-frame", response_model=ProcessFrameResponse)
def process_live_frame(
    session_id: int,
    req: ProcessFrameRequest,
    db: Session = Depends(get_db)
):
    """Ingest camera frame into live session presence engine."""
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    camera = None
    if req.camera_id:
        camera = db.query(Camera).filter(Camera.id == req.camera_id).first()
    if not camera and session.timetable.camera_id:
        camera = db.query(Camera).filter(Camera.id == session.timetable.camera_id).first()
    if not camera:
        camera = db.query(Camera).first()
        if not camera:
            camera = Camera(
                name="Default Live CCTV",
                stream_url="0",
                classroom=session.timetable.classroom,
                crossing_direction="LEFT_TO_RIGHT_ENTRY"
            )

    frame = decode_base64_image(req.image_base64)
    if frame is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid frame image")

    result = presence_engine.process_frame(db, session_id, camera, frame)

    # If any covered face departure was flagged, check if teacher email alert should fire
    for ev in result.get("events", []):
        if ev.get("type") == SecurityEventType.OCCLUDED_EXIT_FLAGGED.value:
            teacher_email = session.timetable.faculty.user.email if session.timetable.faculty and session.timetable.faculty.user else None
            teacher_name = session.timetable.faculty.user.full_name if session.timetable.faculty and session.timetable.faculty.user else "Teacher"
            if teacher_email:
                send_occluded_exit_security_alert(
                    to_email=teacher_email,
                    teacher_name=teacher_name,
                    classroom=session.timetable.classroom,
                    timestamp_str=ev.get("timestamp", ""),
                    suspected_student_name=ev.get("student_name", "Unidentified Individual"),
                    photo_proof_base64=ev.get("photo_proof_url", ""),
                    async_send=True
                )

    return ProcessFrameResponse(
        success=result["success"],
        events=result["events"],
        currently_inside_count=result["currently_inside_count"],
        inside_students=result["inside_students"]
    )

@router.post("/take-period-attendance", response_model=TakePeriodAttendanceResponse)
def take_period_attendance(
    req: TakePeriodAttendanceRequest,
    db: Session = Depends(get_db)
):
    """
    Automatic Period Attendance Capture:
    1. Finds active timetable slot & session.
    2. Automatically detects & identifies all human faces in camera frame without manual scan.
    3. Performs liveness anti-spoofing verification.
    4. Marks recognized enrolled students directly as PRESENT in the database attendance ledger.
    5. Returns recognized students, present count, and detailed face reticle coordinates.
    """
    timetable = db.query(Timetable).filter(Timetable.id == req.timetable_id).first()
    if not timetable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable slot not found")

    target_date = req.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period_num = req.period_number or timetable.period_number

    # Find or initialize class session
    session = (
        db.query(ClassSession)
        .filter(ClassSession.timetable_id == timetable.id, ClassSession.date == target_date)
        .first()
    )
    if not session:
        session = ClassSession(
            timetable_id=timetable.id,
            date=target_date,
            status=SessionStatus.IN_PROGRESS.value,
            started_at=datetime.now(timezone.utc)
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Decode camera frame
    frame = decode_base64_image(req.image_base64)
    if frame is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid frame image")

    # Enrolled students for this subject
    enrolled_students = (
        db.query(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .filter(Enrollment.subject_id == timetable.subject_id)
        .all()
    )
    enrolled_student_map = {s.id: s for s in enrolled_students}

    # Fetch stored embeddings for enrolled students (or fallback to all students if enrollment is empty)
    if enrolled_student_map:
        embeddings_db = (
            db.query(StudentFaceEmbedding)
            .filter(StudentFaceEmbedding.student_id.in_(enrolled_student_map.keys()))
            .all()
        )
    else:
        embeddings_db = db.query(StudentFaceEmbedding).all()
        enrolled_students = db.query(Student).all()
        enrolled_student_map = {s.id: s for s in enrolled_students}

    # Pre-parse embeddings
    student_embeddings = {}
    for emb_rec in embeddings_db:
        try:
            vec = json.loads(emb_rec.embedding)
            student_embeddings.setdefault(emb_rec.student_id, []).append(vec)
        except Exception:
            pass

    # Ensure roster exists in attendance_records
    for st in enrolled_students:
        rec = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == st.id)
            .first()
        )
        if not rec:
            rec = AttendanceRecord(
                session_id=session.id,
                student_id=st.id,
                date=session.date,
                period_number=period_num,
                status=AttendanceStatus.ABSENT.value
            )
            db.add(rec)
    db.commit()

    recognized_students = []
    all_detected_faces = []
    now = datetime.now(timezone.utc)
    barcodes_scanned = 0

    # 1. Automatic Face Detection & Matching (Primary Biometric Path)
    faces, raw_faces = detect_faces_detailed(frame)
    h, w = frame.shape[:2]

    for idx, (x, y, fw, fh) in enumerate(faces):
        face_raw = raw_faces[idx] if raw_faces is not None and len(raw_faces) > idx else None
        face_crop = frame[max(0, y):min(h, y+fh), max(0, x):min(w, x+fw)]
        if face_crop.size == 0:
            continue

        is_spoof, liveness, details = check_anti_spoofing(face_crop)
        emb = extract_face_embedding(face_crop, full_image=frame, face_raw=face_raw)

        best_student = None
        best_sim = -1.0

        for sid, emb_list in student_embeddings.items():
            for stored_vec in emb_list:
                sim = compute_cosine_similarity(emb, stored_vec)
                if sim > best_sim:
                    best_sim = sim
                    best_student = enrolled_student_map.get(sid)

        is_matched = bool(best_student and best_sim >= SFACE_MATCH_THRESHOLD and not is_spoof)
        conf_display = calculate_match_confidence(best_sim, SFACE_MATCH_THRESHOLD)

        face_item = {
            "bounding_box": [int(x), int(y), int(fw), int(fh)],
            "is_recognized": is_matched,
            "student_id": best_student.id if is_matched else None,
            "roll_number": best_student.student_id if is_matched else None,
            "full_name": best_student.user.full_name if is_matched else None,
            "confidence": conf_display,
            "liveness_score": float(liveness),
            "spoof_detected": bool(is_spoof),
            "verification_method": "FACE_RECOGNITION"
        }
        all_detected_faces.append(face_item)

        if is_matched and best_student:
            if not any(r["student_id"] == best_student.id for r in recognized_students):
                recognized_students.append({
                    "student_id": best_student.id,
                    "roll_number": best_student.student_id,
                    "student_name": best_student.user.full_name,
                    "full_name": best_student.user.full_name,
                    "confidence": conf_display,
                    "liveness_score": float(liveness),
                    "verification_method": "FACE_RECOGNITION",
                    "status": "PRESENT"
                })

                # Automatically update AttendanceRecord in database!
                rec = (
                    db.query(AttendanceRecord)
                    .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == best_student.id)
                    .first()
                )
                if rec:
                    rec.status = AttendanceStatus.PRESENT.value
                    rec.verification_method = VerificationMethod.FACE_RECOGNITION.value
                    rec.confidence_score = float(best_sim)
                    rec.in_time = rec.in_time or now
                    rec.total_minutes_present = max(rec.total_minutes_present, 60.0)
                    rec.presence_ratio = 1.0
                    rec.period_number = period_num

    # 2. Check for optional ID Card Barcode / QR Code in camera frame
    barcode_found, code_data, code_type = detect_and_decode_id_card(frame)
    if barcode_found and code_data:
        clean_code = code_data.strip().upper()
        bc_student = db.query(Student).filter(
            (Student.student_id == clean_code) | (Student.student_id.ilike(f"%{clean_code}%"))
        ).first()
        if bc_student:
            barcodes_scanned += 1
            if not any(r["student_id"] == bc_student.id for r in recognized_students):
                recognized_students.append({
                    "student_id": bc_student.id,
                    "roll_number": bc_student.student_id,
                    "student_name": bc_student.user.full_name,
                    "full_name": bc_student.user.full_name,
                    "confidence": 1.0,
                    "liveness_score": 1.0,
                    "verification_method": "BARCODE_FALLBACK",
                    "status": "PRESENT"
                })
                rec = (
                    db.query(AttendanceRecord)
                    .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == bc_student.id)
                    .first()
                )
                if rec:
                    rec.status = AttendanceStatus.PRESENT.value
                    rec.verification_method = VerificationMethod.BARCODE_FALLBACK.value
                    rec.confidence_score = 1.0
                    rec.in_time = rec.in_time or now
                    rec.total_minutes_present = max(rec.total_minutes_present, 60.0)
                    rec.presence_ratio = 1.0

    db.commit()

    # Recalculate present / absent counts
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    present_cnt = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    absent_cnt = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)

    return TakePeriodAttendanceResponse(
        success=True,
        session_id=session.id,
        period_number=period_num,
        subject_name=timetable.subject.name if timetable.subject else "Class Subject",
        classroom=timetable.classroom,
        date=session.date,
        total_enrolled=len(records),
        present_count=present_cnt,
        absent_count=absent_cnt,
        recognized_faces=len(recognized_students),
        barcodes_scanned=barcodes_scanned,
        message=f"Attendance recorded: {present_cnt} present out of {len(records)} enrolled students.",
        recognized_students=recognized_students,
        all_detected_faces=all_detected_faces
    )

@router.post("/sessions/{session_id}/finalize")
def finalize_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize session, apply >= 75% presence evaluation, commit ledger,
    and automatically dispatch official attendance report email via SMTP to the assigned teacher.
    """
    try:
        session, records = presence_engine.finalize_session(db, session_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    timetable = session.timetable
    teacher = timetable.faculty.user if timetable.faculty and timetable.faculty.user else None

    # Compute statistics
    total_enrolled = len(records)
    present_cnt = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    absent_cnt = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)
    left_early_cnt = sum(1 for r in records if r.status == AttendanceStatus.LEFT_EARLY.value)
    rate = round((present_cnt / total_enrolled * 100), 1) if total_enrolled > 0 else 0.0

    class_info = {
        "subject_name": timetable.subject.name if timetable.subject else "Class Session",
        "subject_code": timetable.subject.code if timetable.subject else "",
        "classroom": timetable.classroom,
        "date": session.date,
        "time_slot": f"{timetable.start_time} - {timetable.end_time}"
    }

    stats = {
        "total_enrolled": total_enrolled,
        "present_count": present_cnt,
        "absent_count": absent_cnt,
        "left_early_count": left_early_cnt,
        "attendance_rate": rate
    }

    roster_list = [
        {
            "roll_number": r.student.student_id if r.student else "N/A",
            "student_name": r.student.user.full_name if r.student and r.student.user else "Unknown",
            "in_time": r.in_time.strftime("%H:%M:%S") if r.in_time else None,
            "out_time": r.out_time.strftime("%H:%M:%S") if r.out_time else None,
            "total_minutes_present": r.total_minutes_present,
            "status": r.status
        }
        for r in records
    ]

    email_dispatched = False
    if teacher and teacher.email:
        email_dispatched = send_class_attendance_report(
            to_email=teacher.email,
            teacher_name=teacher.full_name,
            class_info=class_info,
            stats=stats,
            student_roster=roster_list,
            async_send=True
        )
        session.email_report_sent = True
        for r in records:
            r.email_notified = True
        db.commit()

    return {
        "success": True,
        "session_id": session.id,
        "status": session.status,
        "summary": stats,
        "teacher_email": teacher.email if teacher else None,
        "email_dispatched": email_dispatched,
        "message": f"Session #{session.id} finalized successfully. Attendance report delivered to {teacher.email if teacher else 'teacher'}."
    }

@router.post("/sessions/{session_id}/send-email")
def send_session_email_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually re-send attendance report email to assigned faculty."""
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    timetable = session.timetable
    teacher = timetable.faculty.user if timetable.faculty and timetable.faculty.user else None
    if not teacher or not teacher.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No assigned faculty email found for this course")

    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    total = len(records)
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    rate = round((present / total * 100), 1) if total > 0 else 0.0

    class_info = {
        "subject_name": timetable.subject.name if timetable.subject else "Class",
        "subject_code": timetable.subject.code if timetable.subject else "",
        "classroom": timetable.classroom,
        "date": session.date,
        "time_slot": f"{timetable.start_time} - {timetable.end_time}"
    }

    stats = {
        "total_enrolled": total,
        "present_count": present,
        "absent_count": sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value),
        "left_early_count": sum(1 for r in records if r.status == AttendanceStatus.LEFT_EARLY.value),
        "attendance_rate": rate
    }

    roster = [
        {
            "roll_number": r.student.student_id if r.student else "N/A",
            "student_name": r.student.user.full_name if r.student and r.student.user else "Unknown",
            "in_time": r.in_time.strftime("%H:%M:%S") if r.in_time else None,
            "out_time": r.out_time.strftime("%H:%M:%S") if r.out_time else None,
            "total_minutes_present": r.total_minutes_present,
            "status": r.status
        }
        for r in records
    ]

    ok = send_class_attendance_report(
        to_email=teacher.email,
        teacher_name=teacher.full_name,
        class_info=class_info,
        stats=stats,
        student_roster=roster,
        async_send=True
    )
    session.email_report_sent = True
    db.commit()

    return {
        "success": ok,
        "teacher_email": teacher.email,
        "message": f"Attendance ledger report sent to {teacher.email} via SMTP."
    }

@router.get("/teacher-stats", response_model=TeacherDashboardStats)
def get_teacher_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dedicated Teacher Portal Metrics:
    1. Assigned subjects & sections.
    2. Day-by-day attendance records.
    3. Full cumulative semester summary (e.g. 24 classes held, attended count, attendance %, < 75% warning flag).
    """
    faculty = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
    if not faculty and current_user.role == UserRole.ADMIN:
        # For admin preview, pick the first faculty
        faculty = db.query(Faculty).first()

    if not faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

    timetables = db.query(Timetable).filter(Timetable.faculty_id == faculty.id).all()
    timetable_ids = [t.id for t in timetables]
    sections = list(set([t.section for t in timetables]))

    # Day-by-day session history
    sessions = (
        db.query(ClassSession)
        .filter(ClassSession.timetable_id.in_(timetable_ids))
        .order_by(ClassSession.date.desc())
        .limit(30)
        .all()
    )

    recent_day_records = []
    for sess in sessions:
        recs = sess.attendance_records
        total = len(recs)
        present = sum(1 for r in recs if r.status == AttendanceStatus.PRESENT.value)
        absent = sum(1 for r in recs if r.status == AttendanceStatus.ABSENT.value)
        left = sum(1 for r in recs if r.status == AttendanceStatus.LEFT_EARLY.value)
        rate = round((present / total * 100), 1) if total > 0 else 0.0

        recent_day_records.append(
            DayByDaySessionRecord(
                session_id=sess.id,
                date=sess.date,
                time_slot=f"{sess.timetable.start_time}-{sess.timetable.end_time}",
                classroom=sess.timetable.classroom,
                present_count=present,
                absent_count=absent,
                left_early_count=left,
                attendance_rate=rate,
                email_sent=sess.email_report_sent
            )
        )

    # Cumulative student statistics across all classes held by this teacher
    # Query all students enrolled in faculty's subjects
    subject_ids = [t.subject_id for t in timetables]
    enrolled_students = (
        db.query(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .filter(Enrollment.subject_id.in_(subject_ids))
        .all()
    )

    cumulative_stats = []
    total_classes_held = len(sessions)

    for st in enrolled_students:
        st_records = (
            db.query(AttendanceRecord)
            .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
            .filter(
                AttendanceRecord.student_id == st.id,
                ClassSession.timetable_id.in_(timetable_ids)
            )
            .all()
        )
        classes_held_for_student = len(st_records) if len(st_records) > 0 else total_classes_held
        attended_cnt = sum(1 for r in st_records if r.status == AttendanceStatus.PRESENT.value)
        absent_cnt = sum(1 for r in st_records if r.status == AttendanceStatus.ABSENT.value)
        left_early_cnt = sum(1 for r in st_records if r.status == AttendanceStatus.LEFT_EARLY.value)
        
        pct = round((attended_cnt / classes_held_for_student * 100), 1) if classes_held_for_student > 0 else 0.0

        cumulative_stats.append(
            StudentCumulativeStats(
                student_id=st.id,
                roll_number=st.student_id,
                student_name=st.user.full_name,
                total_classes_held=classes_held_for_student,
                classes_attended=attended_cnt,
                classes_absent=absent_cnt,
                classes_left_early=left_early_cnt,
                attendance_percentage=pct,
                low_attendance_warning=(pct < 75.0 and classes_held_for_student > 0)
            )
        )

    return TeacherDashboardStats(
        teacher_id=faculty.id,
        teacher_name=faculty.user.full_name,
        teacher_email=faculty.user.email,
        total_assigned_subjects=len(set(subject_ids)),
        active_sections=sections,
        recent_sessions=recent_day_records,
        cumulative_student_stats=cumulative_stats
    )

@router.get("/incidents")
def get_security_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve security incidents including covered-face departures with photographic proof."""
    incidents = (
        db.query(SecurityAuditLog)
        .filter(SecurityAuditLog.event_type == SecurityEventType.OCCLUDED_EXIT_FLAGGED.value)
        .order_by(SecurityAuditLog.timestamp.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": inc.id,
            "event_type": inc.event_type,
            "camera_name": inc.camera.name if inc.camera else "Classroom Camera",
            "classroom": inc.camera.classroom if inc.camera else "Classroom",
            "student_name": inc.student.user.full_name if inc.student and inc.student.user else "Unidentified Student",
            "roll_number": inc.student.student_id if inc.student else "N/A",
            "details": inc.details,
            "photo_proof_path": inc.photo_proof_path,
            "timestamp": inc.timestamp
        }
        for inc in incidents
    ]

# ==============================================================================
# CLASS-TEACHER & IN-CLASSROOM PERIOD ATTENDANCE ENDPOINTS
# ==============================================================================

@router.post("/take-period-attendance", response_model=TakePeriodAttendanceResponse)
def take_period_attendance(
    req: TakePeriodAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    In-Classroom AI Camera Attendance:
    Scans the wide classroom view, recognizes all student faces and ID card barcodes,
    and commits period attendance atomically.
    """
    timetable = db.query(Timetable).filter(Timetable.id == req.timetable_id).first()
    if not timetable:
        timetable = db.query(Timetable).first()

    target_date = req.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period_num = req.period_number or (timetable.period_number if timetable else 1) or 1

    # Find or initialize session
    if timetable:
        session = (
            db.query(ClassSession)
            .filter(ClassSession.timetable_id == timetable.id, ClassSession.date == target_date)
            .first()
        )
        if not session:
            session = ClassSession(
                timetable_id=timetable.id,
                date=target_date,
                status=SessionStatus.IN_PROGRESS.value
            )
            db.add(session)
            db.commit()
            db.refresh(session)
    else:
        # Create fallback timetable if none exists
        # Check or create default subject & faculty
        sub = db.query(Subject).first()
        if not sub:
            sub = Subject(code="GEN-101", name="General Attendance", department="All", semester=1, credits=3)
            db.add(sub)
            db.flush()
        fac = db.query(Faculty).first()
        if not fac:
            # Look up admin user to attach
            admin_u = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if not admin_u:
                admin_u = db.query(User).first()
            fac = Faculty(user_id=admin_u.id if admin_u else 1, employee_id="FAC-001", department="Academic", designation="Professor")
            db.add(fac)
            db.flush()
        timetable = Timetable(
            subject_id=sub.id,
            faculty_id=fac.id,
            day_of_week=datetime.now(timezone.utc).strftime("%A"),
            period_number=period_num,
            start_time="09:00",
            end_time="10:00",
            classroom="Room 302",
            section="A"
        )
        db.add(timetable)
        db.commit()
        db.refresh(timetable)

        session = ClassSession(
            timetable_id=timetable.id,
            date=target_date,
            status=SessionStatus.IN_PROGRESS.value
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Decode camera frame
    image = decode_base64_image(req.image_base64)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image frame provided")

    # 1. Barcode scan in classroom frame
    barcode_found, code_data, code_type = detect_and_decode_id_card(image)
    recognized_student_ids = set()
    barcode_count = 0

    if barcode_found and code_data:
        clean_code = code_data.strip().upper()
        bc_student = db.query(Student).filter(
            (Student.student_id == clean_code) | (Student.student_id.ilike(f"%{clean_code}%"))
        ).first()
        if bc_student:
            recognized_student_ids.add((bc_student.id, 1.0, VerificationMethod.ID_CARD_BARCODE.value))
            barcode_count += 1

    # 2. Multi-face recognition in classroom frame
    faces, raw_faces = detect_faces_detailed(image)
    if faces:
        all_embeddings = db.query(StudentFaceEmbedding).all()
        student_map = {s.id: s for s in db.query(Student).all()}

        for idx, (x, y, w, h) in enumerate(faces):
            face_raw = raw_faces[idx] if raw_faces is not None and len(raw_faces) > idx else None
            face_crop = image[y:y+h, x:x+w]
            is_spoof, liveness, _ = check_anti_spoofing(face_crop)
            if is_spoof:
                continue

            emb = extract_face_embedding(face_crop, full_image=image, face_raw=face_raw)
            best_sim = -1.0
            best_student_id = None

            for stored in all_embeddings:
                try:
                    stored_vec = json.loads(stored.embedding)
                    sim = compute_cosine_similarity(emb, stored_vec)
                    if sim > best_sim:
                        best_sim = sim
                        best_student_id = stored.student_id
                except Exception:
                    pass

            if best_student_id and best_sim >= SFACE_MATCH_THRESHOLD:
                conf = calculate_match_confidence(best_sim, SFACE_MATCH_THRESHOLD)
                recognized_student_ids.add((best_student_id, conf, VerificationMethod.FACE_RECOGNITION.value))

    # Fetch all enrolled students for this subject or section
    enrollments = db.query(Enrollment).filter(Enrollment.subject_id == timetable.subject_id).all()
    enrolled_student_ids = [e.student_id for e in enrollments]
    if not enrolled_student_ids:
        # Fallback to students in the same section
        section_students = db.query(Student).filter(Student.section == timetable.section).all()
        enrolled_student_ids = [s.id for s in section_students]

    # Ensure any student recognized in the camera frame is recorded in attendance
    for (rec_s_id, _, _) in recognized_student_ids:
        if rec_s_id not in enrolled_student_ids:
            enrolled_student_ids.append(rec_s_id)

    now_utc = datetime.now(timezone.utc)
    present_cnt = 0
    absent_cnt = 0

    rec_dict = {item[0]: (item[1], item[2]) for item in recognized_student_ids}

    for s_id in enrolled_student_ids:
        is_present = s_id in rec_dict
        conf, v_method = rec_dict.get(s_id, (0.0, VerificationMethod.FACE_RECOGNITION.value))

        record = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == s_id)
            .first()
        )
        if not record:
            record = AttendanceRecord(
                session_id=session.id,
                student_id=s_id,
                date=target_date,
                period_number=period_num,
                status=AttendanceStatus.PRESENT.value if is_present else AttendanceStatus.ABSENT.value,
                verification_method=v_method if is_present else VerificationMethod.FACE_RECOGNITION.value,
                confidence_score=conf,
                total_minutes_present=60.0 if is_present else 0.0,
                presence_ratio=1.0 if is_present else 0.0,
                in_time=now_utc if is_present else None
            )
            db.add(record)
        else:
            if is_present:
                record.status = AttendanceStatus.PRESENT.value
                record.verification_method = v_method
                record.confidence_score = conf
                record.total_minutes_present = 60.0
                record.presence_ratio = 1.0
                if not record.in_time:
                    record.in_time = now_utc
            record.period_number = period_num

        if is_present:
            present_cnt += 1
        else:
            absent_cnt += 1

    db.commit()

    rec_students_list = []
    for s_id in enrolled_student_ids:
        if s_id in rec_dict:
            st = db.query(Student).filter(Student.id == s_id).first()
            if st and st.user:
                conf, vm = rec_dict[s_id]
                rec_students_list.append({
                    "student_id": st.id,
                    "roll_number": st.student_id,
                    "full_name": st.user.full_name,
                    "confidence": conf,
                    "verification_method": vm,
                    "status": "PRESENT"
                })

    return TakePeriodAttendanceResponse(
        success=True,
        session_id=session.id,
        period_number=period_num,
        subject_name=timetable.subject.name if (timetable and timetable.subject) else "Class",
        classroom=timetable.classroom if timetable else "Room 302",
        date=target_date,
        total_enrolled=len(enrolled_student_ids),
        present_count=present_cnt,
        absent_count=absent_cnt,
        recognized_faces=len(recognized_student_ids) - barcode_count,
        barcodes_scanned=barcode_count,
        message=f"Attendance captured for Period {period_num} ({timetable.subject.name if timetable and timetable.subject else 'Class'}). Present: {present_cnt}, Absent: {absent_cnt}",
        recognized_students=rec_students_list,
        all_detected_faces=[]
    )

@router.get("/weekly-grid")
def get_weekly_timetable_grid(
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full weekly schedule (Monday - Saturday, Periods 1 - 6)."""
    query = db.query(Timetable).filter(Timetable.is_active == True)
    if section:
        query = query.filter(Timetable.section == section)
    slots = query.order_by(Timetable.period_number.asc()).all()

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    grid = {d: [] for d in days}

    for slot in slots:
        d = slot.day_of_week.capitalize()
        if d in grid:
            grid[d].append({
                "id": slot.id,
                "period_number": slot.period_number or 1,
                "start_time": slot.start_time,
                "end_time": slot.end_time,
                "subject_code": slot.subject.code if slot.subject else "",
                "subject_name": slot.subject.name if slot.subject else "",
                "classroom": slot.classroom,
                "section": slot.section,
                "faculty_name": slot.faculty.user.full_name if slot.faculty and slot.faculty.user else "Faculty"
            })

    return {"days": days, "grid": grid}

@router.get("/class-teacher/daily-ledger", response_model=ClassTeacherDailyLedgerResponse)
def get_class_teacher_daily_ledger(
    date: Optional[str] = None,
    section: str = "B",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Class Teacher Portal - All Periods Ledger:
    Displays Period 1 through Period 6 across all subjects for that day for the assigned cohort.
    """
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target_day = datetime.strptime(target_date, "%Y-%m-%d").strftime("%A")

    # Fetch scheduled slots for this section and day
    day_slots = (
        db.query(Timetable)
        .filter(Timetable.section == section, Timetable.day_of_week.ilike(target_day), Timetable.is_active == True)
        .order_by(Timetable.period_number.asc())
        .all()
    )

    period_headers = []
    for slot in day_slots:
        period_headers.append({
            "period": slot.period_number or 1,
            "time": f"{slot.start_time}-{slot.end_time}",
            "subject": slot.subject.name if slot.subject else "Class",
            "subject_code": slot.subject.code if slot.subject else "",
            "teacher": slot.faculty.user.full_name if slot.faculty and slot.faculty.user else "Faculty",
            "timetable_id": slot.id
        })

    # Fetch students of this section
    students = db.query(Student).filter(Student.section == section).order_by(Student.student_id.asc()).all()

    student_rows = []
    # Collect attendance for all sessions on this date
    sessions = (
        db.query(ClassSession)
        .join(Timetable)
        .filter(ClassSession.date == target_date, Timetable.section == section)
        .all()
    )
    session_ids = [s.id for s in sessions]
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).all() if session_ids else []

    # Map (student_id, session_id) -> record
    att_map = {}
    for r in records:
        att_map[(r.student_id, r.session.timetable.period_number)] = r.status

    for st in students:
        p_status = {}
        attended_cnt = 0
        for hdr in period_headers:
            p_num = hdr["period"]
            st_status = att_map.get((st.id, p_num), "NOT_HELD")
            p_status[str(p_num)] = st_status
            if st_status == AttendanceStatus.PRESENT.value:
                attended_cnt += 1

        student_rows.append(
            StudentPeriodAttendance(
                student_id=st.id,
                roll_number=st.student_id,
                student_name=st.user.full_name,
                periods=p_status,
                total_attended_today=attended_cnt
            )
        )

    classroom = day_slots[0].classroom if day_slots else "Room 302"
    semester = students[0].semester if students else 7
    dept = students[0].department if students else "Computer Science"

    return ClassTeacherDailyLedgerResponse(
        date=target_date,
        section=section,
        semester=semester,
        department=dept,
        classroom=classroom,
        period_headers=period_headers,
        students=student_rows
    )

@router.get("/class-teacher/subject-wise-matrix", response_model=List[StudentSubjectMatrixItem])
def get_class_teacher_subject_matrix(
    section: str = "B",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Class Teacher Portal - Complete Subject-Wise Attendance Matrix:
    Displays overall attendance percentages for each student across all subjects with 75% shortage alert.
    """
    students = db.query(Student).filter(Student.section == section).order_by(Student.student_id.asc()).all()
    if not students:
        return []

    # Get distinct subjects for this section via timetables
    timetables = db.query(Timetable).filter(Timetable.section == section, Timetable.is_active == True).all()
    subject_map = {t.subject.id: t.subject for t in timetables if t.subject}

    result = []
    for st in students:
        sub_details = []
        overall_held = 0
        overall_attended = 0

        for sub_id, sub in subject_map.items():
            # Find all sessions for this subject & section
            sessions = (
                db.query(ClassSession)
                .join(Timetable)
                .filter(Timetable.subject_id == sub_id, Timetable.section == section)
                .all()
            )
            s_ids = [s.id for s in sessions]
            held = len(s_ids)
            attended = 0
            if held > 0:
                records = (
                    db.query(AttendanceRecord)
                    .filter(AttendanceRecord.session_id.in_(s_ids), AttendanceRecord.student_id == st.id)
                    .all()
                )
                attended = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)

            pct = round((attended / held * 100), 1) if held > 0 else 0.0
            overall_held += held
            overall_attended += attended

            sub_details.append(
                StudentSubjectAttendanceDetail(
                    subject_id=sub.id,
                    subject_code=sub.code,
                    subject_name=sub.name,
                    classes_held=held,
                    classes_attended=attended,
                    percentage=pct
                )
            )

        overall_pct = round((overall_attended / overall_held * 100), 1) if overall_held > 0 else 0.0

        result.append(
            StudentSubjectMatrixItem(
                student_id=st.id,
                roll_number=st.student_id,
                student_name=st.user.full_name,
                department=st.department,
                section=st.section,
                semester=st.semester,
                subjects=sub_details,
                overall_held=overall_held,
                overall_attended=overall_attended,
                overall_percentage=overall_pct,
                has_shortage=(overall_pct < 75.0 and overall_held > 0)
            )
        )

    return result
