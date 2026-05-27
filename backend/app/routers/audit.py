from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.security import require_admin
import datetime
from typing import Optional

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    if username:
        query = query.filter(AuditLog.username.like(f"%{username}%"))
        
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "user_id": log.user_id,
                "username": log.username,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address
            }
            for log in logs
        ]
    }
