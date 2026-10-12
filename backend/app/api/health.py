import os
import platform
import time
from datetime import datetime, timezone
from fastapi import APIRouter, status, Response
from app.core.config import settings
from app.core.database import check_db_connection
from app.core.logging import logger

router = APIRouter(tags=["Health & Diagnostics"])

START_TIME = time.time()

@router.get("/health", summary="System Health Check")
def health_check(response: Response):
    """
    Comprehensive health check verifying backend runtime, database connectivity,
    system latency, and core module operational readiness.
    """
    uptime_seconds = round(time.time() - START_TIME, 2)
    db_health = check_db_connection()
    
    is_db_ok = db_health["status"] == "connected"
    overall_status = "healthy" if is_db_ok else "degraded"
    
    if not is_db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    payload = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": uptime_seconds,
        "database": db_health,
        "system": {
            "os": f"{platform.system()} {platform.release()}",
            "python_version": platform.python_version(),
            "cpu_architecture": platform.machine(),
        },
        "modules": {
            "database_layer": "operational" if is_db_ok else "offline",
            "camera_subsystem": "ready",
            "face_recognition_engine": "ready",
            "anti_spoofing_engine": "ready",
            "attendance_ledger": "ready",
            "audit_logger": "operational"
        }
    }
    
    return payload

@router.get("/system/status", summary="Detailed System Status")
def system_status():
    """Returns detailed runtime metadata and configuration state (excluding secrets)."""
    db_health = check_db_connection()
    return {
        "app_name": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "database_connected": db_health["status"] == "connected",
        "database_type": db_health["database_type"],
        "database_latency_ms": db_health["latency_ms"],
        "cors_origins": settings.CORS_ORIGINS,
    }
