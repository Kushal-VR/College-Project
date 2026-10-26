from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models.user import User, UserRole
from app.models.academic import Student, Faculty, Subject, Enrollment
from app.models.cctv import Camera, CameraType, CameraStatus, CrossingDirection
from app.models.timetable import Timetable
from app.core.security import get_password_hash
from app.core.logging import logger

DEFAULT_USERS = [
    {
        "email": "kushalvr12@gmail.com",
        "full_name": "Kushal (Super Admin)",
        "password": "admin123",
        "role": UserRole.ADMIN,
        "phone_number": "+91-9876543210",
    },
    {
        "email": "admin@attendance.edu",
        "full_name": "System Administrator",
        "password": "admin123",
        "role": UserRole.ADMIN,
        "phone_number": "+1-800-555-0199",
    },
]

def seed_default_users(db: Session):
    """Seed initial administrator accounts and camera node."""
    # 1. Admin Users Only
    for user_data in DEFAULT_USERS:
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing_user:
            new_user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                hashed_password=get_password_hash(user_data["password"]),
                role=user_data["role"],
                is_active=True,
                is_verified=True,
                phone_number=user_data.get("phone_number"),
            )
            db.add(new_user)
            db.flush()
            logger.info(f"Seeded default user: {user_data['email']} ({user_data['role']})")

    # 2. Default CCTV Camera
    cam1 = db.query(Camera).filter(Camera.classroom == "Room 302").first()
    if not cam1:
        cam1 = Camera(
            name="Classroom 302 High-Angle CCTV",
            stream_url="demo",
            camera_type=CameraType.RTSP.value,
            classroom="Room 302",
            crossing_direction=CrossingDirection.LEFT_TO_RIGHT_ENTRY.value,
            fps=25,
            resolution="1920x1080",
            is_active=True,
            last_status=CameraStatus.ONLINE.value,
            last_ping=datetime.now(timezone.utc)
        )
        db.add(cam1)
        db.flush()

    # 3. Default Faculty
    faculty_user = db.query(User).filter(User.email == "faculty@attendance.edu").first()
    if not faculty_user:
        faculty_user = User(
            email="faculty@attendance.edu",
            full_name="Prof. Alan Turing",
            hashed_password=get_password_hash("faculty123"),
            role=UserRole.FACULTY,
            is_active=True,
            is_verified=True,
            phone_number="+1-800-555-0198"
        )
        db.add(faculty_user)
        db.flush()

    faculty_profile = db.query(Faculty).filter(Faculty.user_id == faculty_user.id).first()
    if not faculty_profile:
        faculty_profile = Faculty(
            user_id=faculty_user.id,
            employee_id="FAC-001",
            department="Computer Science",
            designation="Associate Professor",
            office_location="Block B, Room 302",
            is_class_teacher=True,
            class_teacher_section="A",
            class_teacher_semester=6
        )
        db.add(faculty_profile)
        db.flush()

    # 4. Default Student
    student_user = db.query(User).filter(User.email == "student.kushal@university.edu").first()
    if not student_user:
        student_user = User(
            email="student.kushal@university.edu",
            full_name="Kushal Student",
            hashed_password=get_password_hash("student123"),
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
            phone_number="+1-800-555-0197"
        )
        db.add(student_user)
        db.flush()

    student_profile = db.query(Student).filter(Student.user_id == student_user.id).first()
    if not student_profile:
        student_profile = Student(
            user_id=student_user.id,
            student_id="CS-2024-001",
            department="Computer Science",
            batch_year="2023-2027",
            semester=6,
            section="A",
            biometric_enrolled=True,
            biometric_face_count=1
        )
        db.add(student_profile)
        db.flush()

    # 5. Default Subject
    subj = db.query(Subject).filter(Subject.code == "CS301").first()
    if not subj:
        subj = Subject(
            code="CS301",
            name="Computer Networks",
            department="Computer Science",
            semester=6,
            credits=4,
            faculty_id=faculty_profile.id
        )
        db.add(subj)
        db.flush()

    # 6. Default Student Enrollment
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_profile.id,
        Enrollment.subject_id == subj.id
    ).first()
    if not enrollment:
        enrollment = Enrollment(
            student_id=student_profile.id,
            subject_id=subj.id,
            academic_year="2026-2027",
            status="ENROLLED"
        )
        db.add(enrollment)
        db.flush()

    # 7. Default Timetable Periods (Monday through Saturday, Periods 1 to 6)
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    periods = [
        (1, "09:00", "10:00"),
        (2, "10:00", "11:00"),
        (3, "11:15", "12:15"),
        (4, "13:00", "14:00"),
        (5, "14:00", "15:00"),
        (6, "15:00", "16:00"),
    ]
    all_subjects = db.query(Subject).filter(Subject.semester == 6).all()
    sub_map = {s.code: s for s in all_subjects}
    period_sub_codes = {
        1: "CS301",
        2: "CS302",
        3: "CS303",
        4: "CS304",
        5: "CS301",
        6: "CS302",
    }
    for section_name in ["A", "B"]:
        for day in days:
            for p_num, s_time, e_time in periods:
                existing_slot = db.query(Timetable).filter(
                    Timetable.day_of_week == day,
                    Timetable.period_number == p_num,
                    Timetable.section == section_name
                ).first()
                if not existing_slot:
                    target_code = period_sub_codes.get(p_num, "CS301")
                    target_sub = sub_map.get(target_code, subj)
                    target_faculty_id = target_sub.faculty_id if target_sub.faculty_id else faculty_profile.id
                    new_slot = Timetable(
                        subject_id=target_sub.id,
                        faculty_id=target_faculty_id,
                        camera_id=cam1.id if cam1 else None,
                        day_of_week=day,
                        period_number=p_num,
                        start_time=s_time,
                        end_time=e_time,
                        classroom="Room 302",
                        section=section_name,
                        batch_year="2023-2027",
                        is_recurring=True,
                        is_active=True
                    )
                    db.add(new_slot)

    try:
        db.commit()
        logger.info("Administrator baseline and timetable schedule synchronized successfully.")
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to seed database state: {exc}")

