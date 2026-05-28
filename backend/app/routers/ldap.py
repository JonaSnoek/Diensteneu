from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.config import load_config, save_config, LdapServerConfig
from app.schemas.config import LdapServerConfigSchema
from app.security import require_admin, require_root, get_optional_current_user
from app.ldap import test_ldap_connection, sync_ldap_users_and_groups
import datetime

router = APIRouter(prefix="/ldap", tags=["ldap"])

@router.get("/configs")
def get_ldap_configs(admin: User = Depends(require_admin)):
    config = load_config()
    # Mask bind passwords for security
    response_cfgs = []
    for cfg in config.ldap_configs:
        data = cfg.model_dump()
        if data.get("bind_password"):
            data["bind_password"] = "********"
        response_cfgs.append(data)
    return response_cfgs

@router.post("/configs")
def save_ldap_configs(
    configs: list[LdapServerConfigSchema], 
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    config = load_config()
    
    # Rebuild configurations list
    updated_configs = []
    for i, c_schema in enumerate(configs):
        # Retrieve password from old configuration if marked masked
        bind_password = c_schema.bind_password
        if bind_password == "********":
            # Search in old config
            if i < len(config.ldap_configs):
                bind_password = config.ldap_configs[i].bind_password
            else:
                bind_password = None
                
        ldap_cfg = LdapServerConfig(
            name=c_schema.name,
            server_url=c_schema.server_url,
            use_ssl=c_schema.use_ssl,
            base_dn=c_schema.base_dn,
            bind_dn=c_schema.bind_dn,
            bind_password=bind_password,
            user_search_filter=c_schema.user_search_filter,
            group_search_filter=c_schema.group_search_filter,
            group_to_role_mapping=c_schema.group_to_role_mapping,
            sync_interval_minutes=c_schema.sync_interval_minutes,
            enabled=c_schema.enabled
        )
        updated_configs.append(ldap_cfg)
        
    config.ldap_configs = updated_configs
    save_config(config)
    
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="UPDATE_LDAP_CONFIG",
        details="LDAP configurations updated",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": "LDAP-Konfigurationen erfolgreich gespeichert."}

@router.post("/test-connection")
def test_ldap_cfg_connection(cfg: LdapServerConfigSchema, admin: User = Depends(get_optional_current_user)):
    # Retrieve password if masked from existing config
    config = load_config()
    bind_password = cfg.bind_password
    if bind_password == "********":
        # Find match by URL/DN or default
        matched = [c for c in config.ldap_configs if c.server_url == cfg.server_url]
        if matched:
            bind_password = matched[0].bind_password
            
    ldap_cfg = LdapServerConfig(
        name=cfg.name,
        server_url=cfg.server_url,
        use_ssl=cfg.use_ssl,
        base_dn=cfg.base_dn,
        bind_dn=cfg.bind_dn,
        bind_password=bind_password,
        user_search_filter=cfg.user_search_filter,
        group_search_filter=cfg.group_search_filter,
        enabled=True
    )
    
    success, msg = test_ldap_connection(ldap_cfg)
    if not success:
        raise HTTPException(status_code=400, detail=f"Verbindungsfehler: {msg}")
    return {"status": "success", "message": msg}

@router.post("/sync")
def sync_ldap_now(
    request: Request,
    db: Session = Depends(get_db), 
    admin: User = Depends(require_admin)
):
    sync_results = sync_ldap_users_and_groups()
    
    # Mapping helper from auth.py
    from app.routers.auth import map_ldap_groups_to_role
    
    synced_usernames = set()
    total_created = 0
    total_updated = 0
    total_deactivated = 0
    
    for result in sync_results:
        if result["status"] == "Failed":
            continue
            
        for user_data in result["users"]:
            username = user_data["username"]
            synced_usernames.add(username)
            
            # Map role
            mapped_role = map_ldap_groups_to_role(user_data["groups"])
            
            # Check local cache
            local_user = db.query(User).filter(User.username == username).first()
            if local_user:
                local_user.display_name = user_data["display_name"]
                local_user.email = user_data["email"]
                if not local_user.role_overridden:
                    local_user.role = mapped_role
                local_user.is_ldap = True
                local_user.ldap_dn = user_data["dn"]
                local_user.ldap_groups = user_data["groups"]
                if local_user.hashed_password is None:
                    local_user.is_active = False
                total_updated += 1
            else:
                local_user = User(
                    username=username,
                    display_name=user_data["display_name"],
                    email=user_data["email"],
                    is_active=False,
                    is_ldap=True,
                    ldap_dn=user_data["dn"],
                    ldap_groups=user_data["groups"],
                    role=mapped_role
                )
                db.add(local_user)
                total_created += 1
                
    # Deactivate LDAP users who were not found in this synchronization sweep
    if synced_usernames:
        # Fetch all active LDAP users
        active_ldap_users = db.query(User).filter(User.is_ldap == True, User.is_active == True).all()
        for u in active_ldap_users:
            if u.username not in synced_usernames:
                u.is_active = False
                total_deactivated += 1
                
    db.commit()
    
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="LDAP_SYNC",
        details=f"LDAP synchronization manually triggered. Created: {total_created}, Updated: {total_updated}, Deactivated: {total_deactivated}",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {
        "status": "success",
        "created": total_created,
        "updated": total_updated,
        "deactivated": total_deactivated,
        "details": sync_results
    }
