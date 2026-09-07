"""OpenID Connect (OIDC) / SSO authentication.

SSO is fully independent from LDAP: it works regardless of the LDAP enable state.
The implementation follows the OIDC Authorization Code flow:
  1. /auth/sso/login      -> builds the authorization URL (state + nonce)
  2. /auth/sso/callback   -> verifies state, exchanges the code, validates the
                             id_token, links the IdP subject to a portal user and
                             creates the portal session (HttpOnly cookie)
  3. /auth/sso/status     -> public availability check (used by the login page)
  4. /auth/sso/config     -> admin CRUD for the provider configuration
  5. /auth/sso/test       -> admin connection test (discovery)
"""
import datetime
import logging
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from jose import jwt as jose_jwt
from jose import jwk as jose_jwk
from jose import JWTError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import SsoConfig, load_config, save_config
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.config import SsoConfigSchema
from app.security import create_access_token, require_admin
from app.role_mapping import map_groups_to_role, ROLE_PRIORITY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/sso", tags=["sso"])

STATE_TTL_SECONDS = 600
DISCOVERY_TTL_SECONDS = 300

# In-memory one-time state/nonce store. Replace with Redis for multi-instance setups.
_oidc_states: Dict[str, Dict[str, Any]] = {}
_discovery_cache: Dict[str, Dict[str, Any]] = {}
_jwks_cache: Dict[str, Dict[str, Any]] = {}

_FALLBACK_HTML_ERROR = """<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>SSO Login fehlgeschlagen</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center">
<h2>SSO-Login fehlgeschlagen</h2><p>{error}</p>
<p><a href="/">Zur&uuml;ck zur Anmeldung</a></p></body></html>"""


def _get_sso_config() -> Optional[SsoConfig]:
    config = load_config()
    sso = config.sso_config
    if sso and sso.enabled and sso.issuer_url and sso.client_id:
        return sso
    return None


def _prune_states() -> None:
    now = time.time()
    for key in [k for k, v in _oidc_states.items() if now - v.get("created_at", 0) > STATE_TTL_SECONDS]:
        _oidc_states.pop(key, None)


def normalize_scopes(oidc: SsoConfig) -> str:
    """Return the deduplicated scope string, always including 'openid'.

    If group claiming is configured (either a custom groups_claim or a non-empty
    group_to_role_mapping), the `groups` scope is requested so the IdP includes the
    groups claim in the token. This fulfills "group claiming per scope groups".
    """
    parts = [s.strip() for s in (oidc.scopes or "").replace(",", " ").split() if s.strip()]
    if "openid" not in parts:
        parts.insert(0, "openid")
    if oidc.group_to_role_mapping or oidc.groups_claim == "groups":
        if "groups" not in parts:
            parts.append("groups")
    return " ".join(parts)


def extract_groups(claims: Dict[str, Any], claim_name: str) -> list:
    """Extract the group memberships from the OIDC claims.

    Accepts a list of groups or a single/comma-separated string (some IdPs return
    a flattened claim depending on the audience or scopes requested).
    """
    value = claims.get(claim_name)
    if value is None:
        return []
    if isinstance(value, str):
        return [g.strip() for g in value.split(",") if g.strip()]
    if isinstance(value, list):
        return [str(g).strip() for g in value if str(g).strip()]
    return []


def _write_audit(db: Session, action: str, details: str, request: Request, user_id: int = None, username: str = None) -> None:
    audit = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user_id=user_id,
        username=username,
        action=action,
        details=details,
        ip_address=request.client.host if request and request.client else "127.0.0.1",
    )
    db.add(audit)
    db.commit()


def discover_oidc(issuer_url: str) -> Dict[str, Any]:
    """Fetch (and cache) the OIDC discovery document."""
    url = issuer_url.rstrip("/") + "/.well-known/openid-configuration"
    cached = _discovery_cache.get(url)
    if cached and time.time() - cached.get("fetched_at", 0) < DISCOVERY_TTL_SECONDS:
        return cached["data"]

    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(url)
        if r.status_code != 200:
            raise HTTPException(400, f"Discovery-Dokument nicht gefunden (HTTP {r.status_code}).")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OIDC discovery failed for %s: %s", issuer_url, e)
        raise HTTPException(400, f"OIDC-Discovery fehlgeschlagen: {e}")

    _discovery_cache[url] = {"fetched_at": time.time(), "data": data}
    return data


def _get_jwks(issuer_url: str) -> list:
    discovery = discover_oidc(issuer_url)
    jwks_uri = discovery.get("jwks_uri")
    if not jwks_uri:
        return []
    cached = _jwks_cache.get(jwks_uri)
    if cached and time.time() - cached.get("fetched_at", 0) < DISCOVERY_TTL_SECONDS:
        return cached["keys"]
    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(jwks_uri)
        if r.status_code != 200:
            return []
        keys = r.json().get("keys", [])
    except Exception as e:
        logger.error("OIDC JWKS fetch failed: %s", e)
        return []
    _jwks_cache[jwks_uri] = {"fetched_at": time.time(), "keys": keys}
    return keys


def exchange_code(oidc: SsoConfig, discovery: Dict[str, Any], code: str) -> Dict[str, Any]:
    """Exchange the authorization code for tokens at the token endpoint."""
    token_endpoint = discovery.get("token_endpoint")
    if not token_endpoint:
        raise HTTPException(400, "Kein Token-Endpunkt im Discovery-Dokument.")
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(
                token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": oidc.redirect_uri,
                    "client_id": oidc.client_id,
                    "client_secret": oidc.client_secret,
                },
                headers={"Accept": "application/json"},
            )
        if r.status_code != 200:
            logger.error("OIDC token exchange failed: HTTP %s", r.status_code)
            raise HTTPException(400, "Token-Austausch fehlgeschlagen.")
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OIDC token exchange error: %s", e)
        raise HTTPException(400, f"Token-Austausch fehlgeschlagen: {e}")


def fetch_userinfo(discovery: Dict[str, Any], access_token: str) -> Dict[str, Any]:
    userinfo_endpoint = discovery.get("userinfo_endpoint")
    if not userinfo_endpoint:
        return {}
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if r.status_code != 200:
            logger.error("OIDC userinfo failed: HTTP %s", r.status_code)
            raise HTTPException(400, "Userinfo-Abruf fehlgeschlagen.")
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OIDC userinfo error: %s", e)
        raise HTTPException(400, f"Userinfo-Abruf fehlgeschlagen: {e}")


def _normalize_issuer(url: str) -> str:
    """Strip trailing slashes so '.../realms/ucs/' matches the token 'iss' claim."""
    return (url or "").rstrip("/")


def _decode_claims(id_token: str, oidc: SsoConfig, alg: str, key, access_token: Optional[str] = None) -> Dict[str, Any]:
    """Run the actual JWT verification against a given key.

    When an `access_token` is available it is used to validate the `at_hash`
    claim (binds id_token to access_token, per OIDC Core 3.1.3.6). Without it
    that validation is skipped so tokens that carry `at_hash` (e.g. Keycloak)
    do not fail on a missing comparison value.
    """
    options = {"verify_aud": True, "verify_iss": True, "verify_exp": True, "verify_nbf": True}
    kwargs: Dict[str, Any] = {
        "algorithms": [alg],
        "audience": oidc.client_id,
        "issuer": _normalize_issuer(oidc.issuer_url),
        "options": options,
    }
    if access_token:
        kwargs["access_token"] = access_token
    else:
        options["verify_at_hash"] = False
    return jose_jwt.decode(id_token, key, **kwargs)


def _verify_id_token(id_token: str, oidc: SsoConfig, nonce: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """Verify signature, issuer, audience and nonce of the id_token.

    - HS* tokens are verified against the client secret.
    - RS/PS* tokens are verified against the realm JWKS. Every candidate key is
      tried (covers missing/rotated `kid`), and on failure the JWKS cache is
      invalidated and one retry with fresh keys is performed (covers IdP key
      rotation on long-running processes).
    - The exact python-jose reason is surfaced so the admin can diagnose.
    - The `at_hash` claim is validated against the exchanged `access_token`
      when available (and skipped when it is not).
    """
    def _verify() -> Dict[str, Any]:
        header = jose_jwt.get_unverified_header(id_token)
        alg = header.get("alg", "RS256")

        if alg.startswith("HS"):
            return _decode_claims(id_token, oidc, alg, oidc.client_secret or "", access_token)

        jwks = _get_jwks(oidc.issuer_url)
        if not jwks:
            raise HTTPException(400, "Kein JWKS-Key für die ID-Token-Signatur gefunden.")
        kid = header.get("kid")
        candidates = [k for k in jwks if k.get("kid") == kid] or jwks

        last_error: Optional[JWTError] = None
        for candidate in candidates:
            try:
                key = jose_jwk.construct(candidate, algorithm=alg)
                return _decode_claims(id_token, oidc, alg, key, access_token)
            except JWTError as e:
                last_error = e
        if last_error:
            raise last_error
        raise JWTError("Kein passender Signaturschlüssel im JWKS gefunden.")

    try:
        claims = _verify()
    except HTTPException:
        raise
    except JWTError as e:
        logger.error("OIDC id_token verification failed: %s", e)
        # Invalidate the cached JWKS and retry once (handles key rotation)
        jwks_uri = discover_oidc(oidc.issuer_url).get("jwks_uri")
        if jwks_uri:
            _jwks_cache.pop(jwks_uri, None)
        try:
            claims = _verify()
        except HTTPException:
            raise
        except JWTError as e2:
            logger.error("OIDC id_token verification failed after JWKS refresh: %s", e2)
            raise HTTPException(400, f"ID-Token konnte nicht verifiziert werden. Grund: {e2}")

    token_nonce = claims.get("nonce")
    if token_nonce is not None:
        if token_nonce != nonce:
            logger.warning("OIDC nonce mismatch (replay protection).")
            raise HTTPException(400, "Ungültiger nonce-Wert (Replay-Schutz).")
    else:
        logger.warning("OIDC id_token did not contain the requested nonce claim.")
    return claims


def resolve_identity(oidc: SsoConfig, code: str, nonce: str) -> Dict[str, Any]:
    """Complete the OIDC flow and return an aggregated claim map."""
    discovery = discover_oidc(oidc.issuer_url)
    token_data = exchange_code(oidc, discovery, code)

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(400, "Kein access_token im Token-Austausch erhalten.")

    claims: Dict[str, Any] = {}
    id_token = token_data.get("id_token")
    if id_token:
        claims.update(_verify_id_token(id_token, oidc, nonce, access_token))
        claims["_id_token"] = id_token  # kept raw for the IdP logout (id_token_hint)
    else:
        logger.warning("OIDC response contained no id_token; identity resolved via userinfo only.")
    claims.update({k: v for k, v in fetch_userinfo(discovery, access_token).items() if v is not None})
    return claims


def _find_or_create_user(db: Session, claims: Dict[str, Any], oidc: SsoConfig) -> User:
    """Link the SSO identity to a portal user via a stable ID.

    Primary key: (sso_sub, sso_issuer) as returned by the IdP.
    Fallback: exact username match (case-insensitive). This links a directory
    account that also logs in via LDAP to the same portal account, while
    preserving manually assigned roles. Display names are never used for matching.

    "Group claiming": the groups contained in the `groups` claim (requested via the
    `groups` scope) are mapped to a portal role via group_to_role_mapping. New users
    receive the mapped role; existing users can only be *elevated* by the mapping
    (never demoted), so admin-assigned roles are never silently downgraded.
    """
    username = (claims.get(oidc.username_claim) or claims.get("preferred_username") or claims.get("email") or "").strip()
    if not username:
        raise HTTPException(400, "Konnte Benutzername nicht aus SSO-Antwort ermitteln.")

    display_name = claims.get(oidc.display_name_claim) or username
    email = claims.get(oidc.email_claim)
    sub = claims.get("sub")
    issuer = claims.get("iss") or oidc.issuer_url

    groups = extract_groups(claims, oidc.groups_claim)
    mapped_role = map_groups_to_role(groups, oidc.group_to_role_mapping)

    user = None
    if sub and issuer:
        user = db.query(User).filter(User.sso_sub == sub, User.sso_issuer == issuer).first()

    if user is None:
        user = db.query(User).filter(func.lower(User.username) == username.lower()).first()
        if user and not user.sso_sub:
            user.sso_sub = sub
            user.sso_issuer = issuer

    if user:
        user.is_sso = True
        if not user.display_name and display_name:
            user.display_name = display_name
        if not user.email and email:
            user.email = email
        if not user.is_active:
            user.is_active = True
        # Upgrade-only role from group claiming (never demote an assigned role)
        if ROLE_PRIORITY.get(mapped_role, 0) > ROLE_PRIORITY.get(user.role, 0):
            user.role = mapped_role
        db.commit()
        db.refresh(user)
        return user

    user = User(
        username=username,
        display_name=display_name,
        email=email,
        is_active=True,
        is_ldap=False,
        is_sso=True,
        sso_sub=sub,
        sso_issuer=issuer,
        role=mapped_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/login")
def sso_login(request: Request):
    """Start the OIDC flow. Returns the IdP authorization URL (the frontend redirects)."""
    oidc = _get_sso_config()
    if not oidc:
        raise HTTPException(status_code=400, detail="SSO ist nicht konfiguriert oder deaktiviert.")

    discovery = discover_oidc(oidc.issuer_url)
    auth_endpoint = discovery.get("authorization_endpoint")
    if not auth_endpoint:
        raise HTTPException(status_code=400, detail="Kein Autorisierungs-Endpunkt im Discovery-Dokument.")

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    _prune_states()
    _oidc_states[state] = {"nonce": nonce, "created_at": time.time()}

    params = {
        "response_type": "code",
        "client_id": oidc.client_id,
        "redirect_uri": oidc.redirect_uri,
        "scope": normalize_scopes(oidc),
        "state": state,
        "nonce": nonce,
    }
    redirect_url = f"{auth_endpoint}?{urlencode(params)}"
    return {"redirect_url": redirect_url}


@router.get("/callback")
def sso_callback(
    request: Request,
    db: Session = Depends(get_db),
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle the IdP redirect: verify state/nonce, exchange the code, create the session."""
    if error:
        _write_audit(db, "SSO_LOGIN_FAILED", f"SSO-Login fehlgeschlagen (provider error): {error}", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error=f"SSO-Anbieter-Fehler: {error}"), status_code=400)

    if not code or not state:
        _write_audit(db, "SSO_LOGIN_FAILED", "SSO-Login fehlgeschlagen: fehlende Parameter (code/state).", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error="Fehlende Parameter (code oder state)."), status_code=400)

    entry = _oidc_states.pop(state, None)
    if not entry:
        _write_audit(db, "SSO_LOGIN_FAILED", "SSO-Login fehlgeschlagen: ungültiger oder abgelaufener state (CSRF).", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error="Ungültiger state-Parameter (CSRF-Schutz)."), status_code=400)

    oidc = _get_sso_config()
    if not oidc:
        _write_audit(db, "SSO_LOGIN_FAILED", "SSO-Login fehlgeschlagen: SSO nicht konfiguriert.", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error="SSO ist nicht konfiguriert."), status_code=400)

    try:
        claims = resolve_identity(oidc, code, entry["nonce"])
    except HTTPException as e:
        _write_audit(db, "SSO_LOGIN_FAILED", f"SSO-Login fehlgeschlagen: {e.detail}", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error=str(e.detail)), status_code=400)
    except Exception as e:
        logger.error("Unexpected error during SSO callback: %s", e)
        _write_audit(db, "SSO_LOGIN_FAILED", "SSO-Login fehlgeschlagen: interner Fehler.", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error="Interner Fehler während des SSO-Logins."), status_code=500)

    try:
        user = _find_or_create_user(db, claims, oidc)
    except HTTPException as e:
        _write_audit(db, "SSO_LOGIN_FAILED", f"SSO-Login fehlgeschlagen: {e.detail}", request)
        return HTMLResponse(_FALLBACK_HTML_ERROR.format(error=str(e.detail)), status_code=400)

    claimed_groups = extract_groups(claims, oidc.groups_claim)
    role_detail = f" Gruppen={sorted(claimed_groups)}" if claimed_groups else ""
    token_data = {"sub": user.username, "role": user.role}
    raw_id_token = claims.get("_id_token")
    if raw_id_token:
        token_data["sso_id_token"] = raw_id_token  # used to build the IdP end_session URL on logout
    token = create_access_token(data=token_data)

    response = RedirectResponse(url="/", status_code=302)
    config = load_config()
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=config.system_settings.session_timeout_minutes * 60,
        samesite="lax",
        secure=False,  # set True behind HTTPS
    )
    _write_audit(db, "SSO_LOGIN_SUCCESS", f"SSO-Login erfolgreich (username='{user.username}').{role_detail}", request, user_id=user.id, username=user.username)
    return response


@router.get("/status")
def sso_status_endpoint():
    config = load_config()
    sso = config.sso_config
    enabled = bool(sso and sso.enabled and sso.issuer_url and sso.client_id)
    return {"enabled": enabled, "provider_name": (sso.provider_name if sso else None)}


@router.get("/config")
def get_sso_config(admin: User = Depends(require_admin)):
    config = load_config()
    if not config.sso_config:
        return SsoConfigSchema().model_dump()
    data = config.sso_config.model_dump()
    if data.get("client_secret"):
        data["client_secret"] = "********"
    return data


@router.post("/config")
def save_sso_config(
    cfg: SsoConfigSchema,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    config = load_config()
    client_secret = cfg.client_secret
    if client_secret == "********" and config.sso_config:
        client_secret = config.sso_config.client_secret

    prev_enabled = bool(config.sso_config and config.sso_config.enabled)
    config.sso_config = SsoConfig(
        enabled=cfg.enabled,
        provider_name=cfg.provider_name or "SSO",
        issuer_url=cfg.issuer_url,
        client_id=cfg.client_id,
        client_secret=client_secret,
        redirect_uri=cfg.redirect_uri,
        scopes=cfg.scopes,
        username_claim=cfg.username_claim,
        display_name_claim=cfg.display_name_claim,
        email_claim=cfg.email_claim,
        groups_claim=cfg.groups_claim or "groups",
        group_to_role_mapping=cfg.group_to_role_mapping or {},
    )
    save_config(config)

    if cfg.enabled and not prev_enabled:
        _write_audit(db, "SSO_ENABLED", "SSO wurde aktiviert.", request, admin.id, admin.username)
    elif not cfg.enabled and prev_enabled:
        _write_audit(db, "SSO_DISABLED", "SSO wurde deaktiviert.", request, admin.id, admin.username)
    else:
        _write_audit(db, "UPDATE_SSO_CONFIG", "SSO-Konfiguration aktualisiert.", request, admin.id, admin.username)

    return {"status": "success", "message": "SSO-Konfiguration gespeichert."}


@router.post("/test")
def test_sso_connection(
    cfg: SsoConfigSchema,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client_secret = cfg.client_secret
    if client_secret == "********":
        config = load_config()
        if config.sso_config:
            client_secret = config.sso_config.client_secret

    test_cfg = SsoConfig(
        enabled=True,
        provider_name=cfg.provider_name or "SSO",
        issuer_url=cfg.issuer_url,
        client_id=cfg.client_id,
        client_secret=client_secret,
        redirect_uri=cfg.redirect_uri,
        scopes=cfg.scopes,
        username_claim=cfg.username_claim,
        display_name_claim=cfg.display_name_claim,
        email_claim=cfg.email_claim,
        groups_claim=cfg.groups_claim or "groups",
        group_to_role_mapping=cfg.group_to_role_mapping or {},
    )
    try:
        discovery = discover_oidc(test_cfg.issuer_url)
    except HTTPException as e:
        _write_audit(db, "SSO_TEST_FAILED", f"SSO-Verbindungstest fehlgeschlagen: {e.detail}", request, admin.id, admin.username)
        raise HTTPException(status_code=400, detail=f"Verbindungsfehler: {e.detail}")
    except Exception as e:
        _write_audit(db, "SSO_TEST_FAILED", "SSO-Verbindungstest fehlgeschlagen.", request, admin.id, admin.username)
        raise HTTPException(status_code=400, detail=f"Verbindungsfehler: {e}")

    _write_audit(db, "SSO_TEST_SUCCESS", "SSO-Verbindungstest erfolgreich.", request, admin.id, admin.username)
    return {
        "status": "success",
        "message": (
            f"Verbindung OK. Auth: {discovery.get('authorization_endpoint', '?')}, "
            f"Token: {discovery.get('token_endpoint', '?')}"
        ),
    }