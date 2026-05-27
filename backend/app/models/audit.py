import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True) # e.g. LOGIN, UPLOAD_MODULE, EDIT_LAUNCHER
    details = Column(Text, nullable=True) # JSON or descriptive text
    ip_address = Column(String, nullable=True)
