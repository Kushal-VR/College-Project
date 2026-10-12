from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CameraBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Classroom 302 High-Angle CCTV"])
    stream_url: str = Field(..., min_length=1, max_length=500, examples=["rtsp://admin:pass@192.168.1.100:554/stream1"])
    camera_type: str = Field(default="RTSP", examples=["RTSP", "WEBCAM", "HTTP_MJPEG"])
    classroom: str = Field(default="Room 302", min_length=2, max_length=100)
    crossing_direction: str = Field(default="LEFT_TO_RIGHT_ENTRY", examples=["LEFT_TO_RIGHT_ENTRY", "RIGHT_TO_LEFT_ENTRY"])
    fps: int = Field(default=25, ge=1, le=60)
    resolution: str = Field(default="1920x1080")
    is_active: bool = True

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    camera_type: Optional[str] = None
    classroom: Optional[str] = None
    crossing_direction: Optional[str] = None
    fps: Optional[int] = None
    resolution: Optional[str] = None
    is_active: Optional[bool] = None

class CameraResponse(CameraBase):
    id: int
    last_status: str
    last_ping: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CameraTestResponse(BaseModel):
    camera_id: int
    status: str  # ONLINE, OFFLINE, ERROR
    latency_ms: float
    message: str
    frame_width: Optional[int] = None
    frame_height: Optional[int] = None
    fps_observed: Optional[float] = None
