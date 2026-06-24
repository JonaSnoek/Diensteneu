from pydantic import BaseModel, Field
from typing import Optional, Dict, List

class LdapServerConfigSchema(BaseModel):
    name: str
    server_url: str
    use_ssl: bool = False
    base_dn: str
    bind_dn: Optional[str] = None
    bind_password: Optional[str] = None
    user_search_filter: str = "(uid={username})"
    group_search_filter: str = "(memberUid={username})"
    group_to_role_mapping: Dict[str, str] = Field(default_factory=dict)
    sync_interval_minutes: int = 60
    enabled: bool = False

class SystemSettingsUpdate(BaseModel):
    portal_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    allow_guest_access: Optional[bool] = None
    allow_local_registration: Optional[bool] = None
    session_timeout_minutes: Optional[int] = None

class OidcConfigSchema(BaseModel):
    enabled: bool = False
    issuer_url: str = ""
    client_id: str = ""
    client_secret: str = ""
    redirect_uri: str = ""
    scopes: str = "openid profile email"
    username_claim: str = "preferred_username"
    display_name_claim: str = "name"
    email_claim: str = "email"
    # Database
    database_url: str = "sqlite:///backend/data/portal.db"
    
    # Root admin user
    admin_username: str
    admin_password: str
    admin_display_name: Optional[str] = "Super Admin"
    admin_email: Optional[str] = None
    
    # Basic system configs
    portal_name: str = "Central Service Portal"
    primary_color: str = "#00c8ff"
    accent_color: str = "#9d00ff"
    allow_guest_access: bool = True
    
    # LDAP configuration (Optional during setup)
    ldap_enabled: bool = False
    ldap_server_url: Optional[str] = None
    ldap_base_dn: Optional[str] = None
    ldap_bind_dn: Optional[str] = None
    ldap_bind_password: Optional[str] = None
    ldap_user_filter: Optional[str] = "(uid={username})"
    ldap_group_filter: Optional[str] = "(memberUid={username})"
    ldap_group_to_role: Optional[Dict[str, str]] = None
