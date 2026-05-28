from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordChangeRequest
from app.security import get_password_hash, verify_password, get_current_user, require_admin
import datetime

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db), 
    admin: User = Depends(require_admin)
):
    return db.query(User).order_by(User.id).all()

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    admin: User = Depends(require_admin)
):
    # Check if username exists
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Benutzername existiert bereits.")
        
    # Prevent assigning Root role unless creator is Root themselves
    if user_data.role == "Root" and admin.role != "Root":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Nur Root-Benutzer können Root-Rechte vergeben."
        )

    db_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        display_name=user_data.display_name or user_data.username,
        email=user_data.email,
        role=user_data.role,
        is_active=user_data.is_active,
        is_ldap=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="CREATE_USER",
        details=f"Created local user '{db_user.username}' with role '{db_user.role}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return db_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int, 
    user_data: UserUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")
        
    # Security: Admins cannot modify Root accounts unless they are Root
    if user.role == "Root" and admin.role != "Root":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sie haben keine Berechtigung, Root-Benutzer zu modifizieren."
        )
        
    # Prevent upgrading role to Root unless current admin is Root
    if user_data.role == "Root" and user.role != "Root" and admin.role != "Root":
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Root-Benutzer können Root-Rechte vergeben."
        )

    # Apply updates
    if user_data.display_name is not None:
        user.display_name = user_data.display_name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
        if user.is_ldap:
            user.role_overridden = True
    if user_data.is_active is not None:
        # Prevent Root user from self-deactivating
        if user.role == "Root" and not user_data.is_active:
            raise HTTPException(status_code=400, detail="Root-Benutzer darf nicht deaktiviert werden.")
        user.is_active = user_data.is_active
    if user_data.password is not None and user_data.password != "":
        if user.is_ldap:
            raise HTTPException(status_code=400, detail="Passwort von LDAP-Benutzern kann hier nicht geändert werden.")
        user.hashed_password = get_password_hash(user_data.password)
        
    db.commit()
    db.refresh(user)
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="UPDATE_USER",
        details=f"Updated user profile for '{user.username}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")
        
    # Prevent deleting Root
    if user.role == "Root":
        raise HTTPException(status_code=400, detail="Root-Benutzer kann nicht gelöscht werden.")
        
    # Prevent deleting self
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Sie können Ihren eigenen Account nicht löschen.")
        
    username = user.username
    db.delete(user)
    db.commit()
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="DELETE_USER",
        details=f"Deleted user '{username}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": f"Benutzer '{username}' gelöscht."}

@router.put("/me/password")
def change_my_password(
    pwd_data: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.is_ldap:
        raise HTTPException(status_code=400, detail="Passwort von LDAP-Benutzern kann hier nicht geändert werden.")
        
    if not verify_password(pwd_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Altes Passwort ist inkorrekt.")
        
    current_user.hashed_password = get_password_hash(pwd_data.new_password)
    db.commit()
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=current_user.id,
        username=current_user.username,
        action="CHANGE_PASSWORD",
        details="User changed own password",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": "Passwort erfolgreich geändert."}
