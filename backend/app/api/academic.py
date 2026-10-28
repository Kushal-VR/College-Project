from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.academic import Student, Faculty, Subject, Enrollment
from app.models.timetable import Timetable
from app.schemas.academic import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    FacultyCreate,
    FacultyUpdate,
    FacultyResponse,
    SubjectCreate,
    SubjectUpdate,
    SubjectResponse,
    EnrollmentCreate,
    EnrollmentResponse,
    ClassroomOverviewResponse,
    ClassroomTeacherInfo,
    ClassroomSubjectInfo,
    ClassroomTimeSlot,
    ClassroomTimetableSlot,
    ClassroomStudentItem,
    ClassroomAddStudentRequest,
)
from app.api.deps import get_current_user, require_admin, require_faculty_or_admin
from app.core.logging import logger

router = APIRouter(prefix="/academic", tags=["Academic & Student Management"])

# ==============================================================================
# STUDENTS ENDPOINTS
# ==============================================================================

@router.get("/students", response_model=List[StudentResponse], summary="List All Students")
def list_students(
    department: Optional[str] = None,
    semester: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve students with optional department, semester, and search query filters."""
    query = db.query(Student).join(User)
    
    if department:
        query = query.filter(Student.department == department)
    if semester:
        query = query.filter(Student.semester == semester)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Student.student_id.ilike(search_fmt)) |
            (User.full_name.ilike(search_fmt)) |
            (User.email.ilike(search_fmt))
        )
        
    students = query.order_by(Student.student_id.asc()).all()
    return students

@router.post("/students", response_model=StudentResponse, status_code=status.HTTP_201_CREATED, summary="Create Student")
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_faculty_or_admin),
):
    """Create student user account and associated student profile atomically."""
    # Check duplicate email
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )
        
    # Check duplicate student roll number / ID
    if db.query(Student).filter(Student.student_id == payload.student_id.upper()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student with ID '{payload.student_id}' already exists.",
        )
        
    try:
        # Create base user
        new_user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            hashed_password=get_password_hash(payload.password),
            role=UserRole.STUDENT,
            phone_number=payload.phone_number,
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        db.flush()  # Populates new_user.id
        
        # Create student profile
        new_student = Student(
            user_id=new_user.id,
            student_id=payload.student_id.upper(),
            department=payload.department,
            batch_year=payload.batch_year,
            semester=payload.semester,
            section=payload.section,
            photo_url=payload.photo_url,
            biometric_enrolled=False,
            biometric_face_count=0,
        )
        db.add(new_student)
        db.commit()
        db.refresh(new_student)
        
        logger.info(f"Student created successfully: {new_student.student_id} ({new_user.email})")
        return new_student
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to create student: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create student record.",
        )

@router.get("/students/{student_id}", response_model=StudentResponse, summary="Get Student By ID")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch single student profile by internal database ID."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} was not found.",
        )
    return student

@router.put("/students/{student_id}", response_model=StudentResponse, summary="Update Student")
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update student academic or contact details."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} was not found.",
        )
        
    if payload.department is not None:
        student.department = payload.department
    if payload.batch_year is not None:
        student.batch_year = payload.batch_year
    if payload.semester is not None:
        student.semester = payload.semester
    if payload.section is not None:
        student.section = payload.section
    if payload.photo_url is not None:
        student.photo_url = payload.photo_url
        
    # Update linked User fields
    if payload.full_name is not None:
        student.user.full_name = payload.full_name
    if payload.phone_number is not None:
        student.user.phone_number = payload.phone_number
    if payload.is_active is not None:
        student.user.is_active = payload.is_active
        
    db.commit()
    db.refresh(student)
    logger.info(f"Student updated: {student.student_id}")
    return student

@router.delete("/students/{student_id}", summary="Delete Student")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_faculty_or_admin),
):
    """Delete student and linked user account."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID {student_id} was not found.",
        )
    
    user = student.user
    db.delete(student)
    if user:
        db.delete(user)
    db.commit()
    logger.info(f"Student deleted: ID {student_id}")
    return {"success": True, "message": "Student record deleted successfully."}

# ==============================================================================
# FACULTY ENDPOINTS
# ==============================================================================

@router.get("/faculty", response_model=List[FacultyResponse], summary="List Faculty")
def list_faculty(
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all faculty members."""
    query = db.query(Faculty).join(User)
    if department:
        query = query.filter(Faculty.department == department)
    return query.order_by(User.full_name.asc()).all()

@router.post("/faculty", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED, summary="Create Faculty")
def create_faculty(
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create new faculty member."""
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail=f"Email '{payload.email}' already exists.")
    if db.query(Faculty).filter(Faculty.employee_id == payload.employee_id.upper()).first():
        raise HTTPException(status_code=400, detail=f"Employee ID '{payload.employee_id}' already exists.")
        
    try:
        new_user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            hashed_password=get_password_hash(payload.password),
            role=UserRole.FACULTY,
            phone_number=payload.phone_number,
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        db.flush()
        
        new_faculty = Faculty(
            user_id=new_user.id,
            employee_id=payload.employee_id.upper(),
            department=payload.department,
            designation=payload.designation,
            office_location=payload.office_location,
        )
        db.add(new_faculty)
        db.commit()
        db.refresh(new_faculty)
        return new_faculty
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create faculty: {exc}")

@router.delete("/faculty/{faculty_id}", summary="Delete Faculty")
def delete_faculty(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete faculty member and linked user login account."""
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")
    user = faculty.user
    db.delete(faculty)
    if user:
        db.delete(user)
    db.commit()
    return {"success": True, "message": "Faculty member and login deleted successfully."}

# ==============================================================================
# SUBJECTS ENDPOINTS
# ==============================================================================

@router.get("/subjects", response_model=List[SubjectResponse], summary="List Subjects")
def list_subjects(
    department: Optional[str] = None,
    semester: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List academic subjects."""
    query = db.query(Subject)
    if department:
        query = query.filter(Subject.department == department)
    if semester:
        query = query.filter(Subject.semester == semester)
    return query.order_by(Subject.code.asc()).all()

@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED, summary="Create Subject")
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new academic subject / course."""
    if db.query(Subject).filter(Subject.code == payload.code.upper()).first():
        raise HTTPException(status_code=400, detail=f"Subject code '{payload.code}' already exists.")
        
    new_sub = Subject(
        code=payload.code.upper(),
        name=payload.name,
        department=payload.department,
        semester=payload.semester,
        credits=payload.credits,
        faculty_id=payload.faculty_id,
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub

@router.delete("/subjects/{subject_id}", summary="Delete Subject")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete academic subject course."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    db.delete(subject)
    db.commit()
    return {"success": True, "message": "Subject deleted successfully."}

# ==============================================================================
# ENROLLMENTS ENDPOINTS
# ==============================================================================

@router.get("/enrollments", response_model=List[EnrollmentResponse], summary="List Course Enrollments")
def list_enrollments(
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List student course enrollments."""
    query = db.query(Enrollment)
    if subject_id:
        query = query.filter(Enrollment.subject_id == subject_id)
    if student_id:
        query = query.filter(Enrollment.student_id == student_id)
    return query.all()

@router.post("/enrollments", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED, summary="Enroll Student in Subject")
def enroll_student(
    payload: EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_faculty_or_admin),
):
    """Enroll a student into a subject course."""
    # Check if student exists
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    # Check if subject exists
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
        
    # Check duplicate enrollment
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == payload.student_id,
        Enrollment.subject_id == payload.subject_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this subject.")
        
    enrollment = Enrollment(
        student_id=payload.student_id,
        subject_id=payload.subject_id,
        academic_year=payload.academic_year,
        status="ENROLLED",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment

# ==============================================================================
# MY CLASSROOM ENDPOINTS (CLASS TEACHER COHORT VIEW)
# ==============================================================================

@router.get("/classroom/overview", response_model=ClassroomOverviewResponse, summary="Get Monitored Classroom Overview")
def get_classroom_overview(
    section: Optional[str] = None,
    semester: Optional[int] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    My Classroom Portal Endpoint:
    Provides the Class Teacher with a comprehensive view of:
    - Their monitored classroom (cohort)
    - Teachers teaching this class and the subjects they handle
    - Weekly timetable and period time slots
    - Enrolled students and student addition options
    """
    # 1. Determine which class/section the current user monitors
    faculty_profile = None
    if current_user.role == UserRole.FACULTY:
        faculty_profile = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()

    # Determine targeted section and semester
    target_section = section
    target_semester = semester
    target_department = department

    if not target_section:
        if faculty_profile and faculty_profile.class_teacher_section:
            target_section = faculty_profile.class_teacher_section
        else:
            target_section = "A"

    if not target_semester:
        if faculty_profile and faculty_profile.class_teacher_semester:
            target_semester = faculty_profile.class_teacher_semester
        else:
            target_semester = 6

    if not target_department:
        if faculty_profile and faculty_profile.department:
            target_department = faculty_profile.department
        else:
            target_department = "Computer Science"

    # Identify class teacher for this section
    class_teacher_faculty = (
        db.query(Faculty)
        .filter(
            Faculty.class_teacher_section == target_section,
            Faculty.is_class_teacher == True
        )
        .first()
    )
    if not class_teacher_faculty and faculty_profile and faculty_profile.is_class_teacher:
        class_teacher_faculty = faculty_profile

    # 2. Query Timetable for this section
    slots = (
        db.query(Timetable)
        .filter(Timetable.section == target_section, Timetable.is_active == True)
        .order_by(Timetable.day_of_week.asc(), Timetable.period_number.asc())
        .all()
    )

    days_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    grid = {d: [] for d in days_order}

    # Distinct teachers and subjects taking classes for this section
    teachers_map = {}
    subjects_map = {}

    for s in slots:
        slot_item = ClassroomTimetableSlot(
            id=s.id,
            period_number=s.period_number,
            start_time=s.start_time,
            end_time=s.end_time,
            subject_code=s.subject.code if s.subject else None,
            subject_name=s.subject.name if s.subject else None,
            classroom=s.classroom,
            teacher_name=s.faculty.user.full_name if s.faculty and s.faculty.user else None,
            teacher_email=s.faculty.user.email if s.faculty and s.faculty.user else None,
            day_of_week=s.day_of_week,
            is_recurring=s.is_recurring,
        )
        if s.day_of_week in grid:
            grid[s.day_of_week].append(slot_item)

        if s.faculty:
            f = s.faculty
            if f.id not in teachers_map:
                teachers_map[f.id] = {
                    "faculty": f,
                    "subjects": set(),
                    "periods_count": 0
                }
            if s.subject:
                teachers_map[f.id]["subjects"].add(f"{s.subject.code} - {s.subject.name}")
            teachers_map[f.id]["periods_count"] += 1

        if s.subject:
            sub = s.subject
            if sub.id not in subjects_map:
                subjects_map[sub.id] = sub

    # Also include any subjects designated for this semester and department
    semester_subjects = (
        db.query(Subject)
        .filter(
            Subject.department == target_department,
            Subject.semester == target_semester
        )
        .all()
    )
    for sub in semester_subjects:
        if sub.id not in subjects_map:
            subjects_map[sub.id] = sub
        if sub.faculty:
            f = sub.faculty
            if f.id not in teachers_map:
                teachers_map[f.id] = {
                    "faculty": f,
                    "subjects": set(),
                    "periods_count": 0
                }
            teachers_map[f.id]["subjects"].add(f"{sub.code} - {sub.name}")

    # Ensure class teacher is present in teachers list
    if class_teacher_faculty and class_teacher_faculty.id not in teachers_map:
        teachers_map[class_teacher_faculty.id] = {
            "faculty": class_teacher_faculty,
            "subjects": set([f"{s.code} - {s.name}" for s in class_teacher_faculty.subjects]) if class_teacher_faculty.subjects else set(["Class Teacher Cohort Monitor"]),
            "periods_count": 0
        }

    teachers_list = []
    for f_id, data in teachers_map.items():
        f = data["faculty"]
        is_ct = (f.id == class_teacher_faculty.id) if class_teacher_faculty else False
        teachers_list.append(
            ClassroomTeacherInfo(
                id=f.id,
                employee_id=f.employee_id,
                name=f.user.full_name if f.user else "Faculty",
                email=f.user.email if f.user else "",
                phone_number=f.user.phone_number if f.user else None,
                department=f.department,
                designation=f.designation,
                office_location=f.office_location,
                is_class_teacher=is_ct,
                subjects_taught=sorted(list(data["subjects"])),
                weekly_periods=data["periods_count"]
            )
        )
    # Sort teachers: class teacher first, then by name
    teachers_list.sort(key=lambda t: (not t.is_class_teacher, t.name))

    subjects_list = []
    for sub_id, sub in subjects_map.items():
        subjects_list.append(
            ClassroomSubjectInfo(
                id=sub.id,
                code=sub.code,
                name=sub.name,
                department=sub.department,
                semester=sub.semester,
                credits=sub.credits,
                faculty_id=sub.faculty_id,
                faculty_name=sub.faculty.user.full_name if sub.faculty and sub.faculty.user else None
            )
        )
    subjects_list.sort(key=lambda s: s.code)

    # 3. Standard periods
    time_slots = [
        ClassroomTimeSlot(period=1, start_time="09:00", end_time="10:00", label="Period 1 (09:00 - 10:00)"),
        ClassroomTimeSlot(period=2, start_time="10:00", end_time="11:00", label="Period 2 (10:00 - 11:00)"),
        ClassroomTimeSlot(period=3, start_time="11:15", end_time="12:15", label="Period 3 (11:15 - 12:15)"),
        ClassroomTimeSlot(period=4, start_time="13:00", end_time="14:00", label="Period 4 (13:00 - 14:00)"),
        ClassroomTimeSlot(period=5, start_time="14:00", end_time="15:00", label="Period 5 (14:00 - 15:00)"),
        ClassroomTimeSlot(period=6, start_time="15:00", end_time="16:00", label="Period 6 (15:00 - 16:00)"),
    ]

    # 4. Students belonging to this section
    students_query = (
        db.query(Student)
        .join(User)
        .filter(Student.section == target_section)
    )
    if target_semester:
        students_query = students_query.filter(Student.semester == target_semester)
    students_db = students_query.order_by(Student.student_id.asc()).all()

    students_list = []
    for st in students_db:
        sub_names = [e.subject.name for e in st.enrollments if e.subject]
        students_list.append(
            ClassroomStudentItem(
                id=st.id,
                student_id=st.student_id,
                full_name=st.user.full_name if st.user else "",
                email=st.user.email if st.user else "",
                phone_number=st.user.phone_number if st.user else None,
                department=st.department,
                semester=st.semester,
                section=st.section,
                batch_year=st.batch_year,
                biometric_enrolled=st.biometric_enrolled,
                biometric_face_count=st.biometric_face_count,
                photo_url=st.photo_url,
                enrolled_subjects_count=len(st.enrollments),
                enrolled_subject_names=sub_names
            )
        )

    # Available sections: aggregate from students, timetables, and faculty
    student_secs = [s[0] for s in db.query(Student.section).distinct().all() if s[0]]
    timetable_secs = [s[0] for s in db.query(Timetable.section).distinct().all() if s[0]]
    faculty_secs = [s[0] for s in db.query(Faculty.class_teacher_section).distinct().all() if s[0]]
    available_sections = sorted(list(set(student_secs + timetable_secs + faculty_secs + ["A", "B"])))

    classroom_name = slots[0].classroom if slots else "Room 302"

    return ClassroomOverviewResponse(
        monitored_class={
            "is_class_teacher": True if class_teacher_faculty else False,
            "class_teacher_name": class_teacher_faculty.user.full_name if class_teacher_faculty and class_teacher_faculty.user else "Not Assigned",
            "class_teacher_email": class_teacher_faculty.user.email if class_teacher_faculty and class_teacher_faculty.user else "",
            "class_teacher_employee_id": class_teacher_faculty.employee_id if class_teacher_faculty else "",
            "department": target_department,
            "semester": target_semester,
            "section": target_section,
            "batch_year": "2023-2027",
            "classroom": classroom_name
        },
        available_sections=available_sections,
        available_semesters=[1, 2, 3, 4, 5, 6, 7, 8],
        stats={
            "total_students": len(students_list),
            "total_subjects": len(subjects_list),
            "total_teachers": len(teachers_list),
            "total_weekly_periods": len(slots)
        },
        teachers=teachers_list,
        subjects=subjects_list,
        time_slots=time_slots,
        timetable_grid=grid,
        students=students_list
    )

@router.post("/classroom/students", response_model=ClassroomStudentItem, status_code=status.HTTP_201_CREATED, summary="Add Student to Monitored Classroom")
def add_student_to_classroom(
    payload: ClassroomAddStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_faculty_or_admin),
):
    """Add a new student directly into the monitored classroom and enroll them in class subjects."""
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail=f"User with email '{payload.email}' already exists.")
    if db.query(Student).filter(Student.student_id == payload.student_id.upper()).first():
        raise HTTPException(status_code=400, detail=f"Student ID '{payload.student_id}' already exists.")

    sec = payload.section or "A"
    sem = payload.semester or 6
    dept = payload.department or "Computer Science"
    batch = payload.batch_year or "2023-2027"

    try:
        new_user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            hashed_password=get_password_hash(payload.password),
            role=UserRole.STUDENT,
            phone_number=payload.phone_number,
            is_active=True,
            is_verified=True,
        )
        db.add(new_user)
        db.flush()

        new_student = Student(
            user_id=new_user.id,
            student_id=payload.student_id.upper(),
            department=dept,
            batch_year=batch,
            semester=sem,
            section=sec,
            biometric_enrolled=False,
            biometric_face_count=0
        )
        db.add(new_student)
        db.flush()

        enrolled_names = []
        if payload.auto_enroll_subjects:
            class_subjects = (
                db.query(Subject)
                .join(Timetable, Timetable.subject_id == Subject.id)
                .filter(Timetable.section == sec, Timetable.is_active == True)
                .distinct()
                .all()
            )
            for sub in class_subjects:
                enrollment = Enrollment(
                    student_id=new_student.id,
                    subject_id=sub.id,
                    academic_year="2026-2027",
                    status="ENROLLED"
                )
                db.add(enrollment)
                enrolled_names.append(sub.name)

        db.commit()
        db.refresh(new_student)

        return ClassroomStudentItem(
            id=new_student.id,
            student_id=new_student.student_id,
            full_name=new_user.full_name,
            email=new_user.email,
            phone_number=new_user.phone_number,
            department=new_student.department,
            semester=new_student.semester,
            section=new_student.section,
            batch_year=new_student.batch_year,
            biometric_enrolled=new_student.biometric_enrolled,
            biometric_face_count=new_student.biometric_face_count,
            photo_url=new_student.photo_url,
            enrolled_subjects_count=len(enrolled_names),
            enrolled_subject_names=enrolled_names
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to add student to classroom: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to add student: {exc}")

