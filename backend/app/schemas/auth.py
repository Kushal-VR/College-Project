from typing import Optional
from pydantic import BaseModel, field_validator
from app.schemas.user import UserResponse
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: str
    password: str
    otp: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email address format.")
        return v

class SendOtpRequest(BaseModel):
    email: str
    purpose: str = "login"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email address format.")
        return v

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    purpose: str = "login"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email address format.")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class LoginOtpResponse(BaseModel):
    requires_otp: bool
    message: str
    email: str
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    expires_in: Optional[int] = None
    user: Optional[UserResponse] = None

class TokenPayload(BaseModel):
    sub: str
    role: UserRole
    exp: int
