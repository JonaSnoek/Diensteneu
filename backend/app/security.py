import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.orm import Session
from app.config import load_config
from app.database import get_db
from app.models.user import User

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8')[:72],
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    # bcrypt has a 72-byte limit: truncate to avoid hard crash
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    config = load_config()
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=config.system_settings.session_timeout_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, config.secret_key, algorithm=config.algorithm)
    return encoded_jwt

def get_token_from_header_or_cookie(request: Request) -> Optional[str]:
    # Try HTTP Authorization Header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
        
    # Fallback to Cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
        
    return None

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    config = load_config()
    token = get_token_from_header_or_cookie(request)
    
    # If setup is not completed and no user exists, allow setup router bypasses
    # We enforce setup wizard check in router or globally.
    if not token:
        # Check if any user exists. If not, and setup is not completed, we might raise special setup error or guest role
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

async def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Root role overrides all permissions
        if current_user.role == "Root":
            return current_user
            
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return current_user

# Predefined role dependencies
require_root = RoleChecker(["Root"])
require_admin = RoleChecker(["Root", "Admin"])
require_creator = RoleChecker(["Root", "Admin", "Creator"])
require_user = RoleChecker(["Root", "Admin", "Creator", "User"])
