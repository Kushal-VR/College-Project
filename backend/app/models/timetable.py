import enum
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Date, Time
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from app.models.base import TimestampMixin

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LEFT_EARLY = "LEFT_EARLY"
    FLAGGED_OCCLUDED_EXIT = "FLAGGED_OCCLUDED_EXIT"
    PARTIAL = "PARTIAL"

class VerificationMethod(str, enum.Enum):
    FACE_RECOGNITION = "FACE_RECOGNITION"
    ID_CARD_BARCODE = "ID_CARD_BARCODE"
    MANUAL = "MANUAL"

class SessionStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Timetable(Base, TimestampMixin):
    __tablename__ = "timetables"

    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday, etc.
    period_number = Column(Integer, default=1, nullable=False)  # Period 1 to 6
    start_time = Column(String(10), nullable=False)  # "13:00"
    end_time = Column(String(10), nullable=False)    # "14:00"
    classroom = Column(String(100), default="Room 302", nullable=False)
    
    section = Column(String(10), default="A", nullable=False)
    batch_year = Column(String(20), default="2023-2027", nullable=False)
    
    # Support single-date specific class (e.g. 1-2 PM on a specific date) or recurring weekly
    is_recurring = Column(Boolean, default=True, nullable=False)
    single_date = Column(String(20), nullable=True)  # YYYY-MM-DD if single date
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    subject = relationship("Subject", lazy="joined")
    faculty = relationship("Faculty", lazy="joined")
    camera = relationship("Camera", lazy="joined")
    sessions = relationship("ClassSession", back_populates="timetable", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Timetable {self.subject_id} {self.day_of_week} {self.start_time}-{self.end_time}>"

class ClassSession(Base, TimestampMixin):
    __tablename__ = "class_sessions"

    timetable_id = Column(Integer, ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    status = Column(String(20), default=SessionStatus.IN_PROGRESS.value, nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    email_report_sent = Column(Boolean, default=False, nullable=False)

    # Relationships
    timetable = relationship("Timetable", back_populates="sessions", lazy="joined")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ClassSession #{self.id} Timetable:{self.timetable_id} Date:{self.date} Status:{self.status}>"

class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"

    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    period_number = Column(Integer, default=1, nullable=False, index=True)  # Period 1 to 6
    
    in_time = Column(DateTime, nullable=True)
    out_time = Column(DateTime, nullable=True)
    total_minutes_present = Column(Float, default=0.0, nullable=False)
    presence_ratio = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0 (minutes_present / duration)
    
    status = Column(String(30), default=AttendanceStatus.ABSENT.value, nullable=False, index=True)
    verification_method = Column(String(30), default=VerificationMethod.FACE_RECOGNITION.value, nullable=False)
    
    photo_proof_url = Column(String(500), nullable=True)  # Populated if flagged or snapshot stored
    confidence_score = Column(Float, default=0.0, nullable=False)
    email_notified = Column(Boolean, default=False, nullable=False)
    remarks = Column(String(255), nullable=True)

    # Relationships
    session = relationship("ClassSession", back_populates="attendance_records", lazy="joined")
    student = relationship("Student", lazy="joined")

    def __repr__(self):
        return f"<AttendanceRecord Student:{self.student_id} Status:{self.status} PresentMins:{self.total_minutes_present}>"
