import json
import numpy as np
from datetime import datetime, timezone
from app.models.academic import Student, Faculty, Subject, Enrollment
from app.models.cctv import Camera, CrossingDirection
from app.models.timetable import Timetable, ClassSession, AttendanceRecord, AttendanceStatus, SessionStatus
from app.models.biometrics import StudentFaceEmbedding, SecurityAuditLog, SecurityEventType
from app.services.presence_engine import presence_engine, StudentPresenceTracker
from app.services.email_service import send_class_attendance_report, send_occluded_exit_security_alert

def test_timetable_single_class_creation(db):
    faculty = db.query(Faculty).first()
    subject = db.query(Subject).first()
    camera = db.query(Camera).first()

    assert faculty is not None
    assert subject is not None

    # Create a single class period: 1:00 PM to 2:00 PM (13:00 - 14:00)
    slot = Timetable(
        subject_id=subject.id,
        faculty_id=faculty.id,
        camera_id=camera.id if camera else None,
        day_of_week="Monday",
        start_time="13:00",
        end_time="14:00",
        classroom="Room 302",
        section="A",
        batch_year="2023-2027",
        is_recurring=True,
        is_active=True
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    assert slot.id is not None
    assert slot.start_time == "13:00"
    assert slot.end_time == "14:00"

def test_class_session_initialization_and_finalization(db):
    timetable = db.query(Timetable).first()
    assert timetable is not None

    student = db.query(Student).first()
    assert student is not None

    # Ensure enrollment
    en = db.query(Enrollment).filter(Enrollment.student_id == student.id, Enrollment.subject_id == timetable.subject_id).first()
    if not en:
        db.add(Enrollment(student_id=student.id, subject_id=timetable.subject_id, academic_year="2026-2027"))
        db.commit()

    # Start session
    session = ClassSession(
        timetable_id=timetable.id,
        date="2026-09-22",
        status=SessionStatus.IN_PROGRESS.value,
        started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Simulate presence: 50 minutes out of 60-minute class (83.3% -> PRESENT)
    trackers = presence_engine.get_or_create_session_trackers(session.id, db)
    tracker = StudentPresenceTracker(student.id)
    tracker.first_seen = datetime.now(timezone.utc)
    tracker.last_seen = datetime.now(timezone.utc)
    tracker.total_seconds_present = 50 * 60.0  # 50 minutes
    tracker.is_inside = True
    trackers[student.id] = tracker

    # Finalize session
    finalized_session, records = presence_engine.finalize_session(db, session.id)

    assert finalized_session.status == SessionStatus.COMPLETED.value
    assert len(records) >= 1
    
    st_record = next(r for r in records if r.student_id == student.id)
    assert st_record.status == AttendanceStatus.PRESENT.value
    assert st_record.total_minutes_present == 50.0
    assert st_record.presence_ratio >= 0.75

def test_left_early_attendance_evaluation(db):
    timetable = db.query(Timetable).first()
    student = db.query(Student).first()

    session = ClassSession(
        timetable_id=timetable.id,
        date="2026-09-23",
        status=SessionStatus.IN_PROGRESS.value,
        started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Student only attended 15 minutes of an hour class (25% < 75%) and left
    trackers = presence_engine.get_or_create_session_trackers(session.id, db)
    tracker = StudentPresenceTracker(student.id)
    tracker.first_seen = datetime.now(timezone.utc)
    tracker.out_time = datetime.now(timezone.utc)
    tracker.total_seconds_present = 15 * 60.0  # 15 minutes
    tracker.is_inside = False
    trackers[student.id] = tracker

    finalized_session, records = presence_engine.finalize_session(db, session.id)
    st_record = next(r for r in records if r.student_id == student.id)
    
    assert st_record.status == AttendanceStatus.LEFT_EARLY.value
    assert st_record.presence_ratio < 0.75

def test_covered_face_security_alert_email_dispatch():
    # Test dispatching security alert for covered face departure
    ok = send_occluded_exit_security_alert(
        to_email="faculty.prof@university.edu",
        teacher_name="Dr. Alan Turing",
        classroom="Room 302",
        timestamp_str="13:42:10",
        suspected_student_name="Kushal Kumar",
        photo_proof_base64="data:image/jpeg;base64,mockproof",
        async_send=False  # synchronous in test
    )
    assert ok is True

def test_class_attendance_report_email_dispatch():
    class_info = {
        "subject_name": "Computer Vision & AI",
        "subject_code": "CS801",
        "classroom": "Room 302",
        "date": "2026-09-22",
        "time_slot": "13:00 - 14:00"
    }
    stats = {
        "total_enrolled": 20,
        "present_count": 18,
        "absent_count": 1,
        "left_early_count": 1,
        "attendance_rate": 90.0
    }
    roster = [
        {
            "roll_number": "CS2026-001",
            "student_name": "Kushal Kumar",
            "in_time": "13:01:05",
            "out_time": "13:58:20",
            "total_minutes_present": 57.2,
            "status": "PRESENT"
        }
    ]

    ok = send_class_attendance_report(
        to_email="faculty.prof@university.edu",
        teacher_name="Dr. Alan Turing",
        class_info=class_info,
        stats=stats,
        student_roster=roster,
        async_send=False
    )
    assert ok is True

def test_class_teacher_daily_ledger_and_matrix_endpoints(client=None):
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. Weekly Grid
    res = client.get("/api/timetable/weekly-grid?section=B")
    assert res.status_code == 200
    grid_data = res.json()
    assert "days" in grid_data
    assert "Monday" in grid_data["grid"]

    # 2. Daily Ledger for Section B
    res = client.get("/api/timetable/class-teacher/daily-ledger?section=B&date=2026-09-22")
    assert res.status_code == 200
    ledger_data = res.json()
    assert ledger_data["section"] == "B"
    assert "period_headers" in ledger_data
    assert "students" in ledger_data

    # 3. Subject-Wise Matrix for Section B
    res = client.get("/api/timetable/class-teacher/subject-wise-matrix?section=B")
    assert res.status_code == 200
    matrix_data = res.json()
    assert isinstance(matrix_data, list)
    if len(matrix_data) > 0:
        assert "subjects" in matrix_data[0]
        assert "overall_percentage" in matrix_data[0]

def test_take_period_attendance_auto_records(db):
    """Verify that camera frame automatically records attendance without scanning first."""
    import cv2
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.biometric_service import encode_image_to_base64

    client = TestClient(app)
    timetable = db.query(Timetable).first()
    assert timetable is not None

    # Create synthetic frame with image
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw simple synthetic scene
    cv2.circle(frame, (320, 240), 60, (200, 200, 200), -1)
    b64_frame = encode_image_to_base64(frame)

    res = client.post(
        "/api/timetable/take-period-attendance",
        json={
            "timetable_id": timetable.id,
            "image_base64": b64_frame,
            "period_number": 1
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "present_count" in data
    assert "absent_count" in data
    assert "session_id" in data
    assert data["session_id"] > 0

