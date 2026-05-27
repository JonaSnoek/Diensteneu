import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Launcher(Base):
    __tablename__ = "launchers"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, default="link") # Lucide icon name
    category = Column(String, default="General") # E.g., Tools, Administration, Links
    target_type = Column(String, default="external_url") # internal_html, internal_module, external_url
    target_url = Column(String, nullable=False) # e.g. /modules/files/calculator/index.html or https://google.com
    
    # Visibility and Access Control
    visibility = Column(String, default="login_required") # public, login_required, role_restricted, ldap_group_restricted, user_restricted, hidden
    allowed_roles = Column(JSON, default=list) # e.g. ["Admin", "Creator"]
    allowed_ldap_groups = Column(JSON, default=list) # e.g. ["IT-Support"]
    allowed_users = Column(JSON, default=list) # list of usernames
    
    display_order = Column(Integer, default=0)
    design_color = Column(String, nullable=True) # Optional customization color
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationship to favorites
    favorited_by = relationship("User", secondary="user_favorites", back_populates="favorites")
