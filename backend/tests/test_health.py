import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    """Verify that root endpoint responds with status 200 and project metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Smart AI-Based CCTV Attendance Ledger" in data["message"]
    assert data["status"] == "online"
    assert "health_check" in data

def test_health_check_operational():
    """Verify that /api/health returns 200 and operational subsystem statuses."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert data["database"]["status"] == "connected"
    assert data["database"]["latency_ms"] >= 0
    assert "system" in data
    assert "modules" in data
    assert data["modules"]["database_layer"] == "operational"
    assert data["modules"]["camera_subsystem"] == "ready"
    assert data["modules"]["face_recognition_engine"] == "ready"

def test_system_status():
    """Verify that /api/system/status returns configuration and connectivity state."""
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()
    assert data["database_connected"] is True
    assert "uptime_seconds" in data
    assert "cors_origins" in data

def test_health_check_database_failure_handling():
    """Verify that /api/health gracefully returns 503 degraded status when database is disconnected."""
    with patch("app.api.health.check_db_connection") as mock_db_check:
        mock_db_check.return_value = {
            "status": "disconnected",
            "latency_ms": 15.2,
            "database_type": "unknown",
            "error": "Connection to PostgreSQL host refused."
        }
        response = client.get("/api/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"]["status"] == "disconnected"
        assert data["modules"]["database_layer"] == "offline"
