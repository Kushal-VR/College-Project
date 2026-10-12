from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.academic import Student, Faculty, Subject, Enrollment
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
    current_user: User = Depends(require_admin),
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
