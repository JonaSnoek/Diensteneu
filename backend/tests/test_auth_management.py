"""Tests for independent LDAP & SSO authentication management.

Covers the required cases:
 1. LDAP aktiv -> LDAP-Login funktioniert
 2. LDAP deaktiviert -> LDAP-Login funktioniert nicht
 3. LDAP temporär deaktiviert -> LDAP-Login funktioniert nicht
 4. Zeitraum läuft ab -> LDAP funktioniert automatisch wieder
 5. LDAP deaktiviert + SSO aktiv -> SSO funktioniert
 6. LDAP aktiv + SSO aktiv -> beide funktionieren
 7. SSO deaktiviert -> SSO-Login funktioniert nicht
 8. Rollen funktionieren nach LDAP- und SSO-Login korrekt
 9. Direkter API-Aufruf kann deaktiviertes LDAP nicht umgehen
10. Logout funktioniert bei beiden Authentifizierungsmethoden
"""
import datetime

import pytest

import app.routers.auth as auth_mod
import app.routers.sso as sso_mod
from app.config import load_config, save_config, LdapServerConfig, SsoConfig
from app.models.audit import AuditLog
from app.models.user import User
from app.auth_status import utc_now

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tests.conftest import fake_ldap_auth, enable_sso, run_sso_login, FAKE_ISSUER  # noqa


def _add_enabled_ldap_config(config, mapping=None):
    config.ldap_configs = [
        LdapServerConfig(
            name="Test LDAP",
            server_url="ldap://127.0.0.1:1389",
            base_dn="dc=example,dc=com",
            user_search_filter="(uid={username})",
            group_to_role_mapping=mapping or {"admins": "Admin"},
            enabled=True,
        )
    ]
    save_config(config)


# ---------------------------------------------------------------- 1. LDAP active
def test_ldap_enabled_login_works(client, db_session, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)

    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p, groups=["admins"]))

    resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "secret"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "jdoe"
    assert resp.json()["role"] == "Admin"

    user = db_session.query(User).filter(User.username == "jdoe").first()
    assert user is not None
    assert user.is_ldap is True
    assert user.role == "Admin"

    logs = db_session.query(AuditLog).filter(AuditLog.action == "LOGIN_SUCCESS").all()
    assert any("LDAP" in (log.details or "") for log in logs)


# ------------------------------------------------------ 2. LDAP disabled -> reject
def test_ldap_disabled_login_rejected(client, db_session, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    config.ldap_enabled = False
    save_config(config)

    def _must_not_be_called(*args, **kwargs):
        raise AssertionError("LDAP authenticate must not be called while disabled")
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user", _must_not_be_called)

    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert resp.status_code == 401
    assert "deaktiviert" in resp.json()["detail"].lower()

    logs = db_session.query(AuditLog).filter(AuditLog.action == "LOGIN_FAILED").all()
    details = " ".join(log.details or "" for log in logs)
    assert "LDAP-Login abgelehnt" in details


# ----------------------------------------- 3. LDAP temporarily disabled -> reject
def test_ldap_temp_disabled_login_rejected(client, db_session, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    config.ldap_enabled = True
    config.ldap_disabled_until = (utc_now() + datetime.timedelta(hours=1)).isoformat()
    save_config(config)

    def _must_not_be_called(*args, **kwargs):
        raise AssertionError("LDAP authenticate must not be called while temp-disabled")
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user", _must_not_be_called)

    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert resp.status_code == 401
    assert "deaktiviert" in resp.json()["detail"].lower()


# ---------------------------------------------- 4. expiry -> LDAP auto re-enabled
def test_ldap_reenabled_after_expiry(client, db_session, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    config.ldap_enabled = True
    config.ldap_disabled_until = (utc_now() - datetime.timedelta(minutes=1)).isoformat()
    save_config(config)

    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p))

    resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "secret"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "jdoe"


# --------------------------------------- 5. LDAP disabled + SSO active -> SSO works
def test_sso_works_while_ldap_disabled(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config)
    config.ldap_enabled = False
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-12345",
            "iss": FAKE_ISSUER,
            "preferred_username": "jdoe",
            "name": "Jane Doe",
            "email": "jane@example.com",
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302
    assert resp.headers["location"] == "/"
    assert resp.cookies.get("access_token")

    user = db_session.query(User).filter(User.username == "jdoe").first()
    assert user is not None
    assert user.is_sso is True
    assert user.sso_sub == "sub-12345"
    assert user.sso_issuer == FAKE_ISSUER

    logs = db_session.query(AuditLog).filter(AuditLog.action == "SSO_LOGIN_SUCCESS").all()
    assert len(logs) == 1


# ------------------------------------ 6. LDAP active + SSO active -> both work
def test_both_ldap_and_sso_work(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    enable_sso(config)
    save_config(config)

    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p, groups=["admins"]))
    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-6789",
            "iss": FAKE_ISSUER,
            "preferred_username": "ssouser",
            "name": "SSO User",
            "email": "sso@example.com",
        },
    )

    # LDAP login
    ldap_resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert ldap_resp.status_code == 200
    assert ldap_resp.json()["role"] == "Admin"

    # SSO login
    sso_resp = run_sso_login(client)
    assert sso_resp.status_code == 302
    assert sso_resp.cookies.get("access_token")

    assert db_session.query(User).filter(User.username == "jdoe").first() is not None
    assert db_session.query(User).filter(User.username == "ssouser").first() is not None


# -------------------------------------------- 7. SSO disabled -> SSO login fails
def test_sso_disabled_login_fails(client):
    config = load_config()
    config.sso_config = None
    save_config(config)

    resp = client.get("/api/auth/sso/login")
    assert resp.status_code == 400

    status = client.get("/api/auth/sso/status").json()
    assert status["enabled"] is False


# ------------------------------------------ 8. Roles preserved LDAP + SSO mapping
def test_roles_preserved_across_ldap_and_sso(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    enable_sso(config)
    save_config(config)

    # Login via LDAP -> role Admin
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p, groups=["admins"]))
    ldap_resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert ldap_resp.status_code == 200
    assert ldap_resp.json()["role"] == "Admin"

    # Same logical person via SSO (different sub, same username)
    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-different",
            "iss": FAKE_ISSUER,
            "preferred_username": "jdoe",
            "name": "Jane Doe",
            "email": "jane@example.com",
        },
    )
    sso_resp = run_sso_login(client)
    assert sso_resp.status_code == 302

    users = db_session.query(User).filter(User.username == "jdoe").all()
    assert len(users) == 1  # same account, not duplicated
    user = users[0]
    assert user.role == "Admin"  # manually/LDAP-assigned role preserved
    assert user.is_sso is True
    assert user.sso_sub == "sub-different"


# ----------------------------------------- 9. direct API call cannot bypass LDAP
def test_direct_api_call_cannot_bypass_disabled_ldap(client, monkeypatch):
    from app.ldap import authenticate_ldap_user

    config = load_config()
    _add_enabled_ldap_config(config)
    config.ldap_enabled = False
    save_config(config)

    # Defense in depth: low-level LDAP helper refuses without any network I/O
    assert authenticate_ldap_user("jdoe", "wrong-pw") is None


def test_direct_login_endpoint_cannot_bypass_disabled_ldap(client, monkeypatch):
    # (sub-case of 9): the HTTP endpoint refuses even when LDAP creds are sent
    config = load_config()
    _add_enabled_ldap_config(config)
    config.ldap_enabled = False
    save_config(config)

    resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert resp.status_code == 401
    assert "deaktiviert" in resp.json()["detail"].lower()


# ------------------------------------------------ 10. logout works for both methods
def test_logout_after_ldap_login(client, db_session, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config)
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p))

    login = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert login.status_code == 200
    assert login.cookies.get("access_token")

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert not logout.headers.get("set-cookie") or "access_token=\"\"" in logout.headers.get("set-cookie", "")
    assert "access_token" not in client.cookies

    logs = db_session.query(AuditLog).filter(AuditLog.action == "LOGOUT").all()
    assert len(logs) == 1


def test_logout_after_sso_login(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config)
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-12345",
            "iss": FAKE_ISSUER,
            "preferred_username": "jdoe",
            "name": "Jane Doe",
            "email": "jane@example.com",
        },
    )

    sso_resp = run_sso_login(client)
    assert sso_resp.status_code == 302
    token = sso_resp.cookies.get("access_token")
    assert token

    client.cookies.set("access_token", token)
    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    sc = logout.headers.get("set-cookie", "")
    assert "access_token" in sc and ("access_token=;" in sc or "access_token=\"\"" in sc or "Max-Age=0" in sc or "expires" in sc.lower())

    logs = db_session.query(AuditLog).filter(AuditLog.action == "LOGOUT").all()
    assert len(logs) == 1


# ------------------------------------------- 11. SSO group claiming (groups scope)
def test_sso_groups_scope_requested_in_authorization_url(client, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"it-admins": "Admin"})
    save_config(config)

    resp = client.get("/api/auth/sso/login")
    assert resp.status_code == 200, resp.text
    from urllib.parse import parse_qs, urlsplit
    scope = parse_qs(urlsplit(resp.json()["redirect_url"]).query)["scope"][0]
    parts = scope.split()
    assert "openid" in parts
    assert "groups" in parts  # group claiming per scope groups


def test_sso_group_claim_maps_role_for_new_user(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"it-admins": "Admin", "developers": "Creator"})
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-g1",
            "iss": FAKE_ISSUER,
            "preferred_username": "adminuser",
            "name": "Admin User",
            "email": "admin@example.com",
            "groups": ["developers", "it-admins"],
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302
    assert resp.cookies.get("access_token")

    user = db_session.query(User).filter(User.username == "adminuser").first()
    assert user is not None
    assert user.is_sso is True
    assert user.role == "Admin"  # highest matching role wins

    # audit contains the claimed groups (no secrets)
    logs = db_session.query(AuditLog).filter(AuditLog.action == "SSO_LOGIN_SUCCESS").all()
    assert any("it-admins" in (log.details or "") for log in logs)


def test_sso_group_claim_string_groups_claim_normalized(client, db_session, sso_discovery, monkeypatch):
    # Some IdPs (e.g. Keycloak) return the claim as a comma-separated string
    config = load_config()
    enable_sso(config, group_mapping={"devs": "Creator"})
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-g2",
            "iss": FAKE_ISSUER,
            "preferred_username": "devuser",
            "name": "Dev User",
            "email": "dev@example.com",
            "groups": "devs",
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "devuser").first()
    assert user is not None
    assert user.role == "Creator"


def test_sso_group_claim_custom_claim_name(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"superusers": "Root"}, groups_claim="roles")
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-g3",
            "iss": FAKE_ISSUER,
            "preferred_username": "rootuser",
            "name": "Root User",
            "email": "root@example.com",
            "roles": ["superusers"],
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "rootuser").first()
    assert user is not None
    assert user.role == "Root"


def test_sso_group_claim_only_upgrades_existing_role(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"it-admins": "Admin"})
    save_config(config)

    # User already exists with a manually assigned role "Creator"
    from tests.conftest import make_local_user
    make_local_user(db_session, username="bob", role="Creator")
    db_session.query(User).filter(User.username == "bob").update(
        {"is_sso": True, "sso_sub": "sub-bob", "sso_issuer": FAKE_ISSUER}
    )
    db_session.commit()

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-bob",
            "iss": FAKE_ISSUER,
            "preferred_username": "bob",
            "name": "Bob",
            "email": "bob@example.com",
            "groups": ["it-admins"],
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "bob").first()
    assert user is not None
    assert user.role == "Admin"  # elevated by group claiming


def test_sso_group_claim_never_demotes_assigned_role(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"it-admins": "Admin"})
    save_config(config)

    # Root account logs in via SSO but its groups only map to Admin -> stays Root
    from tests.conftest import make_local_user
    make_local_user(db_session, username="carol", role="Root")
    db_session.query(User).filter(User.username == "carol").update(
        {"is_sso": True, "sso_sub": "sub-carol", "sso_issuer": FAKE_ISSUER}
    )
    db_session.commit()

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-carol",
            "iss": FAKE_ISSUER,
            "preferred_username": "carol",
            "name": "Carol",
            "email": "carol@example.com",
            "groups": ["it-admins"],
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "carol").first()
    assert user is not None
    assert user.role == "Root"


def test_sso_no_group_mapping_defaults_to_user_role(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config)  # no group_to_role_mapping configured
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sub-g4",
            "iss": FAKE_ISSUER,
            "preferred_username": "nouser",
            "name": "No User",
            "email": "no@example.com",
            "groups": ["whatever"],
        },
    )

    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "nouser").first()
    assert user is not None
    assert user.role == "User"


# ------------------------------------------- 12. id_token verification hardening
def test_idtoken_issuer_trailing_slash_normalized_and_retry(client, sso_discovery, monkeypatch):
    """Trailing slash in issuer_url must not break verification; failure reason is
    surfaced and a JWKS refresh retry is performed."""
    import types
    from jose import JWTError
    from fastapi import HTTPException

    captured = {}
    calls = {"n": 0}

    def fake_decode(token, key, **kwargs):
        captured["issuer"] = kwargs.get("issuer")
        calls["n"] += 1
        raise JWTError("Signature verification failed.")

    monkeypatch.setattr(sso_mod, "jose_jwt", types.SimpleNamespace(
        get_unverified_header=lambda t: {"alg": "RS256", "kid": "k1"},
        decode=fake_decode,
    ))
    monkeypatch.setattr(sso_mod, "_get_jwks", lambda iss: [{"kty": "RSA", "kid": "k1"}])
    monkeypatch.setattr(sso_mod.jose_jwk, "construct", lambda k, algorithm=None: object())

    cfg = SsoConfig(enabled=True, issuer_url="https://idp.example.com/realms/ucs/", client_id="c")
    with pytest.raises(HTTPException) as exc:
        sso_mod._verify_id_token("tok", cfg, "nonce1")

    assert captured["issuer"] == "https://idp.example.com/realms/ucs"
    assert "Signature verification failed" in exc.value.detail
    assert calls["n"] >= 2  # JWKS cache was invalidated and retried


def test_idtoken_verification_success_with_nonce(client, sso_discovery, monkeypatch):
    import time
    import types

    claims = {
        "sub": "sub-x",
        "iss": "https://idp.example.com/realms/ucs",
        "aud": "c",
        "nonce": "nonce123",
        "exp": int(time.time()) + 3600,
    }
    monkeypatch.setattr(sso_mod, "jose_jwt", types.SimpleNamespace(
        get_unverified_header=lambda t: {"alg": "RS256", "kid": "k1"},
        decode=lambda tok, key, **kw: dict(claims),
    ))
    monkeypatch.setattr(sso_mod, "_get_jwks", lambda iss: [{"kty": "RSA", "kid": "k1"}])
    monkeypatch.setattr(sso_mod.jose_jwk, "construct", lambda k, algorithm=None: object())

    cfg = SsoConfig(enabled=True, issuer_url="https://idp.example.com/realms/ucs", client_id="c")
    result = sso_mod._verify_id_token("tok", cfg, "nonce123")
    assert result["sub"] == "sub-x"


def test_idtoken_nonce_mismatch_rejected(client, sso_discovery, monkeypatch):
    import time
    import types

    claims = {
        "sub": "sub-x",
        "iss": "https://idp.example.com/realms/ucs",
        "aud": "c",
        "nonce": "other-nonce",
        "exp": int(time.time()) + 3600,
    }
    from fastapi import HTTPException

    monkeypatch.setattr(sso_mod, "jose_jwt", types.SimpleNamespace(
        get_unverified_header=lambda t: {"alg": "RS256", "kid": "k1"},
        decode=lambda tok, key, **kw: dict(claims),
    ))
    monkeypatch.setattr(sso_mod, "_get_jwks", lambda iss: [{"kty": "RSA", "kid": "k1"}])
    monkeypatch.setattr(sso_mod.jose_jwk, "construct", lambda k, algorithm=None: object())

    cfg = SsoConfig(enabled=True, issuer_url="https://idp.example.com/realms/ucs", client_id="c")
    with pytest.raises(HTTPException) as exc:
        sso_mod._verify_id_token("tok", cfg, "nonce123")
    assert "nonce" in exc.value.detail.lower()