from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
import cv2

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.cctv import Camera, CameraStatus, CrossingDirection
from app.schemas.cctv import CameraCreate, CameraUpdate, CameraResponse, CameraTestResponse
from app.services.cctv_service import cctv_manager

router = APIRouter(prefix="/cctv", tags=["CCTV & Camera Management"])

@router.get("/cameras", response_model=List[CameraResponse])
def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all registered CCTV / IP camera streams."""
    cameras = db.query(Camera).order_by(Camera.id.asc()).all()
    # If no cameras exist, seed a default demo classroom camera
    if not cameras:
        default_cam = Camera(
            name="Classroom 302 Main Overhead CCTV",
            stream_url="demo",
            camera_type="RTSP",
            classroom="Room 302",
            crossing_direction=CrossingDirection.LEFT_TO_RIGHT_ENTRY.value,
            fps=25,
            resolution="1920x1080",
            is_active=True,
            last_status=CameraStatus.ONLINE.value,
            last_ping=datetime.now(timezone.utc)
        )
        db.add(default_cam)
        db.commit()
        db.refresh(default_cam)
        cameras = [default_cam]
    return cameras

@router.post("/cameras", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
def create_camera(
    cam_in: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add a new CCTV / RTSP / USB Webcam stream."""
    camera = Camera(
        name=cam_in.name,
        stream_url=cam_in.stream_url,
        camera_type=cam_in.camera_type,
        classroom=cam_in.classroom,
        crossing_direction=cam_in.crossing_direction,
        fps=cam_in.fps,
        resolution=cam_in.resolution,
        is_active=cam_in.is_active,
        last_status=CameraStatus.CONNECTING.value,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera

@router.get("/cameras/{camera_id}", response_model=CameraResponse)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get camera stream details."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return camera

@router.put("/cameras/{camera_id}", response_model=CameraResponse)
def update_camera(
    camera_id: int,
    cam_in: CameraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update camera configuration (e.g. crossing direction, URL, resolution)."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    update_data = cam_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(camera, field, val)

    db.commit()
    db.refresh(camera)
    return camera

@router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove a camera stream."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    db.delete(camera)
    db.commit()
    return None

@router.post("/cameras/{camera_id}/test", response_model=CameraTestResponse)
def test_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ping camera stream, test frame capture, and record latency & resolution diagnostics."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    test_result = cctv_manager.test_connection(camera)
    camera.last_status = test_result["status"]
    camera.last_ping = datetime.now(timezone.utc)
    db.commit()

    return CameraTestResponse(
        camera_id=camera.id,
        status=test_result["status"],
        latency_ms=test_result["latency_ms"],
        message=test_result["message"],
        frame_width=test_result.get("frame_width"),
        frame_height=test_result.get("frame_height"),
        fps_observed=test_result.get("fps_observed"),
    )

@router.get("/cameras/{camera_id}/stream")
def stream_camera(
    camera_id: int,
    db: Session = Depends(get_db)
):
    """Live MJPEG video stream with real-time HUD and directional boundary overlay."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    return StreamingResponse(
        cctv_manager.stream_video(camera),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/cameras/{camera_id}/snapshot")
def get_camera_snapshot(
    camera_id: int,
    db: Session = Depends(get_db)
):
    """Capture a single JPEG snapshot frame from the camera."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    frame = cctv_manager.generate_synthetic_frame(camera.name, camera.classroom, camera.crossing_direction)
    ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to encode frame")
    return Response(content=buffer.tobytes(), media_type="image/jpeg")
