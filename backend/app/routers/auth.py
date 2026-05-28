from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, Token
from app.models.user import User
from app.models.audit import AuditLog
from app.config import load_config
from app.security import verify_password, create_access_token, get_optional_current_user
from app.ldap import authenticate_ldap_user
import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

def map_ldap_groups_to_role(groups: list) -> str:
    """Maps user's LDAP groups to a portal role (Root, Admin, Creator, User, Guest)."""
    config = load_config()
    
    # We aggregate the highest matching role
    # Role hierarchy: Root > Admin > Creator > User > Guest
    role_priority = {"Root": 5, "Admin": 4, "Creator": 3, "User": 2, "Guest": 1}
    highest_role = "User" # Default role for authenticated users
    highest_priority = role_priority["User"]

    for ldap_cfg in config.ldap_configs:
        if not ldap_cfg.enabled:
            continue
        for group in groups:
            # Case insensitive group match
            for ldap_group, target_role in ldap_cfg.group_to_role_mapping.items():
                if ldap_group.lower() == group.lower():
                    priority = role_priority.get(target_role, 0)
                    if priority > highest_priority:
                        highest_role = target_role
                        highest_priority = priority
                        
    return highest_role

@router.post("/login", response_model=Token)
def login(
    login_data: LoginRequest, 
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    config = load_config()
    username = login_data.username
    password = login_data.password
    
    # 1. Attempt local login
    user = db.query(User).filter(User.username == username).first()
    authenticated = False
    
    if user and not user.is_ldap:
        if verify_password(password, user.hashed_password):
            authenticated = True
            
    # 2. Attempt LDAP login if not authenticated locally
    ldap_details = None
    if not authenticated:
        ldap_details = authenticate_ldap_user(username, password)
        if ldap_details:
            authenticated = True
            
            # Map roles
            mapped_role = map_ldap_groups_to_role(ldap_details["groups"])
            
            # Update cache or auto-create LDAP user locally
            if user:
                user.display_name = ldap_details["display_name"]
                user.email = ldap_details["email"]
                user.ldap_dn = ldap_details["dn"]
                user.ldap_groups = ldap_details["groups"]
                if not user.is_active:
                    user.is_active = True
                if user.hashed_password is None:
                    user.hashed_password = "_ldap_activated_"
                db.commit()
            else:
                user = User(
                    username=username,
                    display_name=ldap_details["display_name"],
                    email=ldap_details["email"],
                    is_active=True,
                    is_ldap=True,
                    ldap_dn=ldap_details["dn"],
                    ldap_groups=ldap_details["groups"],
                    role=mapped_role
                )
                db.add(user)
                db.commit()
                db.refresh(user)

    if not authenticated or not user:
        audit = AuditLog(
            timestamp=datetime.datetime.utcnow(),
            action="LOGIN_FAILED",
            details=f"Failed login attempt for username '{username}'",
            ip_address=request.client.host if request.client else "127.0.0.1"
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Benutzername oder Passwort."
        )

    if not user.is_active and not user.is_ldap:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dieser Account wurde deaktiviert."
        )

    # 3. Create access token
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    
    # 4. Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=config.system_settings.session_timeout_minutes * 60,
        samesite="lax",
        secure=False # Set True in production (HTTPS)
    )
    
    # Audit success log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=user.id,
        username=user.username,
        action="LOGIN_SUCCESS",
        details=f"Successful login via {'LDAP' if user.is_ldap else 'local db'}",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        display_name=user.display_name
    )

@router.post("/logout")
def logout(response: Response, request: Request, current_user: User = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    response.delete_cookie("access_token")
    if current_user:
        audit = AuditLog(
            timestamp=datetime.datetime.utcnow(),
            user_id=current_user.id,
            username=current_user.username,
            action="LOGOUT",
            details="User logged out",
            ip_address=request.client.host if request.client else "127.0.0.1"
        )
        db.add(audit)
        db.commit()
    return {"status": "success", "message": "Erfolgreich abgemeldet."}

@router.get("/me")
def get_me(current_user: User = Depends(get_optional_current_user)):
    config = load_config()
    
    if current_user:
        return {
            "authenticated": True,
            "id": current_user.id,
            "username": current_user.username,
            "display_name": current_user.display_name,
            "email": current_user.email,
            "role": current_user.role,
            "is_ldap": current_user.is_ldap,
            "ldap_dn": current_user.ldap_dn
        }
    
    # If no user and guest access is enabled, return Guest details
    if config.system_settings.allow_guest_access:
        return {
            "authenticated": False,
            "username": "guest",
            "display_name": "Gast",
            "email": None,
            "role": "Guest",
            "is_ldap": False,
            "ldap_dn": None
        }
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Login erforderlich."
    )
