from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import os
from app.config import load_config, save_config, AppConfig, SystemSettings, LdapServerConfig, DATA_DIR
from app.database import get_db, reset_db_engine, create_tables
from app.schemas.config import SetupWizardRequest
from app.models.user import User
from app.models.audit import AuditLog
from app.security import get_password_hash
import datetime

router = APIRouter(prefix="/setup", tags=["setup"])

@router.get("/status")
def get_setup_status():
    config = load_config()
    return {"setup_completed": config.setup_completed}

@router.post("/initialize")
def initialize_system(request_data: SetupWizardRequest, request: Request, db: Session = Depends(get_db)):
    config = load_config()
    
    # 1. Double check if setup is already completed
    if config.setup_completed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System is already initialized. Setup is disabled."
        )
        
    # Check if there is already a user in the database (additional protection)
    try:
        user_exists = db.query(User).first() is not None
        if user_exists:
            # Set setup completed to True in config to lock it down
            config.setup_completed = True
            save_config(config)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System already has users. Setup is disabled."
            )
    except Exception:
        # If DB connection failed or table does not exist, that's fine, we will initialize it now
        pass

    # 2. Update config file parameters (resolve relative SQLite paths)
    db_url = request_data.database_url
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            db_url = f"sqlite:///{DATA_DIR / db_path}"
    config.database_url = db_url
    
    # Apply system settings
    config.system_settings.portal_name = request_data.portal_name
    config.system_settings.primary_color = request_data.primary_color
    config.system_settings.accent_color = request_data.accent_color
    config.system_settings.allow_guest_access = request_data.allow_guest_access
    
    # Apply optional LDAP settings
    if request_data.ldap_enabled and request_data.ldap_server_url and request_data.ldap_base_dn:
        ldap_cfg = LdapServerConfig(
            name="Primary LDAP",
            server_url=request_data.ldap_server_url,
            base_dn=request_data.ldap_base_dn,
            bind_dn=request_data.ldap_bind_dn,
            bind_password=request_data.ldap_bind_password,
            user_search_filter=request_data.ldap_user_filter or "(uid={username})",
            group_search_filter=request_data.ldap_group_filter or "(memberUid={username})",
            group_to_role_mapping=request_data.ldap_group_to_role or {},
            enabled=True
        )
        config.ldap_configs = [ldap_cfg]
    else:
        config.ldap_configs = []

    # Save setup parameters temporarily (so engine reset knows about it)
    save_config(config)
    
    try:
        # 3. Reset database engine & create tables
        reset_db_engine()
        create_tables()
        
        # 4. Generate root user in the newly created database
        # We need a new session because the old db session is bound to the old engine
        new_db_gen = get_db()
        new_db = next(new_db_gen)
        
        try:
            # Check if root user exists (just in case)
            existing_root = new_db.query(User).filter(User.username == request_data.admin_username).first()
            if not existing_root:
                root_user = User(
                    username=request_data.admin_username,
                    hashed_password=get_password_hash(request_data.admin_password),
                    display_name=request_data.admin_display_name or request_data.admin_username,
                    email=request_data.admin_email,
                    is_active=True,
                    is_ldap=False,
                    role="Root" # Root privileges bypass all RBAC checks
                )
                new_db.add(root_user)
                new_db.commit()
                new_db.refresh(root_user)
                
                # Write audit log
                audit = AuditLog(
                    timestamp=datetime.datetime.utcnow(),
                    user_id=root_user.id,
                    username=root_user.username,
                    action="SYSTEM_INIT",
                    details=f"System initialized. Root administrator '{root_user.username}' created.",
                    ip_address=request.client.host if request.client else "127.0.0.1"
                )
                new_db.add(audit)
                new_db.commit()
        finally:
            new_db.close()
            
        # 5. Lock Setup permanently
        config.setup_completed = True
        save_config(config)
        
        return {"status": "success", "message": "System setup successfully completed."}
        
    except Exception as e:
        # Revert config status
        config.setup_completed = False
        save_config(config)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database initialization failed: {str(e)}"
        )
