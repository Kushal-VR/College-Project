from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class TimetableBase(BaseModel):
    subject_id: int = Field(..., description="Subject database ID")
    faculty_id: int = Field(..., description="Faculty database ID")
    camera_id: Optional[int] = Field(None, description="Optional linked camera ID")
    day_of_week: str = Field(..., examples=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
    period_number: int = Field(default=1, ge=1, le=8, description="Period slot 1 to 6")
    start_time: str = Field(..., examples=["09:00", "13:00", "14:00"], pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., examples=["10:00", "14:00", "15:00"], pattern=r"^\d{2}:\d{2}$")
    classroom: str = Field(default="Room 302")
    section: str = Field(default="A")
    batch_year: str = Field(default="2023-2027")
    is_recurring: bool = True
    single_date: Optional[str] = None

class TimetableCreate(TimetableBase):
    pass

class TimetableResponse(TimetableBase):
    id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    faculty_name: Optional[str] = None
    faculty_email: Optional[str] = None
    camera_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ClassSessionResponse(BaseModel):
    id: int
    timetable_id: int
    date: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    email_report_sent: bool
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    faculty_name: Optional[str] = None
    faculty_email: Optional[str] = None
    classroom: Optional[str] = None
    total_enrolled: int = 0
    present_count: int = 0
    absent_count: int = 0
    left_early_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class AttendanceRecordItem(BaseModel):
    id: int
    student_id: int
    roll_number: str
    student_name: str
    in_time: Optional[datetime] = None
    out_time: Optional[datetime] = None
    total_minutes_present: float
    presence_ratio: float
    status: str
    verification_method: str
    photo_proof_url: Optional[str] = None
    email_notified: bool
    remarks: Optional[str] = None

class ProcessFrameRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded frame from CCTV or webcam")
    camera_id: Optional[int] = None

class FrameEvent(BaseModel):
    type: str  # ENTRY, EXIT, OCCLUSION_EXIT, SPOOF_DETECTED, BARCODE_SCANNED
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    timestamp: str
    details: str
    photo_proof_url: Optional[str] = None

class ProcessFrameResponse(BaseModel):
    success: bool
    events: List[FrameEvent] = []
    currently_inside_count: int
    inside_students: List[str] = []  # Names or roll numbers

class StudentCumulativeStats(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    total_classes_held: int
    classes_attended: int
    classes_absent: int
    classes_left_early: int
    attendance_percentage: float
    low_attendance_warning: bool  # True if < 75%

class DayByDaySessionRecord(BaseModel):
    session_id: int
    date: str
    time_slot: str
    classroom: str
    present_count: int
    absent_count: int
    left_early_count: int
    attendance_rate: float
    email_sent: bool

class TeacherDashboardStats(BaseModel):
    teacher_id: int
    teacher_name: str
    teacher_email: str
    total_assigned_subjects: int
    active_sections: List[str]
    recent_sessions: List[DayByDaySessionRecord]
    cumulative_student_stats: List[StudentCumulativeStats]

class TakePeriodAttendanceRequest(BaseModel):
    timetable_id: int
    image_base64: str
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today
    period_number: Optional[int] = None

class TakePeriodAttendanceResponse(BaseModel):
    success: bool
    session_id: int
    period_number: int
    subject_name: str
    classroom: str
    date: str
    total_enrolled: int
    present_count: int
    absent_count: int
    recognized_faces: int
    barcodes_scanned: int
    message: str
    recognized_students: List[dict] = []
    all_detected_faces: List[dict] = []

class StudentPeriodAttendance(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    periods: dict  # {"1": "PRESENT", "2": "ABSENT", ...}
    total_attended_today: int

class ClassTeacherDailyLedgerResponse(BaseModel):
    date: str
    section: str
    semester: int
    department: str
    classroom: str
    period_headers: List[dict]  # [{"period": 1, "time": "09:00-10:00", "subject": "ML", "teacher": "Prof X"}]
    students: List[StudentPeriodAttendance]

class StudentSubjectAttendanceDetail(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    classes_held: int
    classes_attended: int
    percentage: float

class StudentSubjectMatrixItem(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    department: str
    section: str
    semester: int
    subjects: List[StudentSubjectAttendanceDetail]
    overall_held: int
    overall_attended: int
    overall_percentage: float
    has_shortage: bool  # < 75%

