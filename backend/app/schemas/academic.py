from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserResponse

# ----------------- STUDENT SCHEMAS -----------------
class StudentBase(BaseModel):
    student_id: str
    department: str
    batch_year: str
    semester: int = 1
    section: str = "A"
    photo_url: Optional[str] = None

class StudentCreate(StudentBase):
    email: str
    full_name: str
    password: str = "student123"
    phone_number: Optional[str] = None

class StudentUpdate(BaseModel):
    department: Optional[str] = None
    batch_year: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    photo_url: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

class StudentResponse(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    biometric_enrolled: bool
    biometric_face_count: int
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None

# ----------------- FACULTY SCHEMAS -----------------
class FacultyBase(BaseModel):
    employee_id: str
    department: str
    designation: str = "Assistant Professor"
    office_location: Optional[str] = None

class FacultyCreate(FacultyBase):
    email: str
    full_name: str
    password: str = "faculty123"
    phone_number: Optional[str] = None

class FacultyUpdate(BaseModel):
    department: Optional[str] = None
    designation: Optional[str] = None
    office_location: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None

class FacultyResponse(FacultyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None

# ----------------- SUBJECT SCHEMAS -----------------
class SubjectBase(BaseModel):
    code: str
    name: str
    department: str
    semester: int = 1
    credits: int = 3
    faculty_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    credits: Optional[int] = None
    faculty_id: Optional[int] = None

class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    faculty: Optional[FacultyResponse] = None

# ----------------- ENROLLMENT SCHEMAS -----------------
class EnrollmentCreate(BaseModel):
    student_id: int
    subject_id: int
    academic_year: str = "2026-2027"

class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    subject_id: int
    academic_year: str
    status: str
    created_at: datetime
    student: Optional[StudentResponse] = None
    subject: Optional[SubjectResponse] = None
