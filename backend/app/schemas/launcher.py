from pydantic import BaseModel, Field
from typing import Optional, List

class LauncherBase(BaseModel):
    title: str
    description: Optional[str] = None
    icon: str = "link"
    category: str = "General"
    target_type: str = "external_url" # internal_html, internal_module, external_url
    target_url: str
    
    visibility: str = "login_required" # public, login_required, role_restricted, ldap_group_restricted, user_restricted, hidden
    allowed_roles: List[str] = Field(default_factory=list)
    allowed_ldap_groups: List[str] = Field(default_factory=list)
    allowed_users: List[str] = Field(default_factory=list)
    
    display_order: int = 0
    design_color: Optional[str] = None

class LauncherCreate(LauncherBase):
    pass

class LauncherUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    target_type: Optional[str] = None
    target_url: Optional[str] = None
    visibility: Optional[str] = None
    allowed_roles: Optional[List[str]] = None
    allowed_ldap_groups: Optional[List[str]] = None
    allowed_users: Optional[List[str]] = None
    display_order: Optional[int] = None
    design_color: Optional[str] = None

class LauncherResponse(LauncherBase):
    id: int
    is_favorite: Optional[bool] = False

    class Config:
        from_attributes = True
