from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.module import Module
from app.models.launcher import Launcher
from app.models.audit import AuditLog
from app.config import load_config, save_config, SystemSettings, UPLOADS_DIR
from app.schemas.config import SystemSettingsUpdate
from app.security import require_admin
from sqlalchemy import text
import datetime
import mimetypes
import shutil
import os
import uuid

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/settings")
def get_system_settings():
    config = load_config()
    # Return settings that are safe for public consumption
    return {
        "portal_name": config.system_settings.portal_name,
        "logo_url": config.system_settings.logo_url,
        "header_logo_url": config.system_settings.header_logo_url,
        "login_logo_url": config.system_settings.login_logo_url,
        "favicon_url": config.system_settings.favicon_url,
        "primary_color": config.system_settings.primary_color,
        "accent_color": config.system_settings.accent_color,
        "allow_guest_access": config.system_settings.allow_guest_access,
        "allow_local_registration": config.system_settings.allow_local_registration,
        "session_timeout_minutes": config.system_settings.session_timeout_minutes
    }

LOGO_DIR = UPLOADS_DIR / "logos"

@router.post("/upload-logo")
async def upload_logo(
    target: str = "login",
    file: UploadFile = File(...),
    admin: User = Depends(require_admin)
):
    allowed = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Nicht erlaubtes Dateiformat für das Logo.")

    if target == "favicon" and ext not in (".ico", ".png", ".svg"):
        raise HTTPException(status_code=400, detail="Favicon: nur ICO, PNG oder SVG erlaubt.")

    LOGO_DIR.mkdir(parents=True, exist_ok=True)

    # Only remove the file previously used for this slot so the three logos can
    # be replaced independently of one another.
    config = load_config()
    prev = config.system_settings.logo_url
    if target == "header":
        prev = config.system_settings.header_logo_url
    elif target == "favicon":
        prev = config.system_settings.favicon_url
    if prev and prev.startswith("/api/uploads/logos/"):
        name = os.path.basename(prev)
        old = LOGO_DIR / name
        try:
            if old.exists() and old.is_file():
                old.unlink()
        except OSError:
            pass

    unique_name = f"{target}_" + (uuid.uuid4().hex[:8]) + ext
    dest = LOGO_DIR / unique_name
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    logo_url = f"/api/uploads/logos/{unique_name}"
    if target == "header":
        config.system_settings.header_logo_url = logo_url
    elif target == "favicon":
        config.system_settings.favicon_url = logo_url
    else:
        config.system_settings.login_logo_url = logo_url
        config.system_settings.logo_url = logo_url
    save_config(config)

    return {"logo_url": logo_url, "message": "Logo erfolgreich hochgeladen."}


@router.put("/settings")
def update_system_settings(
    settings_data: SystemSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    config = load_config()
    
    # Update properties
    for field, value in settings_data.model_dump(exclude_unset=True).items():
        setattr(config.system_settings, field, value)
        
    save_config(config)
    
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="UPDATE_SYSTEM_SETTINGS",
        details="System settings updated",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return config.system_settings

@router.get("/favicon")
def serve_favicon():
    config = load_config()
    favicon = config.system_settings.favicon_url
    if not favicon or not favicon.startswith("/api/uploads/logos/"):
        raise HTTPException(status_code=404, detail="Kein Favicon konfiguriert.")
    rel = favicon[len("/api/uploads/logos/"):]
    path = (UPLOADS_DIR / "logos" / rel).resolve()
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Favicon-Datei nicht gefunden.")
    mime_type = mimetypes.guess_type(str(path))[0] or "image/x-icon"
    return FileResponse(path, media_type=mime_type)


@router.get("/status")
def get_system_status(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    # Counts
    user_count = db.query(User).count()
    module_count = db.query(Module).count()
    launcher_count = db.query(Launcher).count()
    
    # Simple disk stats
    disk_total, disk_used, disk_free = shutil.disk_usage(".")
    
    # Check DB status
    db_ok = False
    try:
        db.execute(text('SELECT 1'))
        db_ok = True
    except Exception:
        pass
        
    return {
        "database_connected": db_ok,
        "totals": {
            "users": user_count,
            "modules": module_count,
            "launchers": launcher_count
        },
        "disk": {
            "total_gb": round(disk_total / (1024**3), 2),
            "used_gb": round(disk_used / (1024**3), 2),
            "free_gb": round(disk_free / (1024**3), 2),
            "usage_pct": round((disk_used / disk_total) * 100, 1)
        },
        "server_time": datetime.datetime.utcnow()
    }
