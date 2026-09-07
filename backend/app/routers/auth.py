from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, Token
from app.models.user import User
from app.models.audit import AuditLog
from app.config import load_config
from app.security import verify_password, create_access_token, get_optional_current_user
from app.ldap import authenticate_ldap_user
from app.auth_status import is_ldap_enabled, ldap_status, sso_status
from app.role_mapping import map_groups_to_role
import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/methods")
def get_auth_methods():
    """Public: reports which authentication methods are currently available.
    Used by the login page to render dynamically. No secrets are exposed."""
    config = load_config()
    return {
        "ldap": ldap_status(config),
        "sso": sso_status(config),
    }

def map_ldap_groups_to_role(groups: list) -> str:
    """Maps user's LDAP groups to a portal role (Root, Admin, Creator, User, Guest).

    Aggregates the group->role mappings of all enabled LDAP servers and returns
    the highest matching role. Delegates to the shared role-mapping helper so
    LDAP and SSO behave identically.
    """
    config = load_config()
    merged_mapping: dict = {}
    for ldap_cfg in config.ldap_configs:
        if ldap_cfg.enabled:
            merged_mapping.update(ldap_cfg.group_to_role_mapping or {})
    return map_groups_to_role(groups, merged_mapping)

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
    
    if user and not user.is_ldap and not user.is_sso:
        if user.hashed_password and verify_password(password, user.hashed_password):
            authenticated = True
            
    # 2. Attempt LDAP login if not authenticated locally.
    #    Server-side enforcement: if LDAP is deactivated, the login is rejected
    #    and no LDAP connection attempt is made – this cannot be bypassed.
    ldap_details = None
    if not authenticated:
        if is_ldap_enabled(config):
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
        elif not user:
            # LDAP is switched off and the username is not a local account.
            audit = AuditLog(
                timestamp=datetime.datetime.utcnow(),
                action="LOGIN_FAILED",
                details=f"LDAP-Login abgelehnt: LDAP momentan deaktiviert (username='{username}')",
                ip_address=request.client.host if request.client else "127.0.0.1"
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="LDAP-Anmeldung ist derzeit deaktiviert."
            )

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
            "is_sso": current_user.is_sso,
            "ldap_dn": current_user.ldap_dn,
            "sso_issuer": current_user.sso_issuer
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
            "is_sso": False,
            "ldap_dn": None,
            "sso_issuer": None
        }
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Login erforderlich."
    )
