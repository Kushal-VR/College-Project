import enum
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from app.models.base import TimestampMixin

class SecurityEventType(str, enum.Enum):
    SPOOF_DETECTED = "SPOOF_DETECTED"
    OCCLUDED_EXIT_FLAGGED = "OCCLUDED_EXIT_FLAGGED"
    BARCODE_FALLBACK_USED = "BARCODE_FALLBACK_USED"
    UNAUTHORIZED_ENTRY = "UNAUTHORIZED_ENTRY"

class StudentFaceEmbedding(Base, TimestampMixin):
    __tablename__ = "student_face_embeddings"

    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_path = Column(String(500), nullable=True)
    embedding = Column(Text, nullable=False)  # JSON-serialized list of 128 float numbers
    quality_score = Column(Float, default=1.0, nullable=False)
    liveness_score = Column(Float, default=1.0, nullable=False)
    is_primary = Column(Boolean, default=True, nullable=False)

    # Relationship
    student = relationship("Student", backref="face_embeddings", lazy="joined")

    def __repr__(self):
        return f"<StudentFaceEmbedding Student:{self.student_id} Score:{self.quality_score}>"

class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String(50), default=SecurityEventType.SPOOF_DETECTED.value, nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    photo_proof_path = Column(String(500), nullable=True)  # Snapshot image file of the covered face or spoof event
    details = Column(Text, nullable=True)  # JSON or text details (e.g. silhouette shape, estimated direction)
    email_alert_sent = Column(Boolean, default=False, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    camera = relationship("Camera", lazy="joined")
    student = relationship("Student", lazy="joined")

    def __repr__(self):
        return f"<SecurityAuditLog {self.event_type} at {self.timestamp}>"
