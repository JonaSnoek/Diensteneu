import os
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = DATA_DIR / "config"
MODULES_DIR = DATA_DIR / "modules"
UPLOADS_DIR = DATA_DIR / "uploads"

# Create directories if they don't exist
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
MODULES_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_FILE_PATH = CONFIG_DIR / "config.json"

class LdapServerConfig(BaseModel):
    name: str = "Default LDAP"
    server_url: str = "ldap://localhost:389"
    use_ssl: bool = False
    base_dn: str = "dc=example,dc=org"
    bind_dn: Optional[str] = None
    bind_password: Optional[str] = None
    user_search_filter: str = "(uid={username})"
    group_search_filter: str = "(memberUid={username})"
    group_to_role_mapping: Dict[str, str] = Field(default_factory=dict) # {"admin_group": "Admin", "dev_group": "Creator"}
    sync_interval_minutes: int = 60
    enabled: bool = False

class OidcConfig(BaseModel):
    enabled: bool = False
    issuer_url: str = ""
    client_id: str = ""
    client_secret: str = ""
    redirect_uri: str = ""
    scopes: str = "openid profile email"
    username_claim: str = "preferred_username"
    display_name_claim: str = "name"
    email_claim: str = "email"

class SystemSettings(BaseModel):
    portal_name: str = "Central Service Portal"
    logo_url: Optional[str] = None
    primary_color: str = "#00c8ff" # Neon Blue
    accent_color: str = "#9d00ff" # Neon Purple
    allow_guest_access: bool = True
    allow_local_registration: bool = False # Root admin can create users, or registration can be enabled
    session_timeout_minutes: int = 120

class AppConfig(BaseModel):
    database_url: str = "sqlite:///backend/data/portal.db" # Default fallback
    setup_completed: bool = False
    secret_key: str = "supersecretkeychangeinproduction"
    algorithm: str = "HS256"
    system_settings: SystemSettings = Field(default_factory=SystemSettings)
    ldap_configs: List[LdapServerConfig] = Field(default_factory=list)
    oidc_config: Optional[OidcConfig] = None

_active_config: Optional[AppConfig] = None

def load_config() -> AppConfig:
    global _active_config
    if _active_config is not None:
        return _active_config

    if CONFIG_FILE_PATH.exists():
        try:
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Auto convert database url relative path if sqlite
                if "database_url" in data and data["database_url"].startswith("sqlite:///"):
                    # relative db path fixup for SQLite
                    db_path = data["database_url"].replace("sqlite:///", "")
                    if not os.path.isabs(db_path):
                        data["database_url"] = f"sqlite:///{DATA_DIR / db_path}"
                
                _active_config = AppConfig.model_validate(data)
                return _active_config
        except Exception as e:
            print(f"Error reading configuration: {e}. Loading defaults.")
    
    # Initialize default config file if it doesn't exist
    # Make sure default sqlite path is absolute inside data dir
    db_url = f"sqlite:///{DATA_DIR / 'portal.db'}"
    # Generate random secret key
    import secrets
    secret = secrets.token_hex(32)
    
    _active_config = AppConfig(database_url=db_url, secret_key=secret)
    save_config(_active_config)
    return _active_config

def save_config(config: AppConfig) -> None:
    global _active_config
    _active_config = config
    
    # Ensure config URL cleanup for relative DB paths before saving
    # to avoid absolute path leakage across machines if it's inside DATA_DIR
    data = config.model_dump()
    
    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
