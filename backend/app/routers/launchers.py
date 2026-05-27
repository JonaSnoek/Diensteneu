from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.launcher import Launcher
from app.models.audit import AuditLog
from app.schemas.launcher import LauncherCreate, LauncherUpdate, LauncherResponse
from app.security import get_optional_current_user, get_current_user, require_creator, require_admin
from app.config import load_config
import datetime

router = APIRouter(prefix="/launchers", tags=["launchers"])

def is_launcher_visible_to_user(launcher: Launcher, user: User, allow_guest: bool) -> bool:
    """Helper to evaluate visibility criteria for a specific user role and group memberships."""
    # Admins and Roots bypass all checks
    if user and user.role in ["Root", "Admin"]:
        return True

    vis = launcher.visibility
    
    if vis == "hidden":
        return False
        
    if vis == "public":
        return True
        
    # Guest handling
    if not user or user.role == "Guest":
        # Guest users can only see public items
        return False

    if vis == "login_required":
        return True

    if vis == "role_restricted":
        return user.role in (launcher.allowed_roles or [])

    if vis == "ldap_group_restricted":
        if not user.is_ldap:
            return False
        # Case insensitive intersection of user groups and allowed groups
        user_groups_lower = {g.lower() for g in (user.ldap_groups or [])}
        allowed_groups_lower = {g.lower() for g in (launcher.allowed_ldap_groups or [])}
        return len(user_groups_lower.intersection(allowed_groups_lower)) > 0

    if vis == "user_restricted":
        return user.username in (launcher.allowed_users or [])

    return False

@router.get("/", response_model=list[LauncherResponse])
def get_visible_launchers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    config = load_config()
    allow_guest = config.system_settings.allow_guest_access
    
    if not current_user and not allow_guest:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login erforderlich."
        )

    # If no user and guest is allowed, build a mock Guest user
    user = current_user
    if not user:
        user = User(username="guest", role="Guest", is_active=True, is_ldap=False)

    launchers = db.query(Launcher).order_by(Launcher.display_order, Launcher.id).all()
    
    # Filter list
    visible_launchers = []
    
    # Track user favorite launcher IDs
    favorite_ids = set()
    if current_user and current_user.role != "Guest":
        favorite_ids = {fav.id for fav in current_user.favorites}

    for l in launchers:
        if is_launcher_visible_to_user(l, user, allow_guest):
            # Map database object to LauncherResponse properties
            # Include favorite state
            is_fav = l.id in favorite_ids
            visible_launchers.append(
                LauncherResponse(
                    id=l.id,
                    title=l.title,
                    description=l.description,
                    icon=l.icon,
                    category=l.category,
                    target_type=l.target_type,
                    target_url=l.target_url,
                    visibility=l.visibility,
                    allowed_roles=l.allowed_roles or [],
                    allowed_ldap_groups=l.allowed_ldap_groups or [],
                    allowed_users=l.allowed_users or [],
                    display_order=l.display_order,
                    design_color=l.design_color,
                    is_favorite=is_fav
                )
            )
            
    return visible_launchers

@router.get("/all", response_model=list[LauncherResponse])
def get_all_launchers_admin(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin-only list of all tiles regardless of visibility settings."""
    launchers = db.query(Launcher).order_by(Launcher.display_order, Launcher.id).all()
    
    # Include favorites state (just for self)
    favorite_ids = {fav.id for fav in admin.favorites}
    
    return [
        LauncherResponse(
            id=l.id,
            title=l.title,
            description=l.description,
            icon=l.icon,
            category=l.category,
            target_type=l.target_type,
            target_url=l.target_url,
            visibility=l.visibility,
            allowed_roles=l.allowed_roles or [],
            allowed_ldap_groups=l.allowed_ldap_groups or [],
            allowed_users=l.allowed_users or [],
            display_order=l.display_order,
            design_color=l.design_color,
            is_favorite=l.id in favorite_ids
        )
        for l in launchers
    ]

@router.post("/", response_model=LauncherResponse, status_code=status.HTTP_201_CREATED)
def create_launcher(
    launcher_data: LauncherCreate,
    request: Request,
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    db_launcher = Launcher(
        title=launcher_data.title,
        description=launcher_data.description,
        icon=launcher_data.icon,
        category=launcher_data.category,
        target_type=launcher_data.target_type,
        target_url=launcher_data.target_url,
        visibility=launcher_data.visibility,
        allowed_roles=launcher_data.allowed_roles,
        allowed_ldap_groups=launcher_data.allowed_ldap_groups,
        allowed_users=launcher_data.allowed_users,
        display_order=launcher_data.display_order,
        design_color=launcher_data.design_color
    )
    db.add(db_launcher)
    db.commit()
    db.refresh(db_launcher)
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="CREATE_LAUNCHER",
        details=f"Created launcher tile: '{db_launcher.title}' (Category: {db_launcher.category})",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return db_launcher

@router.put("/{launcher_id}", response_model=LauncherResponse)
def update_launcher(
    launcher_id: int,
    launcher_data: LauncherUpdate,
    request: Request,
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    launcher = db.query(Launcher).filter(Launcher.id == launcher_id).first()
    if not launcher:
        raise HTTPException(status_code=404, detail="Launcher nicht gefunden.")
        
    # Update properties
    for field, value in launcher_data.model_dump(exclude_unset=True).items():
        setattr(launcher, field, value)
        
    db.commit()
    db.refresh(launcher)
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="UPDATE_LAUNCHER",
        details=f"Updated launcher tile settings for: '{launcher.title}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return launcher

@router.delete("/{launcher_id}")
def delete_launcher(
    launcher_id: int,
    request: Request,
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    launcher = db.query(Launcher).filter(Launcher.id == launcher_id).first()
    if not launcher:
        raise HTTPException(status_code=404, detail="Launcher nicht gefunden.")
        
    title = launcher.title
    db.delete(launcher)
    db.commit()
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="DELETE_LAUNCHER",
        details=f"Deleted launcher tile: '{title}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": f"Launcher '{title}' gelöscht."}

@router.post("/{launcher_id}/favorite")
def favorite_launcher(
    launcher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    launcher = db.query(Launcher).filter(Launcher.id == launcher_id).first()
    if not launcher:
        raise HTTPException(status_code=404, detail="Launcher nicht gefunden.")
        
    # Verify not already favorited
    if launcher in current_user.favorites:
        return {"status": "success", "message": "Bereits favorisiert."}
        
    current_user.favorites.append(launcher)
    db.commit()
    return {"status": "success", "message": "Launcher zu Favoriten hinzugefügt."}

@router.post("/{launcher_id}/unfavorite")
def unfavorite_launcher(
    launcher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    launcher = db.query(Launcher).filter(Launcher.id == launcher_id).first()
    if not launcher:
        raise HTTPException(status_code=404, detail="Launcher nicht gefunden.")
        
    if launcher in current_user.favorites:
        current_user.favorites.remove(launcher)
        db.commit()
        
    return {"status": "success", "message": "Launcher aus Favoriten entfernt."}
