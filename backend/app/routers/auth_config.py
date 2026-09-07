"""Admin endpoints for the authentication overview (Administration -> Authentifizierung).

LDAP can be enabled / permanently disabled / temporarily disabled (auto re-enables
after the configured point in time). All state changes are persisted server-side
and enforced in the login flow. SSO state is managed in routers/sso.py; this
router exposes the aggregated status for the admin UI.
"""
import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth_status import ldap_status, parse_iso_datetime, utc_now
from app.config import load_config, save_config
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.config import LdapDisableTemporaryRequest
from app.security import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth-config"])


def _write_audit(db: Session, action: str, details: str, request: Request, admin: User) -> None:
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action=action,
        details=details,
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    db.add(audit)
    db.commit()


@router.get("/admin/status")
def get_auth_status(admin: User = Depends(require_admin)):
    """Aggregated authentication status for the admin area."""
    config = load_config()
    sso = config.sso_config
    return {
        "ldap": ldap_status(config),
        "sso": {
            "enabled": bool(sso and sso.enabled and sso.issuer_url and sso.client_id),
            "provider_name": (sso.provider_name if sso else None),
        },
    }


@router.post("/admin/ldap/activate")
def ldap_activate(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    config = load_config()
    if config.ldap_enabled and not parse_iso_datetime(config.ldap_disabled_until):
        return {"status": "success", "state": "active", "message": "LDAP ist bereits aktiviert."}

    config.ldap_enabled = True
    config.ldap_disabled_until = None
    save_config(config)
    _write_audit(db, "LDAP_ENABLED", "LDAP wurde wieder aktiviert.", request, admin)
    return {"status": "success", "state": "active", "message": "LDAP wurde aktiviert."}


@router.post("/admin/ldap/deactivate")
def ldap_deactivate(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently deactivate LDAP. The configuration is kept, only usage is disabled."""
    config = load_config()
    config.ldap_enabled = False
    config.ldap_disabled_until = None
    save_config(config)
    _write_audit(db, "LDAP_DISABLED", "LDAP wurde dauerhaft deaktiviert.", request, admin)
    return {"status": "success", "state": "permanently_disabled", "message": "LDAP wurde dauerhaft deaktiviert."}


@router.post("/admin/ldap/deactivate-temporarily")
def ldap_deactivate_temporarily(
    body: LdapDisableTemporaryRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Temporarily disable LDAP until `disable_until` (ISO 8601) or for `duration_minutes`."""
    config = load_config()

    until: Optional[datetime.datetime] = None
    if body.disable_until:
        until = parse_iso_datetime(body.disable_until)
    elif body.duration_minutes:
        until = utc_now() + datetime.timedelta(minutes=body.duration_minutes)

    if until is None:
        raise HTTPException(status_code=400, detail="Bitte entweder einen Zeitpunkt oder eine Dauer angeben.")

    if until <= utc_now():
        raise HTTPException(status_code=400, detail="Der Deaktivierungszeitpunkt muss in der Zukunft liegen.")

    config.ldap_enabled = True
    config.ldap_disabled_until = until.isoformat()
    save_config(config)

    _write_audit(db, "LDAP_DISABLED_TEMP", f"LDAP wurde temporär bis {until.isoformat()} deaktiviert.", request, admin)
    return {
        "status": "success",
        "state": "temp_disabled",
        "disabled_until": until.isoformat(),
        "message": f"LDAP temporär deaktiviert bis {until.isoformat()}.",
    }


@router.post("/admin/ldap/reactivate")
def ldap_reactivate(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Prematurely cancel a running temporary deactivation."""
    config = load_config()
    if not config.ldap_disabled_until:
        return {"status": "success", "state": "active", "message": "Keine laufende temporäre Deaktivierung."}

    config.ldap_enabled = True
    config.ldap_disabled_until = None
    save_config(config)
    _write_audit(db, "LDAP_ENABLED", "LDAP wurde vorzeitig wieder aktiviert.", request, admin)
    return {"status": "success", "state": "active", "message": "LDAP wurde vorzeitig wieder aktiviert."}