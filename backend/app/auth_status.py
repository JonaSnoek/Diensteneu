"""Central helpers to evaluate the effective authentication configuration.

LDAP and SSO are fully independent. LDAP can be:
  - enabled
  - temporarily disabled (auto re-enables once `ldap_disabled_until` is reached)
  - permanently disabled (`ldap_enabled == False`)

All timestamps are stored as timezone-aware ISO 8601 (typically UTC). Comparisons
always use aware UTC datetimes so shifts across timezones cannot bypass a
temporary deactivation.
"""
import datetime
import logging
from typing import Any, Dict, Optional

from app.config import AppConfig, load_config

logger = logging.getLogger(__name__)


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime.datetime]:
    """Parse an ISO 8601 string into a timezone-aware datetime (UTC)."""
    if not value:
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(value))
    except (ValueError, TypeError):
        logger.warning("Invalid disabled_until timestamp %r ignored", value)
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def is_ldap_enabled(config: Optional[AppConfig] = None) -> bool:
    """Effective LDAP availability. Enforced on the server for every login attempt."""
    config = config or load_config()

    if not config.ldap_enabled:
        return False

    until = parse_iso_datetime(config.ldap_disabled_until)
    if until is not None and utc_now() < until:
        return False

    return True


def ldap_state(config: Optional[AppConfig] = None) -> str:
    """Return one of: 'active', 'temp_disabled', 'permanently_disabled'."""
    config = config or load_config()

    if not config.ldap_enabled:
        return "permanently_disabled"

    until = parse_iso_datetime(config.ldap_disabled_until)
    if until is not None and utc_now() < until:
        return "temp_disabled"

    return "active"


def ldap_status(config: Optional[AppConfig] = None) -> Dict[str, Any]:
    """Full LDAP status document for the admin area."""
    config = config or load_config()
    until = parse_iso_datetime(config.ldap_disabled_until)
    enabled = is_ldap_enabled(config)

    return {
        "enabled": enabled,
        "master_enabled": bool(config.ldap_enabled),
        "disabled_until": until.isoformat() if until else None,
        "state": ldap_state(config),
        "auto_enable_at": until.isoformat() if until is not None and until > utc_now() else None,
    }


def sso_status(config: Optional[AppConfig] = None) -> Dict[str, Any]:
    """SSO status document. SSO is independent of LDAP."""
    config = config or load_config()
    sso = config.sso_config
    enabled = bool(sso and sso.enabled and sso.issuer_url and sso.client_id)
    return {
        "enabled": enabled,
        "provider_name": (sso.provider_name if sso else None),
    }