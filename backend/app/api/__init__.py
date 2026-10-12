from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.academic import router as academic_router
from app.api.cctv import router as cctv_router
from app.api.biometrics import router as biometrics_router
from app.api.timetable import router as timetable_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="", tags=["Health & Diagnostics"])
api_router.include_router(auth_router, prefix="", tags=["Authentication & RBAC"])
api_router.include_router(academic_router, prefix="", tags=["Academic & Student Management"])
api_router.include_router(cctv_router, prefix="", tags=["CCTV & Camera Management"])
api_router.include_router(biometrics_router, prefix="", tags=["Biometric Face Training & Anti-Spoofing"])
api_router.include_router(timetable_router, prefix="", tags=["Timetable, Sessions & Attendance Ledger"])
