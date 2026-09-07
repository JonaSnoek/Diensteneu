"""Shared group/role claiming helper.

Group memberships from *all* authentication sources (LDAP and SSO) are merged
and mapped onto the internal portal roles; the **highest** matching role always
wins and a lower role never overrides a higher one.

Role hierarchy (highest wins):
Root > Admin > Moderator > Creator = Editor > User > Guest

Synonym handling: configuration may use "Administrator" instead of "Admin";
the name is normalised to the internal role so existing mappings keep working.
Unknown target roles are ignored – a typo can never demote a user.
"""
from typing import Dict, List, Optional

ROLE_PRIORITY = {
    "Root": 6,
    "Admin": 5,
    "Moderator": 4,
    "Creator": 3,
    "Editor": 3,
    "User": 2,
    "Guest": 1,
}
DEFAULT_ROLE = "User"

# Role names usable in group->role mappings / manual role selection that are
# normalised onto the internal roles (e.g. group "Admins" -> "Administrator").
ROLE_ALIASES = {
    "Administrator": "Admin",
}


def canonicalize_role(role: Optional[str]) -> str:
    """Return the internal role name for synonyms such as 'Administrator'."""
    if not role:
        return DEFAULT_ROLE
    return ROLE_ALIASES.get(role, role)


def role_priority(role: Optional[str]) -> int:
    """Priority of a (possibly aliased) role; 0 for unknown roles."""
    return ROLE_PRIORITY.get(canonicalize_role(role), 0)


def highest_role(*roles: Optional[str]) -> str:
    """Highest *known* role among the given ones.

    Only roles that actually exist in ``ROLE_PRIORITY`` can raise the result –
    unknown targets (typos, not-yet-mapped groups) are ignored. When no role is
    known the default role is returned.
    """
    best = DEFAULT_ROLE
    best_priority = ROLE_PRIORITY[best]
    for role in roles or []:
        canonical = canonicalize_role(role)
        priority = ROLE_PRIORITY.get(canonical, 0)
        if priority > best_priority:
            best = canonical
            best_priority = priority
    return best


def map_groups_to_role(groups: List[str], mapping: Dict[str, str]) -> str:
    """Return the highest portal role the given groups map to (default 'User')."""
    mapped_roles = []
    for group in groups or []:
        for group_name, target_role in (mapping or {}).items():
            if group_name.lower() == str(group).lower():
                mapped_roles.append(target_role)
    return highest_role(*mapped_roles)


def role_is_higher(role: Optional[str], other: Optional[str]) -> bool:
    """True if `role` is higher (or equal) in the hierarchy than `other`."""
    return role_priority(role) >= role_priority(other)


def load_active_group_mappings():
    """(ldap_mapping, sso_mapping) of all *enabled* auth sources.

    Disabled LDAP servers no longer contribute mappings, which implements the
    rule: a deactivated LDAP only blocks LDAP *authentication* – SSO group
    processing is unaffected.
    """
    from app.config import load_config

    config = load_config()
    ldap_mapping: Dict[str, str] = {}
    for ldap_cfg in config.ldap_configs or []:
        if ldap_cfg.enabled:
            ldap_mapping.update(ldap_cfg.group_to_role_mapping or {})
    sso_mapping: Dict[str, str] = {}
    sso = config.sso_config
    if sso and sso.enabled:
        sso_mapping.update(sso.group_to_role_mapping or {})
    return ldap_mapping, sso_mapping


def get_effective_role(
    stored_role: Optional[str],
    ldap_groups: Optional[List[str]] = None,
    sso_groups: Optional[List[str]] = None,
    ldap_mapping: Optional[Dict[str, str]] = None,
    sso_mapping: Optional[Dict[str, str]] = None,
) -> str:
    """Central "getEffectiveRole".

    1. collect LDAP + SSO groups,
    2. map both through the configured group->role mappings,
    3. combine with the stored (manually assigned) role,
    4. the highest role wins – a lower mapping can never demote.

    A stored ``Guest`` role is never elevated (guest access stays guest).
    """
    mapped = map_groups_to_role(
        list((ldap_groups or []) + (sso_groups or [])),
        {**(ldap_mapping or {}), **(sso_mapping or {})},
    )
    if canonicalize_role(stored_role) == "Guest":
        return "Guest"
    return highest_role(stored_role, mapped)


def effective_role_for_user(user) -> str:
    """Effective role for a User record using the currently active mappings."""
    ldap_mapping, sso_mapping = load_active_group_mappings()
    return get_effective_role(
        getattr(user, "role", None),
        getattr(user, "ldap_groups", None),
        getattr(user, "sso_groups", None),
        ldap_mapping,
        sso_mapping,
    )