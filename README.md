# Smart AI-Based CCTV Attendance Ledger
### Multi-Factor Validation + Face Recognition + Anti-Spoofing

A production-grade, modular system for automated student and faculty attendance via CCTV/IP-camera (RTSP/ONVIF) and USB webcams with multi-factor biometric validation, local anti-spoofing/liveness verification, and real-time attendance ledger.

---

## Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide React, Recharts
- **Backend**: Python 3.13, FastAPI, SQLAlchemy, Pydantic v2, Uvicorn
- **Database**: PostgreSQL (Supabase) with local SQLite development fallback
- **Computer Vision**: OpenCV, DeepFace, Local Facial Landmark & Anti-Spoofing Engines

---

## Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and configure your database (e.g. Supabase connection URI):
```bash
cp .env.example .env
```

### 2. Backend Setup
```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run backend API server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation available at: `http://127.0.0.1:8000/api/docs`  
Health check endpoint: `http://127.0.0.1:8000/api/health`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend Web UI available at: `http://localhost:3000`

---

## Running Backend Automated Tests
```bash
cd backend
python -m pytest tests/ -v
```

---

## Verification & Feature Progression
Every feature is validated against strict verification gates (Code, Logic, API, Database, Visual UI, Real Behavior, Error Handling, Security, and Regression). Verification reports are logged in `feature-verification/`.
