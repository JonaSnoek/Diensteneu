import logging
from typing import Optional, Dict, Any, List, Tuple
from ldap3 import Server, Connection, ALL, SUBTREE
from app.config import load_config, LdapServerConfig

logger = logging.getLogger(__name__)

def authenticate_ldap_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Attempts to authenticate a user against all enabled LDAP servers.
    Returns user details (username, display_name, email, groups, dn) if successful, None otherwise.
    """
    config = load_config()
    enabled_ldaps = [c for c in config.ldap_configs if c.enabled]
    
    if not enabled_ldaps:
        return None

    for ldap_cfg in enabled_ldaps:
        try:
            # Connect to server
            server = Server(ldap_cfg.server_url, get_info=ALL, use_ssl=ldap_cfg.use_ssl)
            
            # Establish admin/bind connection
            if ldap_cfg.bind_dn:
                conn = Connection(
                    server, 
                    user=ldap_cfg.bind_dn, 
                    password=ldap_cfg.bind_password, 
                    auto_bind=True
                )
            else:
                conn = Connection(server, auto_bind=True) # Anonymous bind
                
            # Build search filter – ensure it includes a username match
            raw = ldap_cfg.user_search_filter
            if "{username}" in raw:
                user_filter = raw.format(username=username)
            else:
                user_filter = f"(&({raw})(|(uid={username})(sAMAccountName={username})(cn={username})))"
            logger.info(f"Searching LDAP user: {username} with filter {user_filter} on {ldap_cfg.server_url}")
            
            conn.search(
                search_base=ldap_cfg.base_dn,
                search_filter=user_filter,
                search_scope=SUBTREE,
                attributes=['cn', 'displayName', 'mail', 'memberOf', 'uid']
            )
            
            if not conn.entries:
                logger.warning(f"User {username} not found in LDAP server {ldap_cfg.name}")
                conn.unbind()
                continue
                
            user_entry = conn.entries[0]
            user_dn = user_entry.entry_dn
            
            # Now authenticate the user by binding with user's DN and password
            user_conn = Connection(server, user=user_dn, password=password)
            if not user_conn.bind():
                logger.warning(f"LDAP authentication failed for user {username} (bind failed)")
                conn.unbind()
                continue
                
            # Authentication successful! Extract attributes
            display_name = username
            if 'displayName' in user_entry and user_entry.displayName:
                display_name = str(user_entry.displayName)
            elif 'cn' in user_entry and user_entry.cn:
                display_name = str(user_entry.cn)
                
            email = None
            if 'mail' in user_entry and user_entry.mail:
                email = str(user_entry.mail)
                
            # Extract groups
            groups = []
            if 'memberOf' in user_entry:
                groups = [str(g).split(",")[0].replace("CN=", "") for g in user_entry.memberOf]
            
            # Fallback search for groups if user has no memberOf attribute (e.g. some OpenLDAP set ups)
            if not groups and ldap_cfg.group_search_filter:
                group_filter = ldap_cfg.group_search_filter.format(username=username, dn=user_dn)
                conn.search(
                    search_base=ldap_cfg.base_dn,
                    search_filter=group_filter,
                    search_scope=SUBTREE,
                    attributes=['cn']
                )
                groups = [str(e.cn) for e in conn.entries if 'cn' in e]

            conn.unbind()
            user_conn.unbind()
            
            return {
                "username": username,
                "display_name": display_name,
                "email": email,
                "groups": groups,
                "dn": user_dn,
                "ldap_config_name": ldap_cfg.name
            }
            
        except Exception as e:
            logger.error(f"Error during LDAP login on {ldap_cfg.name} ({ldap_cfg.server_url}): {e}")
            
    return None

def test_ldap_connection(ldap_cfg: LdapServerConfig) -> Tuple[bool, str]:
    """Tests connection parameters to a specific LDAP server configuration."""
    try:
        server = Server(ldap_cfg.server_url, get_info=ALL, use_ssl=ldap_cfg.use_ssl)
        if ldap_cfg.bind_dn:
            conn = Connection(
                server, 
                user=ldap_cfg.bind_dn, 
                password=ldap_cfg.bind_password, 
                auto_bind=True
            )
        else:
            conn = Connection(server, auto_bind=True)
            
        # Perform simple root query to verify DN access
        conn.search(
            search_base=ldap_cfg.base_dn,
            search_filter="(objectClass=*)",
            search_scope=SUBTREE,
            attributes=['cn']
        )
        
        entry_count = len(conn.entries)
        conn.unbind()
        return True, f"Connection successful. Found {entry_count} entries at base DN."
    except Exception as e:
        return False, str(e)

def sync_ldap_users_and_groups() -> List[Dict[str, Any]]:
    """
    Syncs users from all active LDAP directories.
    In real usage, we would scan LDAP for users and update database caches, roles, etc.
    This helper provides structure for batch syncing.
    """
    config = load_config()
    results = []
    
    for ldap_cfg in config.ldap_configs:
        if not ldap_cfg.enabled:
            continue
            
        try:
            server = Server(ldap_cfg.server_url, get_info=ALL, use_ssl=ldap_cfg.use_ssl)
            if ldap_cfg.bind_dn:
                conn = Connection(server, user=ldap_cfg.bind_dn, password=ldap_cfg.bind_password, auto_bind=True)
            else:
                conn = Connection(server, auto_bind=True)
                
            # Search all users
            # E.g. using a broad user query filter
            conn.search(
                search_base=ldap_cfg.base_dn,
                search_filter="(objectClass=person)",
                search_scope=SUBTREE,
                attributes=['uid', 'cn', 'displayName', 'mail', 'memberOf']
            )
            
            synced_users = []
            for entry in conn.entries:
                username = None
                if 'uid' in entry and entry.uid:
                    username = str(entry.uid)
                elif 'cn' in entry and entry.cn:
                    username = str(entry.cn)
                    
                if not username:
                    continue
                    
                display_name = str(entry.displayName) if 'displayName' in entry else username
                email = str(entry.mail) if 'mail' in entry else None
                
                # Fetch groups
                groups = []
                if 'memberOf' in entry:
                    groups = [str(g).split(",")[0].replace("CN=", "") for g in entry.memberOf]
                
                synced_users.append({
                    "username": username,
                    "display_name": display_name,
                    "email": email,
                    "groups": groups,
                    "dn": entry.entry_dn
                })
                
            conn.unbind()
            results.append({
                "ldap_name": ldap_cfg.name,
                "users": synced_users,
                "status": "Success"
            })
        except Exception as e:
            results.append({
                "ldap_name": ldap_cfg.name,
                "status": "Failed",
                "error": str(e)
            })
            
    return results
