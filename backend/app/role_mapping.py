"""Shared role-mapping helper.

Both LDAP and SSO map directory/IdP group memberships to portal roles using the
same "highest matching role" semantics. The role hierarchy is:
Root > Admin > Creator > User > Guest.
"""
from typing import Dict, List

ROLE_PRIORITY = {"Root": 5, "Admin": 4, "Creator": 3, "User": 2, "Guest": 1}
DEFAULT_ROLE = "User"


def map_groups_to_role(groups: List[str], mapping: Dict[str, str]) -> str:
    """Return the highest portal role the given groups map to (default 'User')."""
    highest_role = DEFAULT_ROLE
    highest_priority = ROLE_PRIORITY[DEFAULT_ROLE]

    for group in groups or []:
        for group_name, target_role in (mapping or {}).items():
            if group_name.lower() == str(group).lower():
                priority = ROLE_PRIORITY.get(target_role, 0)
                if priority > highest_priority:
                    highest_role = target_role
                    highest_priority = priority

    return highest_role


def role_is_higher(role: str, other: str) -> bool:
    """True if `role` is higher (or equal) in the hierarchy than `other`."""
    return ROLE_PRIORITY.get(role, 0) >= ROLE_PRIORITY.get(other, 0)