"""Tests for the three independently replaceable logo slots
(login logo, header logo, favicon) and the favicon serve endpoint.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tests.conftest import make_local_user
import app.routers.system as system_mod


def _auth_headers(client):
    login = client.post("/api/auth/login", json={"username": "root", "password": "admin123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _upload(client, headers, target, name="logo.svg", body=b"<svg/>"):
    resp = client.post(
        f"/api/system/upload-logo?target={target}",
        files={"file": (name, body, "image/svg+xml")},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["logo_url"]


def test_three_logo_slots_independent(client, db_session, monkeypatch, tmp_path):
    make_local_user(db_session, username="root", role="Root")
    db_session.commit()

    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(system_mod, "UPLOADS_DIR", upload_dir)
    monkeypatch.setattr(system_mod, "LOGO_DIR", upload_dir / "logos")

    headers = _auth_headers(client)
    login_url = _upload(client, headers, "login", body=b"<svg login/>")
    header_url = _upload(client, headers, "header", body=b"<svg header/>")
    favicon_url = _upload(client, headers, "favicon", body=b"<svg favicon/>")

    settings = client.get("/api/system/settings").json()
    assert settings["login_logo_url"] == login_url
    assert settings["header_logo_url"] == header_url
    assert settings["favicon_url"] == favicon_url
    # legacy alias still kept in sync with the login logo
    assert settings["logo_url"] == login_url

    # Replacing the header logo must not touch login or favicon slots
    new_header = _upload(client, headers, "header", name="header2.svg", body=b"<svg header2/>")
    settings = client.get("/api/system/settings").json()
    assert settings["header_logo_url"] == new_header
    assert settings["login_logo_url"] == login_url
    assert settings["favicon_url"] == favicon_url

    # Old header file gets cleaned from disk, other files survive
    files = sorted(p.name for p in (upload_dir / "logos").iterdir())
    assert files.count(Path(login_url).name) == 1
    assert files.count(Path(favicon_url).name) == 1
    assert any(f == Path(new_header).name for f in files)
    assert not any(f == Path(header_url).name for f in files)

    # Favicon endpoint serves the uploaded file
    fav = client.get("/api/system/favicon")
    assert fav.status_code == 200
    assert fav.headers["content-type"].startswith("image/svg")
    assert fav.content == b"<svg favicon/>"


def test_favicon_endpoint_requires_config(client, monkeypatch, tmp_path):
    # nothing uploaded -> 404
    assert client.get("/api/system/favicon").status_code == 404


def test_upload_requires_admin(client, db_session, monkeypatch, tmp_path):
    make_local_user(db_session, username="jdoe", role="User")
    db_session.commit()

    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(system_mod, "UPLOADS_DIR", upload_dir)
    monkeypatch.setattr(system_mod, "LOGO_DIR", upload_dir / "logos")

    login = client.post("/api/auth/login", json={"username": "jdoe", "password": "admin123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = client.post(
        "/api/system/upload-logo?target=header",
        files={"file": ("logo.svg", b"<svg/>", "image/svg+xml")},
        headers=headers,
    )
    assert resp.status_code == 403