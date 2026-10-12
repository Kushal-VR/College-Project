import cv2
import json
import time
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
import numpy as np

from app.core.logging import logger
from app.models.cctv import Camera, CrossingDirection
from app.models.timetable import ClassSession, AttendanceRecord, AttendanceStatus, VerificationMethod, SessionStatus
from app.models.academic import Student, Subject, Enrollment
from app.models.biometrics import StudentFaceEmbedding, SecurityAuditLog, SecurityEventType
from app.services.biometric_service import (
    detect_faces,
    extract_face_embedding,
    compute_cosine_similarity,
    check_anti_spoofing,
    encode_image_to_base64
)

class StudentPresenceTracker:
    def __init__(self, student_id: int):
        self.student_id = student_id
        self.first_seen: Optional[datetime] = None
        self.last_seen: Optional[datetime] = None
        self.out_time: Optional[datetime] = None
        self.is_inside: bool = False
        self.total_seconds_present: float = 0.0
        self.last_heartbeat_time: float = time.time()
        self.last_x: Optional[int] = None
        self.verification_method: str = VerificationMethod.FACE_RECOGNITION.value
        self.flagged_occlusion: bool = False
        self.photo_proof_url: Optional[str] = None

class ClassroomSessionManager:
    """Manages active classroom sessions, frame processing, directional crossing, and presence evaluation."""

    def __init__(self):
        # session_id -> { student_id -> StudentPresenceTracker }
        self._session_trackers: Dict[int, Dict[int, StudentPresenceTracker]] = {}
        # session_id -> list of tracked unassigned person centroids [x, y, time]
        self._unassigned_centroids: Dict[int, List[Dict[str, Any]]] = {}

    def get_or_create_session_trackers(self, session_id: int, db: Session) -> Dict[int, StudentPresenceTracker]:
        if session_id not in self._session_trackers:
            self._session_trackers[session_id] = {}
            # Pre-populate trackers from existing attendance records if any
            records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
            for rec in records:
                tracker = StudentPresenceTracker(rec.student_id)
                tracker.first_seen = rec.in_time
                tracker.last_seen = rec.in_time
                tracker.out_time = rec.out_time
                tracker.total_seconds_present = rec.total_minutes_present * 60.0
                tracker.verification_method = rec.verification_method
                tracker.is_inside = (rec.out_time is None and rec.in_time is not None)
                self._session_trackers[session_id][rec.student_id] = tracker
        return self._session_trackers[session_id]

    def process_frame(
        self,
        db: Session,
        session_id: int,
        camera: Camera,
        frame: np.ndarray
    ) -> Dict[str, Any]:
        """
        Process a single CCTV frame:
        1. Detect faces and identify enrolled students via cosine similarity.
        2. Evaluate directional crossing across the virtual tripwire (Left-to-Right vs Right-to-Left).
        3. Detect covered face / occluded exit movements without face recognition.
        4. Update continuous in-classroom presence.
        """
        now = datetime.now(timezone.utc)
        current_time_sec = time.time()
        trackers = self.get_or_create_session_trackers(session_id, db)

        # Load enrolled student embeddings for this session's subject
        session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
        if not session:
            return {"success": False, "events": [], "currently_inside_count": 0, "inside_students": []}

        timetable = session.timetable
        enrolled_students = (
            db.query(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .filter(Enrollment.subject_id == timetable.subject_id)
            .all()
        )
        enrolled_student_map = {s.id: s for s in enrolled_students}

        # Query face embeddings
        embeddings_db = (
            db.query(StudentFaceEmbedding)
            .filter(StudentFaceEmbedding.student_id.in_(enrolled_student_map.keys()))
            .all()
        )
        student_embeddings: Dict[int, List[List[float]]] = {}
        for emb_record in embeddings_db:
            try:
                emb_list = json.loads(emb_record.embedding)
                student_embeddings.setdefault(emb_record.student_id, []).append(emb_list)
            except Exception:
                pass

        h, w = frame.shape[:2]
        boundary_x = w // 2
        events = []
        recognized_student_ids = set()

        # 1. Face Detection
        faces = detect_faces(frame)
        for (x, y, fw, fh) in faces:
            face_crop = frame[max(0, y):min(h, y+fh), max(0, x):min(w, x+fw)]
            if face_crop.size == 0:
                continue

            # Anti-spoofing check
            is_spoof, liveness, details = check_anti_spoofing(face_crop)
            if is_spoof:
                events.append({
                    "type": SecurityEventType.SPOOF_DETECTED.value,
                    "details": f"Anti-spoofing alert: {details} at coordinates ({x},{y})",
                    "timestamp": now.isoformat(),
                    "photo_proof_url": encode_image_to_base64(face_crop)
                })
                # Log to security audit
                audit = SecurityAuditLog(
                    event_type=SecurityEventType.SPOOF_DETECTED.value,
                    camera_id=camera.id,
                    details=details,
                    timestamp=now
                )
                db.add(audit)
                continue

            # Extract normalized embedding
            emb = extract_face_embedding(face_crop)
            
            # Find best matching student
            best_match_id = None
            best_sim = 0.0
            for sid, emb_list in student_embeddings.items():
                for stored_emb in emb_list:
                    sim = compute_cosine_similarity(emb, stored_emb)
                    if sim > best_sim:
                        best_sim = sim
                        best_match_id = sid

            # Threshold for positive match: 0.68+
            if best_match_id is not None and best_sim >= 0.68:
                student = enrolled_student_map[best_match_id]
                recognized_student_ids.add(best_match_id)
                
                if best_match_id not in trackers:
                    trackers[best_match_id] = StudentPresenceTracker(best_match_id)
                tracker = trackers[best_match_id]

                # Directional Tripwire Crossing Check
                face_center_x = x + fw // 2
                prev_x = tracker.last_x

                if prev_x is not None:
                    dx = face_center_x - prev_x
                    is_crossing = (prev_x < boundary_x <= face_center_x) or (face_center_x <= boundary_x < prev_x)
                    
                    if is_crossing:
                        if camera.crossing_direction == CrossingDirection.LEFT_TO_RIGHT_ENTRY.value:
                            is_entry = (dx > 0)
                        else:
                            is_entry = (dx < 0)

                        if is_entry and not tracker.is_inside:
                            tracker.is_inside = True
                            if not tracker.first_seen:
                                tracker.first_seen = now
                            events.append({
                                "type": "ENTRY",
                                "student_id": student.id,
                                "student_name": student.user.full_name,
                                "details": f"{student.user.full_name} entered classroom via tripwire",
                                "timestamp": now.isoformat()
                            })
                        elif not is_entry and tracker.is_inside:
                            tracker.is_inside = False
                            tracker.out_time = now
                            events.append({
                                "type": "EXIT",
                                "student_id": student.id,
                                "student_name": student.user.full_name,
                                "details": f"{student.user.full_name} exited classroom via tripwire",
                                "timestamp": now.isoformat()
                            })

                # If no boundary crossing was caught but face is clearly inside the room
                if not tracker.is_inside:
                    tracker.is_inside = True
                    if not tracker.first_seen:
                        tracker.first_seen = now
                    events.append({
                        "type": "ENTRY",
                        "student_id": student.id,
                        "student_name": student.user.full_name,
                        "details": f"{student.user.full_name} detected in classroom",
                        "timestamp": now.isoformat()
                    })

                # Accumulate time present
                time_delta = current_time_sec - tracker.last_heartbeat_time
                if tracker.is_inside and 0 < time_delta < 30:
                    tracker.total_seconds_present += time_delta
                
                tracker.last_heartbeat_time = current_time_sec
                tracker.last_seen = now
                tracker.last_x = face_center_x

        # 2. Covered Face / Occluded Exit Detection
        # Use background subtraction / motion contours heading toward exit boundary with NO face detected
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Check if there are moving body contours near the exit line without a corresponding recognized face
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 8000:  # Size of human torso / person silhouette
                bx, by, bw, bh = cv2.boundingRect(cnt)
                b_center_x = bx + bw // 2
                
                # Check if this person contour crosses the boundary line
                near_boundary = abs(b_center_x - boundary_x) < 50
                if near_boundary:
                    # Check if any detected face overlaps this body bounding box
                    has_face = False
                    for (fx, fy, fw, fh) in faces:
                        if bx <= fx <= bx + bw and by <= fy <= by + bh:
                            has_face = True
                            break

                    if not has_face:
                        # Human body crossed exit with covered / hidden face!
                        proof_snapshot = frame[max(0, by-20):min(h, by+bh+20), max(0, bx-20):min(w, bx+bw+20)]
                        proof_url = encode_image_to_base64(proof_snapshot)

                        # Correlate with student who was recently inside but disappeared
                        suspected_student = None
                        for sid, trk in trackers.items():
                            if trk.is_inside and sid not in recognized_student_ids:
                                suspected_student = enrolled_student_map.get(sid)
                                trk.is_inside = False
                                trk.out_time = now
                                trk.flagged_occlusion = True
                                trk.photo_proof_url = proof_url
                                break

                        details_msg = (
                            f"Unidentified person exited with covered face. Suspected: {suspected_student.user.full_name if suspected_student else 'Unknown'}."
                        )
                        events.append({
                            "type": SecurityEventType.OCCLUDED_EXIT_FLAGGED.value,
                            "student_id": suspected_student.id if suspected_student else None,
                            "student_name": suspected_student.user.full_name if suspected_student else "Unknown",
                            "details": details_msg,
                            "timestamp": now.isoformat(),
                            "photo_proof_url": proof_url
                        })

                        # Log security audit record
                        audit = SecurityAuditLog(
                            event_type=SecurityEventType.OCCLUDED_EXIT_FLAGGED.value,
                            camera_id=camera.id,
                            student_id=suspected_student.id if suspected_student else None,
                            details=details_msg,
                            timestamp=now
                        )
                        db.add(audit)
                        break

        # Calculate currently inside count and names
        inside_names = []
        currently_inside_count = 0
        for sid, trk in trackers.items():
            if trk.is_inside:
                currently_inside_count += 1
                st = enrolled_student_map.get(sid)
                if st:
                    inside_names.append(st.user.full_name)

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Error committing presence frame events: {exc}")

        return {
            "success": True,
            "events": events,
            "currently_inside_count": currently_inside_count,
            "inside_students": inside_names
        }

    def finalize_session(
        self,
        db: Session,
        session_id: int
    ) -> Tuple[ClassSession, List[AttendanceRecord]]:
        """
        Finalize an active class session:
        1. Evaluates each student's cumulative in-class presence.
        2. Applies the >= 75% presence rule for PRESENT vs LEFT_EARLY vs ABSENT.
        3. Saves and updates AttendanceRecord rows in the database.
        """
        now = datetime.now(timezone.utc)
        session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
        if not session:
            raise ValueError(f"Class session #{session_id} not found")

        timetable = session.timetable
        # Calculate class scheduled duration from start_time and end_time (e.g. "13:00" to "14:00")
        try:
            sh, sm = map(int, timetable.start_time.split(":"))
            eh, em = map(int, timetable.end_time.split(":"))
            duration_minutes = (eh * 60 + em) - (sh * 60 + sm)
            if duration_minutes <= 0:
                duration_minutes = 60.0  # default 1 hour
        except Exception:
            duration_minutes = 60.0

        # Query all enrolled students in this subject
        enrolled = (
            db.query(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .filter(Enrollment.subject_id == timetable.subject_id)
            .all()
        )

        trackers = self.get_or_create_session_trackers(session_id, db)
        records = []

        for student in enrolled:
            tracker = trackers.get(student.id)
            minutes_present = (tracker.total_seconds_present / 60.0) if tracker else 0.0
            presence_ratio = min(1.0, round(minutes_present / duration_minutes, 3))
            
            # Determine Attendance Status
            if tracker and tracker.flagged_occlusion:
                status = AttendanceStatus.FLAGGED_OCCLUDED_EXIT.value
            elif presence_ratio >= 0.75:
                status = AttendanceStatus.PRESENT.value
            elif minutes_present > 0.0:
                status = AttendanceStatus.LEFT_EARLY.value
            else:
                status = AttendanceStatus.ABSENT.value

            # Check if record already exists
            record = (
                db.query(AttendanceRecord)
                .filter(AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == student.id)
                .first()
            )
            if not record:
                record = AttendanceRecord(
                    session_id=session_id,
                    student_id=student.id,
                    date=session.date,
                )
                db.add(record)

            record.in_time = tracker.first_seen if tracker else None
            record.out_time = tracker.out_time if tracker else None
            record.total_minutes_present = round(minutes_present, 1)
            record.presence_ratio = presence_ratio
            record.status = status
            record.verification_method = tracker.verification_method if tracker else VerificationMethod.FACE_RECOGNITION.value
            if tracker and tracker.photo_proof_url:
                record.photo_proof_url = tracker.photo_proof_url

            records.append(record)

        session.status = SessionStatus.COMPLETED.value
        session.ended_at = now
        db.commit()
        return session, records

presence_engine = ClassroomSessionManager()
