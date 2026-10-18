import cv2
import json
import base64
import os
import threading
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from app.core.logging import logger

# Base directories and ONNX weights paths
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_WEIGHTS_DIR = os.path.join(_BASE_DIR, "models_weights")
_YUNET_PATH = os.path.join(_WEIGHTS_DIR, "face_detection_yunet_2023mar.onnx")
_SFACE_PATH = os.path.join(_WEIGHTS_DIR, "face_recognition_sface_2021dec.onnx")

_detector_lock = threading.Lock()
_recognizer_lock = threading.Lock()

# Initialize OpenCV Haar Cascade as fail-safe fallback
_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_qr_detector = cv2.QRCodeDetector()

# Initialize Barcode Detector if available
_barcode_detector = None
try:
    if hasattr(cv2, "barcode") and hasattr(cv2.barcode, "BarcodeDetector"):
        _barcode_detector = cv2.barcode.BarcodeDetector()
except Exception as e:
    logger.warning(f"OpenCV BarcodeDetector initialization note: {e}")

# Initialize Deep Learning Face Detector (YuNet)
_yunet_detector = None
try:
    if os.path.exists(_YUNET_PATH) and hasattr(cv2, "FaceDetectorYN"):
        _yunet_detector = cv2.FaceDetectorYN.create(
            model=_YUNET_PATH,
            config="",
            input_size=(320, 320),
            score_threshold=0.55,
            nms_threshold=0.3,
            top_k=5000
        )
        logger.info(f"Initialized OpenCV YuNet Deep Face Detector from {_YUNET_PATH}")
    else:
        logger.warning(f"YuNet ONNX model not found at {_YUNET_PATH}. Using Haar Cascade fallback.")
except Exception as exc:
    logger.error(f"Failed to initialize YuNet FaceDetectorYN: {exc}")

# Initialize Deep Learning Face Recognizer (SFace)
_sface_recognizer = None
try:
    if os.path.exists(_SFACE_PATH) and hasattr(cv2, "FaceRecognizerSF"):
        _sface_recognizer = cv2.FaceRecognizerSF.create(
            model=_SFACE_PATH,
            config=""
        )
        logger.info(f"Initialized OpenCV SFace Deep Face Recognizer from {_SFACE_PATH}")
    else:
        logger.warning(f"SFace ONNX model not found at {_SFACE_PATH}.")
except Exception as exc:
    logger.error(f"Failed to initialize SFace FaceRecognizerSF: {exc}")

# Threshold for SFace Cosine Similarity (OpenCV standard: 0.363; tuned safe threshold: 0.40)
SFACE_MATCH_THRESHOLD = 0.40


def decode_base64_image(image_base64: str) -> Optional[np.ndarray]:
    """Decode a base64 encoded image (with or without data URI prefix) into a BGR OpenCV image."""
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as exc:
        logger.error(f"Error decoding base64 image: {exc}")
        return None


def encode_image_to_base64(image: np.ndarray, quality: int = 85) -> str:
    """Encode an OpenCV BGR image to base64 JPEG string."""
    try:
        success, encoded_img = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            return ""
        b64_str = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"
    except Exception as exc:
        logger.error(f"Error encoding image to base64: {exc}")
        return ""


def detect_faces_detailed(image: np.ndarray) -> Tuple[List[Tuple[int, int, int, int]], Optional[np.ndarray]]:
    """
    Detect faces using OpenCV YuNet Deep Learning detector (primary) with Haar Cascade fallback.
    Returns:
        (bounding_boxes: List[(x, y, w, h)], raw_yunet_faces: Optional[np.ndarray])
        Each raw_yunet_face row contains [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rc, y_rc, x_lc, y_lc, score]
        which is used by SFace for affine facial landmark alignment.
    """
    if image is None or image.size == 0:
        return [], None

    img_h, img_w = image.shape[:2]

    # 1. Primary: YuNet Deep Learning Detector
    if _yunet_detector is not None:
        try:
            with _detector_lock:
                _yunet_detector.setInputSize((img_w, img_h))
                ret, raw_faces = _yunet_detector.detect(image)

            if ret and raw_faces is not None and len(raw_faces) > 0:
                # Filter valid detections and sort largest area first
                valid_boxes = []
                valid_raw = []
                for rf in raw_faces:
                    x = max(0, int(round(rf[0])))
                    y = max(0, int(round(rf[1])))
                    w = min(img_w - x, int(round(rf[2])))
                    h = min(img_h - y, int(round(rf[3])))
                    if w >= 25 and h >= 25:
                        valid_boxes.append((x, y, w, h))
                        valid_raw.append(rf)

                if valid_boxes:
                    # Sort descending by bounding box area (w * h)
                    indexed = sorted(enumerate(valid_boxes), key=lambda item: item[1][2] * item[1][3], reverse=True)
                    sorted_boxes = [item[1] for item in indexed]
                    sorted_raw = np.array([valid_raw[item[0]] for item in indexed], dtype=np.float32)
                    return sorted_boxes, sorted_raw
        except Exception as exc:
            logger.debug(f"YuNet detection pass notice: {exc}")

    # 2. Fallback: OpenCV Haar Cascade
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    haar_faces = _face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(35, 35),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    if len(haar_faces) == 0:
        return [], None

    sorted_faces = sorted(haar_faces, key=lambda f: f[2] * f[3], reverse=True)
    boxes = [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in sorted_faces]
    return boxes, None


def detect_faces(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """Detect faces in an image. Returns list of [x, y, w, h] sorted by area descending."""
    boxes, _ = detect_faces_detailed(image)
    return boxes


def extract_face_embedding(
    face_img: np.ndarray,
    full_image: Optional[np.ndarray] = None,
    face_raw: Optional[np.ndarray] = None
) -> List[float]:
    """
    Extract a normalized 128-dimensional deep biometric embedding vector.
    Uses OpenCV SFace deep CNN with affine facial landmark alignment when raw detection data is provided.
    The resulting vector is strictly L2 normalized (unit length), allowing fast dot-product cosine similarity.
    """
    if face_img is None or face_img.size == 0:
        return [0.0] * 128

    # 1. Primary: SFace Deep Learning Model
    if _sface_recognizer is not None:
        try:
            with _recognizer_lock:
                if full_image is not None and face_raw is not None and face_raw.size >= 14:
                    # Preferred: landmark-aligned crop using 5 facial landmarks
                    aligned_face = _sface_recognizer.alignCrop(full_image, face_raw)
                    feat = _sface_recognizer.feature(aligned_face).flatten()
                else:
                    # Standardized 112x112 direct crop
                    resized = cv2.resize(face_img, (112, 112))
                    feat = _sface_recognizer.feature(resized).flatten()

            norm = float(np.linalg.norm(feat))
            if norm > 1e-6:
                feat_u = feat / norm
            else:
                feat_u = np.zeros(128, dtype=np.float32)

            return [round(float(v), 6) for v in feat_u.tolist()]
        except Exception as exc:
            logger.error(f"SFace feature extraction error: {exc}")

    # 2. Fallback: Spatial Multi-Region Texture Feature
    resized = cv2.resize(face_img, (128, 128))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized
    gray = cv2.equalizeHist(gray)

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude, angle = cv2.cartToPolar(sobelx, sobely, angleInDegrees=True)

    block_size = 32
    embedding = []
    num_bins = 8
    for r in range(4):
        for c in range(4):
            block_mag = magnitude[r*block_size:(r+1)*block_size, c*block_size:(c+1)*block_size]
            block_ang = angle[r*block_size:(r+1)*block_size, c*block_size:(c+1)*block_size]
            hist, _ = np.histogram(block_ang, bins=num_bins, range=(0, 360), weights=block_mag)
            embedding.extend(hist.tolist())

    embedding_arr = np.array(embedding, dtype=np.float32)
    norm = np.linalg.norm(embedding_arr)
    if norm > 1e-6:
        embedding_arr = embedding_arr / norm
    else:
        embedding_arr = np.zeros(128, dtype=np.float32)

    return [round(float(v), 6) for v in embedding_arr.tolist()]


def compute_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two 128-dimensional embedding vectors."""
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def calculate_match_confidence(similarity: float, threshold: float = SFACE_MATCH_THRESHOLD) -> float:
    """
    Map raw cosine similarity into a standardized UI confidence percentage [0.0 - 1.0].
    - Under SFace:
      - Similarity < 0.30: strictly non-matching identity (returns 0.05 - 0.35)
      - Similarity == 0.40 (threshold): baseline match ~ 0.62
      - Similarity >= 0.70: high confidence ~ 0.90+
      - Similarity >= 0.85: near-perfect match ~ 0.98
    """
    if similarity >= threshold:
        # Scale range [threshold, 0.90] to [0.60, 0.98]
        norm_diff = min(1.0, max(0.0, (similarity - threshold) / (0.90 - threshold)))
        conf = 0.60 + norm_diff * 0.38
        return round(float(min(0.99, conf)), 2)
    else:
        # Below threshold: low confidence
        conf = max(0.05, similarity * 1.0)
        return round(float(min(0.48, conf)), 2)


def check_anti_spoofing(face_img: np.ndarray) -> Tuple[bool, float, str]:
    """
    Multi-Factor Anti-Spoofing Engine:
    1. Laplacian Texture Variance: Detects flat printed paper photos & low-texture cutouts.
    2. 2D Fast Fourier Transform (FFT): Detects digital screen pixel moiré patterns from phones/monitors.
    Returns: (is_spoof: bool, liveness_score: float, details: str)
    """
    if face_img is None or face_img.size == 0:
        return True, 0.0, "Empty face region"

    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY) if len(face_img.shape) == 3 else face_img

    # 1. Texture Variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

    # 2. FFT Screen Moiré Detection
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1)
    
    rows, cols = gray.shape
    crow, ccol = rows // 2, cols // 2
    r = min(crow, ccol) // 4
    if r > 0 and crow - r >= 0 and ccol - r >= 0:
        magnitude_spectrum[crow-r:crow+r, ccol-r:ccol+r] = 0
    high_freq_power = float(np.mean(magnitude_spectrum))

    is_spoof = False
    details = "Liveness verified"

    if laplacian_var < 8.0:
        is_spoof = True
        liveness_score = 0.25
        details = f"Low texture variance detected ({laplacian_var:.1f}) - Possible flat paper/blank cutout"
    elif high_freq_power > 165.0:
        is_spoof = True
        liveness_score = 0.35
        details = f"Digital screen pixel moiré detected ({high_freq_power:.1f}) - Possible phone/tablet display"
    else:
        liveness_score = min(1.0, max(0.65, float(laplacian_var / 120.0)))

    return is_spoof, round(liveness_score, 2), details


def detect_and_decode_id_card(image: np.ndarray) -> Tuple[bool, str, str]:
    """
    Scan Student ID card for Barcode or QR Code.
    Returns (success: bool, code_data: str, code_type: str).
    """
    if image is None or image.size == 0:
        return False, "", "NONE"

    # 1. Try QR code detection
    try:
        data, points, _ = _qr_detector.detectAndDecode(image)
        if data and len(data.strip()) > 0:
            return True, data.strip(), "QR_CODE"
    except Exception as exc:
        logger.debug(f"QR decode pass: {exc}")

    # 2. Try OpenCV Barcode detection
    if _barcode_detector is not None:
        try:
            res = _barcode_detector.detectAndDecode(image)
            if len(res) == 3:
                decoded_info, decoded_type, _ = res
                if decoded_info and len(str(decoded_info).strip()) > 0:
                    return True, str(decoded_info).strip(), str(decoded_type or "BARCODE")
            elif len(res) == 4:
                ok, decoded_info, decoded_type, _ = res  # type: ignore
                if ok and decoded_info:
                    info_val = decoded_info[0] if isinstance(decoded_info, (list, tuple)) else decoded_info
                    type_val = decoded_type[0] if isinstance(decoded_type, (list, tuple)) else decoded_type
                    if str(info_val).strip():
                        return True, str(info_val).strip(), str(type_val or "BARCODE")
        except Exception as exc:
            logger.debug(f"Barcode decode pass: {exc}")

    return False, "", "NONE"
