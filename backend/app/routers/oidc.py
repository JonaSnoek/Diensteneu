import logging
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.config import load_config, save_config, OidcConfig
from app.schemas.config import OidcConfigSchema
from app.security import create_access_token, require_admin
import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["oidc"])

# In-memory store for OIDC state values (use Redis in production)
_oidc_states: dict = {}

def _get_oidc_config() -> Optional[OidcConfig]:
    config = load_config()
    if config.oidc_config and config.oidc_config.enabled:
        return config.oidc_config
    return None

@router.get("/login")
def oidc_login(request: Request):
    oidc = _get_oidc_config()
    if not oidc:
        raise HTTPException(status_code=400, detail="OIDC/SSO ist nicht konfiguriert.")

    state = secrets.token_urlsafe(32)
    _oidc_states[state] = {"created_at": datetime.datetime.utcnow().timestamp()}

    redirect_url = (
        f"{oidc.issuer_url}/protocol/openid-connect/auth"
        f"?response_type=code"
        f"&client_id={oidc.client_id}"
        f"&redirect_uri={oidc.redirect_uri}"
        f"&scope={oidc.scopes.replace(' ', '%20')}"
        f"&state={state}"
    )

    return {"redirect_url": redirect_url}

@router.get("/callback", response_model=None)
def oidc_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if error:
        raise HTTPException(status_code=400, detail=f"OIDC-Fehler: {error}")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Fehlende Parameter (code oder state).")

    if state not in _oidc_states:
        raise HTTPException(status_code=400, detail="Ungültiger state-Parameter (CSRF).")

    del _oidc_states[state]

    oidc = _get_oidc_config()
    if not oidc:
        raise HTTPException(status_code=400, detail="OIDC/SSO ist nicht konfiguriert.")

    import httpx
    try:
        with httpx.Client() as client:
            token_response = client.post(
                f"{oidc.issuer_url}/protocol/openid-connect/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": oidc.redirect_uri,
                    "client_id": oidc.client_id,
                    "client_secret": oidc.client_secret,
                },
                headers={"Accept": "application/json"},
                timeout=30,
            )
            if token_response.status_code != 200:
                logger.error(f"OIDC token exchange failed: {token_response.text}")
                raise HTTPException(status_code=400, detail="Token-Austausch fehlgeschlagen.")

            token_data = token_response.json()
            access_token = token_data.get("access_token")
            id_token = token_data.get("id_token")

            if not access_token:
                raise HTTPException(status_code=400, detail="Kein access_token erhalten.")

            userinfo_response = client.get(
                f"{oidc.issuer_url}/protocol/openid-connect/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30,
            )
            if userinfo_response.status_code != 200:
                logger.error(f"OIDC userinfo failed: {userinfo_response.text}")
                raise HTTPException(status_code=400, detail="Userinfo-Abruf fehlgeschlagen.")

            userinfo = userinfo_response.json()
            logger.info(f"OIDC userinfo: {userinfo}")

            username = userinfo.get(oidc.username_claim, "")
            display_name = userinfo.get(oidc.display_name_claim, username)
            email = userinfo.get(oidc.email_claim, "")

            if not username:
                raise HTTPException(status_code=400, detail="Konnte Benutzername nicht aus OIDC-Antwort ermitteln.")

            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                existing_user.display_name = display_name
                existing_user.email = email
                if not existing_user.is_active:
                    existing_user.is_active = True
                db.commit()
                user = existing_user
            else:
                user = User(
                    username=username,
                    display_name=display_name,
                    email=email,
                    is_active=True,
                    is_ldap=False,
                    role="User",
                )
                db.add(user)
                db.commit()
                db.refresh(user)

            portal_token = create_access_token(data={"sub": user.username, "role": user.role})

            response = Response()
            response.set_cookie(
                key="access_token",
                value=portal_token,
                httponly=True,
                max_age=86400,
                samesite="lax",
                secure=False,
            )
            audit = AuditLog(
                timestamp=datetime.datetime.utcnow(),
                user_id=user.id,
                username=user.username,
                action="LOGIN_SUCCESS",
                details="Successful login via OIDC/SSO",
                ip_address=request.client.host if request and request.client else "127.0.0.1",
            )
            db.add(audit)
            db.commit()

            response.status_code = 302
            response.headers["Location"] = "/"
            return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC callback error: {e}")
        raise HTTPException(status_code=500, detail=f"OIDC-Fehler: {str(e)}")

@router.get("/status")
def oidc_status():
    oidc = _get_oidc_config()
    if oidc:
        return {"enabled": True, "issuer_url": oidc.issuer_url}
    return {"enabled": False}

@router.get("/config")
def get_oidc_config(admin: User = Depends(require_admin)):
    config = load_config()
    if not config.oidc_config:
        return OidcConfigSchema().model_dump()
    data = config.oidc_config.model_dump()
    if data.get("client_secret"):
        data["client_secret"] = "********"
    return data

@router.post("/config")
def save_oidc_config(
    cfg: OidcConfigSchema,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cfg_config = load_config()
    client_secret = cfg.client_secret
    if client_secret == "********" and cfg_config.oidc_config:
        client_secret = cfg_config.oidc_config.client_secret

    cfg_config.oidc_config = OidcConfig(
        enabled=cfg.enabled,
        issuer_url=cfg.issuer_url,
        client_id=cfg.client_id,
        client_secret=client_secret,
        redirect_uri=cfg.redirect_uri,
        scopes=cfg.scopes,
        username_claim=cfg.username_claim,
        display_name_claim=cfg.display_name_claim,
        email_claim=cfg.email_claim,
    )
    save_config(cfg_config)

    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=admin.id,
        username=admin.username,
        action="UPDATE_OIDC_CONFIG",
        details="OIDC/SSO configuration updated",
        ip_address=request.client.host if request and request.client else "127.0.0.1",
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "message": "OIDC/SSO-Konfiguration gespeichert."}

@router.post("/test")
def test_oidc_connection(
    cfg: OidcConfigSchema,
    admin: User = Depends(require_admin),
):
    client_secret = cfg.client_secret
    if client_secret == "********":
        config = load_config()
        if config.oidc_config:
            client_secret = config.oidc_config.client_secret

    import httpx
    try:
        with httpx.Client() as client:
            r = client.get(
                f"{cfg.issuer_url}/.well-known/openid-configuration",
                timeout=15,
            )
            if r.status_code != 200:
                return {"status": "error", "message": f"Discovery-Dokument nicht gefunden (HTTP {r.status_code}). Prüfe issuer_url."}
            discovery = r.json()
            auth_endpoint = discovery.get("authorization_endpoint", "?")
            token_endpoint = discovery.get("token_endpoint", "?")
            return {
                "status": "success",
                "message": f"Verbindung OK. Auth: {auth_endpoint}, Token: {token_endpoint}",
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}
