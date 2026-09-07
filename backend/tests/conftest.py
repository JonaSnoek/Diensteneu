import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

import app.config as config_mod
import app.database as database_mod
import app.routers.sso as sso_mod
from app.main import app as fastapi_app

FAKE_ISSUER = "https://idp.example.com/issuer"
FAKE_REDIRECT = "http://localhost/api/auth/sso/callback"


def make_local_user(db, username="admin", password="admin123", role="Root", is_active=True):
    from app.models.user import User
    from app.security import get_password_hash
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        display_name=username,
        is_active=is_active,
        is_ldap=False,
        is_sso=False,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def enable_sso(config, group_mapping=None, groups_claim="groups", scopes="openid profile email groups"):
    from app.config import SsoConfig
    config.sso_config = SsoConfig(
        enabled=True,
        provider_name="Test IdP",
        issuer_url=FAKE_ISSUER,
        client_id="portal-client",
        client_secret="s3cret",
        redirect_uri=FAKE_REDIRECT,
        scopes=scopes,
        username_claim="preferred_username",
        display_name_claim="name",
        email_claim="email",
        groups_claim=groups_claim,
        group_to_role_mapping=group_mapping or {},
    )
    config_mod.save_config(config)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Isolated config + SQLite DB + FastAPI TestClient per test."""
    cfg_file = tmp_path / "config.json"
    monkeypatch.setattr(config_mod, "CONFIG_FILE_PATH", cfg_file)
    config_mod._active_config = None

    db_file = tmp_path / "test_portal.db"
    config = config_mod.load_config()
    config.database_url = f"sqlite:///{db_file.as_posix()}"
    config.setup_completed = True
    config.ldap_enabled = True
    config.ldap_disabled_until = None
    config.ldap_configs = []
    config.sso_config = None
    config_mod.save_config(config)

    database_mod.reset_db_engine()
    database_mod.create_tables()

    sso_mod._oidc_states.clear()
    sso_mod._discovery_cache.clear()
    sso_mod._jwks_cache.clear()

    with TestClient(fastapi_app) as c:
        yield c

    database_mod.reset_db_engine()
    config_mod._active_config = None


@pytest.fixture()
def db_session(tmp_path, monkeypatch):
    """Direct SQLAlchemy session bound to the test database config."""
    cfg_file = tmp_path / "config.json"
    monkeypatch.setattr(config_mod, "CONFIG_FILE_PATH", cfg_file)
    config_mod._active_config = None

    db_file = tmp_path / "test_db_sess.db"
    config = config_mod.load_config()
    config.database_url = f"sqlite:///{db_file.as_posix()}"
    config.setup_completed = True
    config.ldap_enabled = True
    config.ldap_disabled_until = None
    config.ldap_configs = []
    config.sso_config = None
    config_mod.save_config(config)

    database_mod.reset_db_engine()
    database_mod.create_tables()

    session = database_mod._SessionFactory()
    try:
        yield session
    finally:
        session.close()
        database_mod.reset_db_engine()
        config_mod._active_config = None


@pytest.fixture()
def sso_discovery(monkeypatch):
    """Mock the OIDC discovery so no external network is required."""
    discovery = {
        "issuer": FAKE_ISSUER,
        "authorization_endpoint": "https://idp.example.com/authorize",
        "token_endpoint": "https://idp.example.com/token",
        "userinfo_endpoint": "https://idp.example.com/userinfo",
        "jwks_uri": "https://idp.example.com/jwks",
    }
    monkeypatch.setattr(sso_mod, "discover_oidc", lambda issuer: discovery)
    monkeypatch.setattr(sso_mod, "exchange_code", lambda oidc, disc, code: {"access_token": "fake-at", "id_token": None})
    monkeypatch.setattr(sso_mod, "fetch_userinfo", lambda disc, at: {})
    return discovery


def fake_ldap_auth(username, password, groups=()):
    return {
        "username": username,
        "display_name": username.capitalize(),
        "email": f"{username}@example.com",
        "groups": list(groups),
        "dn": f"uid={username},dc=example,dc=com",
        "ldap_config_name": "Test LDAP",
    }


def run_sso_login(client) -> dict:
    """Perform a full SSO callback round-trip and return the 302 response (without following it)."""
    login_resp = client.get("/api/auth/sso/login")
    assert login_resp.status_code == 200, login_resp.text
    redirect_url = login_resp.json()["redirect_url"]
    from urllib.parse import parse_qs, urlsplit
    state = parse_qs(urlsplit(redirect_url).query)["state"][0]
    return client.get(
        f"/api/auth/sso/callback?code=fake-code&state={state}",
        follow_redirects=False,
    )