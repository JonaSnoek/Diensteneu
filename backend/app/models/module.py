import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from app.database import Base

class Module(Base):
    __tablename__ = "modules"
    
    id = Column(String, primary_key=True, index=True) # e.g. "calculator"
    name = Column(String, nullable=False)
    version = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, default="package")
    entry_point = Column(String, default="index.html")
    category = Column(String, default="Tools")
    is_active = Column(Boolean, default=True)
    
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    uploaded_by_id = Column(Integer, nullable=True) # Store ID of user who uploaded
