import enum
from sqlalchemy import Column, String, Boolean, Enum as SQLEnum
from app.core.database import Base
from app.models.base import TimestampMixin

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FACULTY = "FACULTY"
    STUDENT = "STUDENT"

class User(Base, TimestampMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.STUDENT, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    phone_number = Column(String(50), nullable=True)

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
