import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db, Base, engine
from app.core.seed import seed_default_users
from app.services.email_service import store_otp

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()

def get_admin_token() -> str:
    store_otp("admin@attendance.edu", "777777", purpose="Login 2FA Verification")
    res = client.post(
        "/api/auth/login",
        json={"email": "admin@attendance.edu", "password": "admin123", "otp": "777777"}
    )
    return res.json()["access_token"]

def get_student_token() -> str:
    store_otp("student.kushal@university.edu", "888888", purpose="Login 2FA Verification")
    res = client.post(
        "/api/auth/login",
        json={"email": "student.kushal@university.edu", "password": "student123", "otp": "888888"}
    )
    return res.json()["access_token"]

def test_create_and_list_student():
    """Verify admin can create a new student and student appears in list."""
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    unique_id = uuid.uuid4().hex[:6].upper()
    student_id = f"CS-{unique_id}"
    email = f"student_{unique_id.lower()}@university.edu"

    # Create Student
    payload = {
        "email": email,
        "full_name": "Test Student",
        "student_id": student_id,
        "department": "Computer Science",
        "batch_year": "2023-2027",
        "semester": 6,
        "section": "A",
        "password": "student123",
        "phone_number": "+1-555-0199"
    }
    create_res = client.post("/api/academic/students", json=payload, headers=headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["student_id"] == student_id
    assert created_data["user"]["email"] == email

    # List Students
    list_res = client.get("/api/academic/students", headers=headers)
    assert list_res.status_code == 200
    students = list_res.json()
    assert any(s["student_id"] == student_id for s in students)

def test_duplicate_student_id_rejected():
    """Verify system rejects creating student with duplicate roll number."""
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    unique_id = uuid.uuid4().hex[:6].upper()
    student_id = f"CS-DUP-{unique_id}"

    payload = {
        "email": f"dup1_{unique_id.lower()}@university.edu",
        "full_name": "First Student",
        "student_id": student_id,
        "department": "Computer Science",
        "batch_year": "2023-2027",
        "semester": 6,
        "section": "A",
        "password": "student123"
    }
    res1 = client.post("/api/academic/students", json=payload, headers=headers)
    assert res1.status_code == 201

    # Attempt second student with same student_id
    payload2 = {
        "email": f"dup2_{unique_id.lower()}@university.edu",
        "full_name": "Second Student",
        "student_id": student_id,
        "department": "Computer Science",
        "batch_year": "2023-2027",
        "semester": 6,
        "section": "A",
        "password": "student123"
    }
    res2 = client.post("/api/academic/students", json=payload2, headers=headers)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

def test_unauthorized_student_creation_rejected():
    """Verify non-admin users cannot create students."""
    student_token = get_student_token()
    headers = {"Authorization": f"Bearer {student_token}"}

    payload = {
        "email": "hacker@domain.com",
        "full_name": "Unauthorized User",
        "student_id": "CS999",
        "department": "CS",
        "batch_year": "2026",
        "password": "pwd"
    }
    res = client.post("/api/academic/students", json=payload, headers=headers)
    assert res.status_code == 403

def test_subject_creation_and_enrollment():
    """Verify creating a subject and enrolling a student."""
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}

    unique_code = f"CS-{uuid.uuid4().hex[:4].upper()}"

    # 1. Create Subject
    sub_payload = {
        "code": unique_code,
        "name": "Computer Vision & AI",
        "department": "Computer Science",
        "semester": 6,
        "credits": 4
    }
    sub_res = client.post("/api/academic/subjects", json=sub_payload, headers=headers)
    assert sub_res.status_code == 201
    subject_id = sub_res.json()["id"]

    # 2. Get Student ID
    students_res = client.get("/api/academic/students", headers=headers)
    student_id = students_res.json()[0]["id"]

    # 3. Enroll Student
    enroll_payload = {
        "student_id": student_id,
        "subject_id": subject_id,
        "academic_year": "2026-2027"
    }
    enroll_res = client.post("/api/academic/enrollments", json=enroll_payload, headers=headers)
    assert enroll_res.status_code == 201
    assert enroll_res.json()["status"] == "ENROLLED"

    # 4. Duplicate Enrollment Rejection
    dup_enroll = client.post("/api/academic/enrollments", json=enroll_payload, headers=headers)
    assert dup_enroll.status_code == 400
    assert "already enrolled" in dup_enroll.json()["detail"]
