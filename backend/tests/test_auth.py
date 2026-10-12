import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_default_users
from app.models.user import User, UserRole
from app.services.email_service import _OTP_CACHE, store_otp

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()

def test_login_triggers_otp_dispatch():
    """Verify that valid login credentials trigger OTP dispatch when 2FA is active."""
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["requires_otp"] is True
    assert data["email"] == "admin@attendance.edu"
    assert "OTP has been dispatched" in data["message"]

def test_login_with_valid_otp_completes_auth():
    """Verify that providing the cached OTP completes login and returns JWT."""
    # Pre-seed OTP in cache
    store_otp("admin@attendance.edu", "654321", purpose="Login 2FA Verification")

    response = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "admin123", "otp": "654321"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["requires_otp"] is False
    assert "access_token" in data
    assert data["user"]["email"] == "admin@attendance.edu"
    assert data["user"]["role"] == "ADMIN"

def test_login_with_invalid_otp_fails():
    """Verify that invalid OTP returns 401 Unauthorized."""
    store_otp("admin@attendance.edu", "112233", purpose="Login 2FA Verification")

    response = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "admin123", "otp": "999999"}
    )
    assert response.status_code == 401
    assert "Invalid or expired OTP" in response.json()["detail"]

def test_invalid_password_rejected():
    """Verify that invalid password returns 401 Unauthorized before OTP step."""
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_send_and_verify_otp_endpoint():
    """Verify independent send-otp and verify-otp routes."""
    # 1. Request OTP
    send_res = client.post(
        "/api/auth/send-otp",
        json={"email": "student.kushal@university.edu", "purpose": "email_verification"}
    )
    assert send_res.status_code == 200
    assert send_res.json()["success"] is True

    # Retrieve generated OTP from cache
    cached_otp = _OTP_CACHE["student.kushal@university.edu"][0]

    # 2. Verify OTP
    verify_res = client.post(
        "/api/auth/verify-otp",
        json={"email": "student.kushal@university.edu", "otp": cached_otp, "purpose": "email_verification"}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "student.kushal@university.edu"
    assert data["user"]["role"] == "STUDENT"

def test_rbac_admin_endpoint_enforcement():
    """Verify that student cannot access admin-only protected endpoints."""
    # Obtain student token via pre-seeded OTP
    store_otp("student.kushal@university.edu", "888888", purpose="Login 2FA Verification")
    stu_login = client.post(
        "/api/auth/login",
        json={"email": "student.kushal@university.edu", "password": "student123", "otp": "888888"}
    )
    stu_token = stu_login.json()["access_token"]

    # Student attempts Admin endpoint -> 403 Forbidden
    stu_attempt = client.get(
        "/api/auth/protected/admin-only",
        headers={"Authorization": f"Bearer {stu_token}"}
    )
    assert stu_attempt.status_code == 403

    # Admin attempts Admin endpoint -> 200 OK
    store_otp("admin@attendance.edu", "777777", purpose="Login 2FA Verification")
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "admin123", "otp": "777777"}
    )
    admin_token = admin_login.json()["access_token"]
    admin_attempt = client.get(
        "/api/auth/protected/admin-only",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_attempt.status_code == 200
