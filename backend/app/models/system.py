from sqlalchemy import Column, String, Text, Boolean
from app.core.database import Base
from app.models.base import TimestampMixin

class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"

    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    is_encrypted = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<SystemSetting {self.key}>"
