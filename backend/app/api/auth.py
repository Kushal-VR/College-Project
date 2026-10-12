from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    LoginOtpResponse,
    SendOtpRequest,
    VerifyOtpRequest,
)
from app.schemas.user import UserResponse
from app.api.deps import get_current_user, require_admin, require_faculty_or_admin, require_roles
from app.services.email_service import generate_otp, send_otp_email, verify_otp_code
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

@router.post("/login", response_model=LoginOtpResponse, summary="Authenticate User & Process OTP 2FA")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate credentials. If OTP 2FA is required, sends a secure 6-digit OTP to the user's email
    or verifies the provided OTP to issue a JWT token.
    """
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        logger.warning(f"Failed login attempt for email: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        logger.warning(f"Deactivated user attempted login: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact the administrator.",
        )

    # If 2FA OTP is required and OTP not provided in this request:
    if settings.REQUIRE_EMAIL_OTP and not credentials.otp:
        otp = generate_otp(6)
        email_sent = send_otp_email(
            to_email=user.email,
            otp=otp,
            user_name=user.full_name,
            purpose="Login 2FA Verification"
        )
        logger.info(f"OTP dispatch initiated for {user.email} (Email Sent: {email_sent})")
        return LoginOtpResponse(
            requires_otp=True,
            email=user.email,
            message="A 6-digit verification OTP has been dispatched to your email address.",
        )

    # If OTP is provided, verify it:
    if settings.REQUIRE_EMAIL_OTP and credentials.otp:
        is_valid = verify_otp_code(user.email, credentials.otp, purpose="Login 2FA Verification")
        if not is_valid:
            # Also allow generic "login" purpose fallback
            is_valid = verify_otp_code(user.email, credentials.otp, purpose="login")
            
        if not is_valid:
            logger.warning(f"Invalid OTP entered for user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired OTP code. Please request a new code.",
            )

    # Generate JWT token
    token = create_access_token(
        subject=user.email,
        role=user.role.value,
        extra_claims={"user_id": user.id, "full_name": user.full_name}
    )
    
    logger.info(f"User authenticated successfully: {user.email} (Role: {user.role.value})")
    
    return LoginOtpResponse(
        requires_otp=False,
        email=user.email,
        message="Authentication successful.",
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )

@router.post("/send-otp", summary="Send One-Time Password to Email")
def request_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    """Generate and send an OTP verification code to the specified email."""
    user = db.query(User).filter(User.email == payload.email).first()
    user_name = user.full_name if user else "User"
    
    otp = generate_otp(6)
    email_sent = send_otp_email(
        to_email=payload.email,
        otp=otp,
        user_name=user_name,
        purpose=payload.purpose
    )
    
    return {
        "success": True,
        "email": payload.email,
        "message": f"Verification code sent to {payload.email}.",
        "expires_in_minutes": settings.OTP_EXPIRE_MINUTES,
        "email_dispatched": email_sent
    }

@router.post("/verify-otp", response_model=TokenResponse, summary="Verify OTP and Authenticate")
def verify_otp_login(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify an OTP code directly and issue a session JWT."""
    is_valid = verify_otp_code(payload.email, payload.otp, purpose=payload.purpose)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP code.",
        )
        
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found for this email.",
        )
        
    token = create_access_token(
        subject=user.email,
        role=user.role.value,
        extra_claims={"user_id": user.id, "full_name": user.full_name}
    )
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )

@router.get("/me", response_model=UserResponse, summary="Get Current Authenticated User Profile")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)

@router.post("/logout", summary="Logout User")
def logout(current_user: User = Depends(get_current_user)):
    """Acknowledge logout and log event."""
    logger.info(f"User logged out: {current_user.email}")
    return {"success": True, "message": "Successfully logged out."}

# Protected Role Verification Endpoints
@router.get("/protected/admin-only", summary="Admin-only RBAC Verification")
def verify_admin_access(current_user: User = Depends(require_admin)):
    return {
        "message": f"Welcome Admin {current_user.full_name}. You have unrestricted system authority.",
        "role": current_user.role,
    }

@router.get("/protected/faculty-only", summary="Faculty/Admin RBAC Verification")
def verify_faculty_access(current_user: User = Depends(require_faculty_or_admin)):
    return {
        "message": f"Welcome Faculty/Instructor {current_user.full_name}.",
        "role": current_user.role,
    }

@router.get("/protected/student-only", summary="Student RBAC Verification")
def verify_student_access(current_user: User = Depends(require_roles([UserRole.STUDENT, UserRole.ADMIN]))):
    return {
        "message": f"Welcome Student {current_user.full_name}.",
        "role": current_user.role,
    }
