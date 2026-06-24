import logging
from fastapi import FastAPI, Request, status, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import load_config, UPLOADS_DIR
from app.database import create_tables
from app.routers import setup, auth, users, ldap, launchers, modules, audit, system, oidc

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Central Portal API",
    description="REST API backend for the modular, self-hostable service portal",
    version="1.0.0"
)

# CORS configuration
# Allows connection from frontend server (typically localhost:5173 or docker frontend container)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
def startup_event():
    config = load_config()
    logger.info(f"Portal name: {config.system_settings.portal_name}")
    logger.info(f"Setup completed: {config.setup_completed}")
    
    if config.setup_completed:
        try:
            logger.info("Initializing database schemas...")
            create_tables()
            logger.info("Database schemas verified.")
        except Exception as e:
            logger.error(f"Failed to auto-verify database schemas: {e}")

# Global Middleware to enforce Setup Wizard redirect
@app.middleware("http")
async def check_setup_status_middleware(request: Request, call_next):
    config = load_config()
    
    # Paths that bypass the setup wizard check
    bypass_paths = [
        "/api/setup/status",
        "/api/setup/initialize",
        "/api/system/settings",
        "/api/ldap/test-connection",
        "/api/auth/oidc/login",
        "/api/auth/oidc/callback",
        "/api/auth/oidc/status",
        "/docs",
        "/openapi.json",
        "/redoc"
    ]
    
    path = request.url.path
    
    # If API requests are not set up, intercept and block
    if not config.setup_completed and path.startswith("/api") and path not in bypass_paths:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "SETUP_REQUIRED", "message": "System setup is required before using other endpoints."}
        )
        
    response = await call_next(request)
    return response

# Include Routers under /api
app.include_router(setup.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(ldap.router, prefix="/api")
app.include_router(launchers.router, prefix="/api")
app.include_router(modules.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(oidc.router, prefix="/api")

# Serve uploaded files (logos, etc.)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.get("/")
def read_root():
    config = load_config()
    return {
        "status": "online",
        "portal_name": config.system_settings.portal_name,
        "setup_completed": config.setup_completed
    }
