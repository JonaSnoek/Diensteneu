"""Tests for group/role claiming across LDAP and SSO (brief sections 13-22).

Core rule: groups from *all* authentication sources are merged; the highest
permission level wins and a lower role never overrides a higher one.
"""
import pytest

from app.config import LdapServerConfig, load_config, save_config
from app.models.user import User
from app.role_mapping import (
    ROLE_PRIORITY,
    canonicalize_role,
    effective_role_for_user,
    get_effective_role,
    map_groups_to_role,
)
from app.security import require_admin, require_creator
import app.routers.auth as auth_mod
import app.routers.sso as sso_mod

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
            group_to_role_mapping=mapping or {"admins": "Administrator"},
            enabled=True,
        )
    ]
    save_config(config)


# --------------------------------------------------------- alias & mapping unit tests
def test_administrator_alias_maps_to_admin():
    assert canonicalize_role("Administrator") == "Admin"
    assert ROLE_PRIORITY["Admin"] == 5


def test_map_groups_to_role_uses_alias_and_highest_wins():
    mapping = {
        "Users": "User",
        "Editors": "Editor",
        "Moderators": "Moderator",
        "Admins": "Administrator",
    }
    assert map_groups_to_role(["Users", "Admins"], mapping) == "Admin"
    assert map_groups_to_role(["Users"], mapping) == "User"
    assert map_groups_to_role(["Editors"], mapping) == "Editor"
    assert map_groups_to_role(["Moderators"], mapping) == "Moderator"


def test_unknown_target_role_never_downgrades():
    mapping = {"Weird": "Administratr"}  # typo -> unknown
    assert map_groups_to_role(["Weird"], mapping) == "User"
    assert get_effective_role("Admin", [""], [""], mapping, {}) == "Admin"


# ------------------------------------------------- role priority scenarios (confidence: brief)
@pytest.mark.parametrize("ldap_groups, sso_groups, expected", [
    (["Users"], ["Users"], "User"),            # LDAP User + SSO User -> User
    (["Users"], ["Admins"], "Admin"),          # LDAP User + SSO Admins -> Administrator
    (["Editors"], ["Users"], "Editor"),        # LDAP Editor + SSO User -> Editor
    (["Admins"], ["Users"], "Admin"),          # LDAP Admins + SSO User -> Administrator
    (["Editors"], ["Admins"], "Admin"),        # LDAP Editor + SSO Admins -> Administrator
    (["Moderators"], ["Admins"], "Admin"),     # LDAP Moderator + SSO Admins -> Administrator
])
def test_role_priority_scenarios(ldap_groups, sso_groups, expected):
    mapping = {
        "Users": "User",
        "Editors": "Editor",
        "Moderators": "Moderator",
        "Admins": "Administrator",
    }
    stored = get_effective_role("User", ldap_groups, sso_groups, mapping, mapping)
    assert stored == expected


def test_guest_stays_guest_even_with_mappings():
    mapping = {"Admins": "Administrator"}
    assert get_effective_role("Guest", ["Admins"], ["Admins"], mapping, mapping) == "Guest"


def test_groups_of_both_sources_are_merged():
    # LDAP: User + Schule | SSO: Admins + Technik -> Administrator
    role = get_effective_role(
        "User",
        ldap_groups=["User", "Schule"],
        sso_groups=["Admins", "Technik"],
        ldap_mapping={"User": "User"},
        sso_mapping={"Admins": "Administrator"},
    )
    assert role == "Admin"


def test_lower_mapping_never_overrides_higher_role():
    assert get_effective_role("Admin", ["Users"], ["Users"], {"Users": "User"}, {"Users": "User"}) == "Admin"
    assert get_effective_role("Editor", ["Users"], ["Users"], {"Users": "User"}, {"Users": "User"}) == "Editor"


def test_highest_of_stored_and_mapped_wins():
    assert get_effective_role("User", ["Admins"], [], {"Admins": "Administrator"}, {}) == "Admin"


# ------------------------------------------------- disabled LDAP only blocks LDAP auth
def test_disabled_ldap_does_not_block_sso_group_processing(client, db_session):
    config = load_config()
    config.ldap_configs = [
        LdapServerConfig(
            name="Off LDAP",
            server_url="ldap://127.0.0.1:1389",
            base_dn="dc=example,dc=com",
            user_search_filter="(uid={username})",
            group_to_role_mapping={"root_group": "Root"},  # must NOT be applied while disabled
            enabled=False,
        )
    ]
    enable_sso(config, group_mapping={"Readers": "User", "Admins": "Administrator"})
    config.ldap_enabled = False
    save_config(config)

    user = User(
        username="jdoe",
        role="User",
        is_active=True,
        ldap_groups=["root_group"],
        sso_groups=["Readers"],
    )
    db_session.add(user)
    db_session.commit()

    # SSO "Readers" still processed -> User; disabled-LDAP mapping must NOT yield Root.
    assert effective_role_for_user(user) == "User"

    # Same user with SSO Admins group -> Administrator (SSO group processing unaffected)
    user.sso_groups = ["Admins"]
    db_session.commit()
    assert effective_role_for_user(user) == "Admin"


# ------------------------------------------------- permission checks use effective role
def test_rolechecker_uses_effective_role(client, db_session):
    config = load_config()
    enable_sso(config, group_mapping={"Admins": "Administrator"})
    save_config(config)

    user = User(username="max", role="User", is_active=True, sso_groups=["Admins"])
    db_session.add(user)
    db_session.commit()

    assert user.role == "User"  # stored role unchanged
    assert effective_role_for_user(user) == "Admin"  # effective role higher
    assert require_admin(user) is user  # admin endpoint passes via effective role


def test_editor_reaches_creator_but_not_admin(client, db_session):
    config = load_config()
    enable_sso(config, group_mapping={"Editors": "Editor"})
    save_config(config)

    user = User(username="ed", role="User", is_active=True, sso_groups=["Editors"])
    db_session.add(user)
    db_session.commit()

    assert require_creator(user) is user
    with pytest.raises(Exception):
        require_admin(user)


# -------------------------------------------------- API: LDAP + SSO merge, no duplicate
def test_ldap_user_plus_sso_admin_groups_merge_without_duplicate(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config, mapping={"users": "User"})
    enable_sso(config, group_mapping={"Admins": "Administrator"})
    save_config(config)

    # 1) LDAP login: only 'User' group -> role User
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p, groups=["users"]))
    ldap_resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert ldap_resp.status_code == 200
    assert ldap_resp.json()["role"] == "User"

    # 2) Same logical person via SSO with 'Admins' group
    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sso-1",
            "iss": FAKE_ISSUER,
            "preferred_username": "jdoe",
            "name": "Jane Doe",
            "email": "jane@example.com",
            "groups": ["Admins"],
        },
    )
    sso_resp = run_sso_login(client)
    assert sso_resp.status_code == 302

    users = db_session.query(User).filter(User.username == "jdoe").all()
    assert len(users) == 1  # single account, not duplicated
    user = users[0]
    assert user.ldap_groups == ["users"]
    assert user.sso_groups == ["Admins"]  # SSO groups persisted
    assert user.role == "Admin"  # LDAP User + SSO Admins -> Administrator
    assert user.sso_sub == "sso-1"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    data = me.json()
    assert data["role"] == "Admin"
    assert data["effective_role"] == "Admin"


def test_new_sso_user_gets_mapped_role_and_groups_stored(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    enable_sso(config, group_mapping={"Admins": "Administrator"})
    save_config(config)

    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sso-new",
            "iss": FAKE_ISSUER,
            "preferred_username": "newsso",
            "name": "New SSO",
            "groups": ["Admins"],
        },
    )
    resp = run_sso_login(client)
    assert resp.status_code == 302

    user = db_session.query(User).filter(User.username == "newsso").first()
    assert user is not None
    assert user.role == "Admin"
    assert user.sso_groups == ["Admins"]


# ------------------------------------------------- SSO group catalog for the admin UI
def test_sso_groups_endpoint_aggregates_only_for_admins(client, db_session):
    from tests.conftest import make_local_user
    config = load_config()
    enable_sso(config, group_mapping={"Teachers": "Editor", "Admins": "Administrator"})
    save_config(config)

    db_session.add_all([
        User(username="bob", role="User", is_active=True, sso_groups=["Admins"]),
        User(username="carol", role="User", is_active=True, sso_groups=["Students", "Teachers"]),
        make_local_user(db_session, username="root", role="Root"),
    ])
    db_session.commit()

    # unauthenticated -> 401
    assert client.get("/api/auth/sso/groups").status_code == 401

    login = client.post("/api/auth/login", json={"username": "root", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    resp = client.get("/api/auth/sso/groups", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    # groups from users' SSO claims + already configured mapping keys, deduplicated
    assert set(resp.json()["groups"]) == {"Admins", "Students", "Teachers"}


def test_sso_user_group_never_downgrades_ldap_admin(client, db_session, sso_discovery, monkeypatch):
    config = load_config()
    _add_enabled_ldap_config(config, mapping={"admins": "Administrator"})
    enable_sso(config, group_mapping={"Users": "User"})
    save_config(config)

    # LDAP login -> Administrator
    monkeypatch.setattr(auth_mod, "authenticate_ldap_user",
                        lambda u, p: fake_ldap_auth(u, p, groups=["admins"]))
    ldap_resp = client.post("/api/auth/login", json={"username": "jdoe", "password": "pw"})
    assert ldap_resp.status_code == 200
    assert ldap_resp.json()["role"] == "Admin"

    # SSO login offers only the lowly 'User' group -> must NOT downgrade
    monkeypatch.setattr(
        sso_mod, "resolve_identity",
        lambda oidc, code, nonce: {
            "sub": "sso-2",
            "iss": FAKE_ISSUER,
            "preferred_username": "jdoe",
            "groups": ["Users"],
        },
    )
    sso_resp = run_sso_login(client)
    assert sso_resp.status_code == 302

    user = db_session.query(User).filter(User.username == "jdoe").first()
    assert user.role == "Admin"