import shutil
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.module import Module
from app.models.launcher import Launcher
from app.models.audit import AuditLog
from app.schemas.module import ModuleResponse, ModuleUpdate
from app.security import get_optional_current_user, require_creator, require_admin
from app.config import load_config, MODULES_DIR, UPLOADS_DIR
from app.utils.zip_handler import validate_and_extract_zip
from app.routers.launchers import is_launcher_visible_to_user
import datetime

router = APIRouter(prefix="/modules", tags=["modules"])

@router.get("/", response_model=list[ModuleResponse])
def list_modules(
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    return db.query(Module).all()

@router.post("/upload", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def upload_module(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    # Ensure it's a zip file
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported.")
        
    # Write uploaded file to temp path in data/uploads
    temp_zip_path = UPLOADS_DIR / f"temp_upload_{datetime.datetime.utcnow().timestamp()}.zip"
    try:
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract and validate ZIP
        manifest, module_path = validate_and_extract_zip(temp_zip_path, MODULES_DIR)
        
        module_id = manifest["id"]
        
        # Check if module already exists in DB
        db_module = db.query(Module).filter(Module.id == module_id).first()
        
        if db_module:
            # Update
            db_module.name = manifest["name"]
            db_module.version = manifest["version"]
            db_module.description = manifest.get("description", db_module.description)
            db_module.icon = manifest.get("icon", db_module.icon)
            db_module.entry_point = manifest.get("entry", db_module.entry_point)
            db_module.category = manifest.get("category", db_module.category)
            db_module.uploaded_by_id = creator.id
            db_module.is_active = True
        else:
            # Create new
            db_module = Module(
                id=module_id,
                name=manifest["name"],
                version=manifest["version"],
                description=manifest.get("description"),
                icon=manifest.get("icon", "package"),
                entry_point=manifest.get("entry", "index.html"),
                category=manifest.get("category", "Tools"),
                uploaded_by_id=creator.id,
                is_active=True
            )
            db.add(db_module)
            
        db.commit()
        
        # Automatically create or update a corresponding Launcher Tile for this module
        target_path = f"/api/modules/files/{module_id}/{db_module.entry_point}"
        existing_launcher = db.query(Launcher).filter(Launcher.target_url == target_path).first()
        
        if not existing_launcher:
            # Also search by title to avoid duplications
            existing_launcher = db.query(Launcher).filter(Launcher.title == db_module.name).first()
            
        if existing_launcher:
            # Update launcher details
            existing_launcher.title = db_module.name
            existing_launcher.description = db_module.description
            existing_launcher.icon = db_module.icon
            existing_launcher.category = db_module.category
            existing_launcher.target_type = "internal_html"
            existing_launcher.target_url = target_path
            # Keep existing visibility or set default if blank
            if not existing_launcher.visibility:
                existing_launcher.visibility = "login_required"
        else:
            new_launcher = Launcher(
                title=db_module.name,
                description=db_module.description,
                icon=db_module.icon,
                category=db_module.category,
                target_type="internal_html",
                target_url=target_path,
                visibility="login_required", # Default
                display_order=0
            )
            db.add(new_launcher)
            
        db.commit()
        db.refresh(db_module)
        
        # Audit Log
        audit = AuditLog(
            timestamp=datetime.datetime.utcnow(),
            user_id=creator.id,
            username=creator.username,
            action="UPLOAD_MODULE",
            details=f"Uploaded HTML module: '{db_module.name}' (version {db_module.version})",
            ip_address=request.client.host if request.client else "127.0.0.1"
        )
        db.add(audit)
        db.commit()
        
        return db_module
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module upload failed: {str(e)}"
        )
    finally:
        # Delete temp ZIP file
        if temp_zip_path.exists():
            temp_zip_path.unlink()

@router.post("/upload-html", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def upload_html_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    if not file.filename.endswith(".html"):
        raise HTTPException(status_code=400, detail="Only .html files are supported.")

    module_id = os.path.splitext(file.filename)[0].replace(" ", "_").lower()
    mod_dir = MODULES_DIR / module_id
    if mod_dir.exists():
        import time
        module_id = f"{module_id}_{int(time.time())}"
        mod_dir = MODULES_DIR / module_id

    mod_dir.mkdir(parents=True, exist_ok=True)
    html_path = mod_dir / "index.html"
    content = await file.read()
    with open(html_path, "wb") as f:
        f.write(content)

    # Extract <title> for display name
    import re
    name = module_id
    match = re.search(rb'<title[^>]*>(.*?)</title>', content, re.IGNORECASE)
    if match:
        name = match.group(1).decode('utf-8', errors='ignore').strip() or module_id

    db_module = Module(
        id=module_id,
        name=name,
        version="1.0.0",
        description=f"Single HTML file: {file.filename}",
        icon="file-text",
        entry_point="index.html",
        category="Tools",
        uploaded_by_id=creator.id,
        is_active=True
    )
    db.add(db_module)
    db.commit()

    target_path = f"/api/modules/files/{module_id}/index.html"
    existing_launcher = db.query(Launcher).filter(Launcher.target_url == target_path).first()
    if not existing_launcher:
        existing_launcher = db.query(Launcher).filter(Launcher.title == name).first()
    if existing_launcher:
        existing_launcher.title = name
        existing_launcher.description = f"Single HTML file: {file.filename}"
        existing_launcher.icon = "file-text"
        existing_launcher.category = "Tools"
        existing_launcher.target_type = "internal_html"
        existing_launcher.target_url = target_path
        if not existing_launcher.visibility:
            existing_launcher.visibility = "login_required"
    else:
        new_launcher = Launcher(
            title=name,
            description=f"Single HTML file: {file.filename}",
            icon="file-text",
            category="Tools",
            target_type="internal_html",
            target_url=target_path,
            visibility="login_required",
            display_order=0
        )
        db.add(new_launcher)

    db.commit()
    db.refresh(db_module)

    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="UPLOAD_MODULE",
        details=f"Uploaded HTML file: '{name}'",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()

    return db_module


@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: str,
    module_data: ModuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module nicht gefunden.")
        
    if module_data.is_active is not None:
        module.is_active = module_data.is_active
        
        # Update launcher visibility if deactivated
        target_path = f"/api/modules/files/{module_id}/{module.entry_point}"
        launcher = db.query(Launcher).filter(Launcher.target_url == target_path).first()
        if launcher:
            if not module.is_active:
                launcher.visibility = "hidden"
            else:
                launcher.visibility = "login_required" # Reset to default
                
    db.commit()
    db.refresh(module)
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="UPDATE_MODULE",
        details=f"Module '{module.name}' active status set to {module.is_active}",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return module

@router.delete("/{module_id}")
def delete_module(
    module_id: str,
    request: Request,
    db: Session = Depends(get_db),
    creator: User = Depends(require_creator)
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module nicht gefunden.")
        
    # Delete folder from disk
    mod_dir = MODULES_DIR / module_id
    if mod_dir.exists() and mod_dir.is_dir():
        shutil.rmtree(mod_dir)
        
    # Delete launcher tile
    target_path = f"/api/modules/files/{module_id}/{module.entry_point}"
    launcher = db.query(Launcher).filter(Launcher.target_url == target_path).first()
    if launcher:
        db.delete(launcher)
        
    name = module.name
    db.delete(module)
    db.commit()
    
    # Audit log
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=creator.id,
        username=creator.username,
        action="DELETE_MODULE",
        details=f"Deleted HTML module: '{name}' (ID: {module_id})",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": f"Module '{name}' erfolgreich gelöscht."}

@router.get("/files/{module_id}/{file_path:path}")
def serve_module_file(
    module_id: str,
    file_path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user)
):
    """
    Secure static serving of uploaded module HTML/JS/CSS files,
    evaluating the visibility permissions of the parent launcher tile.
    """
    config = load_config()
    allow_guest = config.system_settings.allow_guest_access
    
    # 1. Fetch module
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module or not module.is_active:
        raise HTTPException(status_code=404, detail="Modul-Datei nicht gefunden.")
        
    # 2. Check user permissions via associated Launcher
    # Find launcher pointing to this module
    # We look for a launcher where target_url matches the file's root index target path
    target_path = f"/api/modules/files/{module_id}/{module.entry_point}"
    launcher = db.query(Launcher).filter(Launcher.target_url == target_path).first()
    
    if launcher:
        # Build mock Guest user if not authenticated
        user = current_user
        if not user:
            user = User(username="guest", role="Guest", is_active=True, is_ldap=False)
            
        if not is_launcher_visible_to_user(launcher, user, allow_guest):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sie haben keine Berechtigung, auf diese Modul-Dateien zuzugreifen."
            )
    else:
        # No launcher exists, only Admins/Creators can access files directly for debugging/setup
        if not current_user or current_user.role not in ["Root", "Admin", "Creator"]:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Zugriff verweigert."
            )
             
    # 3. Path Traversal Protection
    # Resolve the absolute file path inside the module folder
    base_dir = Path(os.path.abspath(MODULES_DIR / module_id))
    target_file = Path(os.path.abspath(MODULES_DIR / module_id / file_path))
    
    if not str(target_file).startswith(str(base_dir)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ungültiger Dateipfad."
        )
        
    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=404, detail="Datei nicht gefunden.")
        
    # 4. Serve file
    return FileResponse(target_file)
