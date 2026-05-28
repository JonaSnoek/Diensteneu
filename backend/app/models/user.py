import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class UserFavorite(Base):
    __tablename__ = "user_favorites"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    launcher_id = Column(Integer, ForeignKey("launchers.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True) # Can be null for purely LDAP users
    display_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_ldap = Column(Boolean, default=False)
    ldap_dn = Column(String, nullable=True)
    ldap_groups = Column(JSON, default=list) # Caches user's LDAP groups on login/sync
    role = Column(String, default="User") # Root, Admin, Creator, User, Guest
    role_overridden = Column(Boolean, default=False) # True = admin manually set role, don't overwrite on LDAP sync/login
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationship to favorites
    favorites = relationship("Launcher", secondary="user_favorites", back_populates="favorited_by")
