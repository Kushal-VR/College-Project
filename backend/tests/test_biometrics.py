import cv2
import json
import numpy as np
from app.models.academic import Student
from app.models.biometrics import StudentFaceEmbedding
from app.services.biometric_service import (
    extract_face_embedding,
    compute_cosine_similarity,
    check_anti_spoofing,
    detect_and_decode_id_card
)

def test_extract_face_embedding_properties():
    # Synthetic face image with gradients
    img = np.zeros((128, 128, 3), dtype=np.uint8)
    cv2.circle(img, (64, 64), 30, (200, 200, 200), -1)
    cv2.circle(img, (50, 50), 5, (20, 20, 20), -1)  # Left eye
    cv2.circle(img, (78, 50), 5, (20, 20, 20), -1)  # Right eye

    emb = extract_face_embedding(img)
    assert len(emb) == 128
    
    # Check L2 unit norm
    norm = np.linalg.norm(np.array(emb))
    assert abs(norm - 1.0) < 1e-4

def test_cosine_similarity_calculation():
    vec_a = [1.0] + [0.0] * 127
    vec_b = [1.0] + [0.0] * 127
    vec_c = [0.0] * 127 + [1.0]

    sim_identical = compute_cosine_similarity(vec_a, vec_b)
    sim_orthogonal = compute_cosine_similarity(vec_a, vec_c)

    assert abs(sim_identical - 1.0) < 1e-5
    assert abs(sim_orthogonal - 0.0) < 1e-5

def test_anti_spoofing_detection():
    # Completely flat synthetic white square (simulating a flat blank piece of paper)
    flat_paper = np.ones((100, 100, 3), dtype=np.uint8) * 240
    is_spoof, liveness, details = check_anti_spoofing(flat_paper)
    
    assert is_spoof is True
    assert liveness < 0.50
    assert "Low texture variance" in details

def test_student_face_embedding_database_persistence(db):
    student = db.query(Student).first()
    assert student is not None

    synthetic_vec = [0.05] * 128
    emb_rec = StudentFaceEmbedding(
        student_id=student.id,
        embedding=json.dumps(synthetic_vec),
        quality_score=0.92,
        liveness_score=0.88,
        is_primary=True
    )
    db.add(emb_rec)
    student.biometric_enrolled = True
    student.biometric_face_count += 1
    db.commit()

    loaded = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == student.id).first()
    assert loaded is not None
    assert loaded.quality_score == 0.92
    assert student.biometric_enrolled is True
