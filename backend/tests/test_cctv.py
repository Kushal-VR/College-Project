import pytest
from app.models.cctv import Camera, CameraStatus, CrossingDirection
from app.services.cctv_service import cctv_manager

def test_camera_model_creation(db):
    cam = Camera(
        name="Test Room 101 Camera",
        stream_url="demo",
        camera_type="RTSP",
        classroom="Room 101",
        crossing_direction=CrossingDirection.LEFT_TO_RIGHT_ENTRY.value,
        fps=30,
        resolution="1920x1080",
        is_active=True,
        last_status=CameraStatus.ONLINE.value
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)

    assert cam.id is not None
    assert cam.classroom == "Room 101"
    assert cam.crossing_direction == "LEFT_TO_RIGHT_ENTRY"

def test_cctv_connection_diagnostic():
    cam = Camera(
        name="Test Mock Cam",
        stream_url="demo",
        camera_type="RTSP",
        classroom="Room 101",
        crossing_direction="LEFT_TO_RIGHT_ENTRY"
    )
    result = cctv_manager.test_connection(cam)
    assert result["status"] == "ONLINE"
    assert result["latency_ms"] >= 0
    assert result["frame_width"] == 1280
    assert result["frame_height"] == 720

def test_cctv_offline_stream_diagnostic():
    cam = Camera(
        name="Invalid IP Cam",
        stream_url="rtsp://invalid_host_address:554/stream",
        camera_type="RTSP",
        classroom="Room 999",
        crossing_direction="LEFT_TO_RIGHT_ENTRY"
    )
    result = cctv_manager.test_connection(cam)
    assert result["status"] == "OFFLINE"
    assert "Unable to reach stream" in result["message"]

def test_synthetic_frame_generation():
    frame = cctv_manager.generate_synthetic_frame("Test Cam", "Room 302", "LEFT_TO_RIGHT_ENTRY")
    assert frame is not None
    assert frame.shape == (540, 960, 3)
