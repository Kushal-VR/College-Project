import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from app.core.database import Base
from app.models.base import TimestampMixin

class CrossingDirection(str, enum.Enum):
    LEFT_TO_RIGHT_ENTRY = "LEFT_TO_RIGHT_ENTRY"
    RIGHT_TO_LEFT_ENTRY = "RIGHT_TO_LEFT_ENTRY"
    TOP_TO_BOTTOM_ENTRY = "TOP_TO_BOTTOM_ENTRY"
    BOTTOM_TO_TOP_ENTRY = "BOTTOM_TO_TOP_ENTRY"

class CameraType(str, enum.Enum):
    RTSP = "RTSP"
    WEBCAM = "WEBCAM"
    HTTP_MJPEG = "HTTP_MJPEG"

class CameraStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    CONNECTING = "CONNECTING"
    ERROR = "ERROR"

class Camera(Base, TimestampMixin):
    __tablename__ = "cameras"

    name = Column(String(100), nullable=False)
    stream_url = Column(String(500), nullable=False)  # e.g. "rtsp://admin:pass@192.168.1.100:554/stream1" or "0"
    camera_type = Column(String(20), default=CameraType.RTSP.value, nullable=False)
    classroom = Column(String(100), nullable=False, index=True)  # e.g. "Room 302"
    crossing_direction = Column(String(50), default=CrossingDirection.LEFT_TO_RIGHT_ENTRY.value, nullable=False)
    fps = Column(Integer, default=25, nullable=False)
    resolution = Column(String(20), default="1920x1080", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_status = Column(String(20), default=CameraStatus.OFFLINE.value, nullable=False)
    last_ping = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Camera {self.name} ({self.classroom}) - {self.camera_type}>"
