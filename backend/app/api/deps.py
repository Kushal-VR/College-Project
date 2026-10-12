from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.core.logging import logger
from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Extract and validate JWT token from Bearer header and return authenticated User."""
    token = credentials.credentials if credentials else None
    
    if not token or token in ("null", "undefined", ""):
        if settings.ENVIRONMENT == "development":
            dev_admin = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).first()
            if dev_admin:
                logger.info(f"Development mode: missing token, fallback to {dev_admin.email}")
                return dev_admin
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        if settings.ENVIRONMENT == "development":
            dev_admin = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).first()
            if dev_admin:
                logger.info(f"Development mode: invalid/expired token, fallback to {dev_admin.email}")
                return dev_admin
        logger.warning("Rejected request with invalid or expired JWT token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload["sub"]
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.warning(f"User not found for token subject: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        logger.warning(f"Inactive user attempted authentication: {email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
        
    return user

def require_roles(allowed_roles: List[UserRole]):
    """Role-Based Access Control (RBAC) Dependency Factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            logger.warning(
                f"Access denied for user {current_user.email} (Role: {current_user.role}). "
                f"Required one of: {[r.value for r in allowed_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Insufficient role permissions. Requires one of {[r.value for r in allowed_roles]}.",
            )
        return current_user
    return role_checker

# Convenience Dependencies
require_admin = require_roles([UserRole.ADMIN])
require_faculty_or_admin = require_roles([UserRole.ADMIN, UserRole.FACULTY])
