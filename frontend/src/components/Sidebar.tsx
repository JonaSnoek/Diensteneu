import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Server, Cloud, Activity, BookOpen, Shield,
  ChevronDown, LogOut, Settings, Wifi, HardDrive, Cpu, Users,
} from 'lucide-react';
import { useState } from 'react';
import Logo from './Logo';
import type { UserType } from '../App';

type SidebarProps = {
  user: UserType;
  onLogout: () => void;
};

type NavItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string }[];
};

const navItems: NavItem[] = [
  {
    label: 'Desktop',
    icon: <LayoutDashboard size={18} />,
    path: '/desktop',
    children: [
      { label: 'Alle Kacheln', path: '/desktop' },
      { label: 'Software', path: '/desktop/software' },
      { label: 'Hardware', path: '/desktop/hardware' },
    ],
  },
  {
    label: 'Netzwerk',
    icon: <Wifi size={18} />,
    path: '/netzwerk',
  },
  {
    label: 'Server',
    icon: <Server size={18} />,
    path: '/server',
  },
  {
    label: 'Virtualisierung',
    icon: <Cloud size={18} />,
    path: '/virtualisierung',
  },
  {
    label: 'Monitoring',
    icon: <Activity size={18} />,
    path: '/monitoring',
  },
  {
    label: 'Dokumentation',
    icon: <BookOpen size={18} />,
    path: '/dokumentation',
  },
  {
    label: 'Administration',
    icon: <Shield size={18} />,
    path: '/admin',
    children: [
      { label: 'Benutzer', path: '/admin/users' },
      { label: 'LDAP / AD', path: '/admin/ldap' },
      { label: 'Kacheln (Tiles)', path: '/admin/launchers' },
      { label: 'HTML-Module', path: '/admin/modules' },
      { label: 'Einstellungen', path: '/admin/system' },
      { label: 'Audit-Logs', path: '/admin/audit' },
    ],
  },
];

function Sidebar({ user, onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string[]>(['Desktop', 'Administration']);

  const toggleExpand = (label: string) => {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/desktop') return location.pathname === '/desktop' || location.pathname.startsWith('/desktop/');
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside style={{
      width: '260px',
      minWidth: '260px',
      height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <Logo />
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {navItems.map(item => (
          <div key={item.label} style={{ marginBottom: '2px' }}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpand(item.label)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'transparent', border: 'none', color: 'var(--text)',
                    fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex' }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: isActive(item.path) ? 600 : 400 }}>
                    {item.label}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'var(--text-muted)',
                      transform: expanded.includes(item.label) ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
                {expanded.includes(item.label) && (
                  <div style={{ marginLeft: '8px' }}>
                    {item.children.map(child => (
                      <button
                        key={child.path}
                        onClick={() => navigate(child.path)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          width: '100%', padding: '8px 12px 8px 40px', borderRadius: 'var(--radius-sm)',
                          background: location.pathname === child.path ? 'var(--primary)' : 'transparent',
                          border: 'none', color: location.pathname === child.path ? '#fff' : 'var(--text-secondary)',
                          fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (location.pathname !== child.path) {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (location.pathname !== child.path) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => item.path && navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  background: isActive(item.path) ? 'var(--primary)' : 'transparent',
                  border: 'none', color: isActive(item.path) ? '#fff' : 'var(--text)',
                  fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ color: isActive(item.path) ? '#fff' : 'var(--text-secondary)', display: 'flex' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )}
          </div>
        ))}
      </nav>

      <div style={{
        padding: '16px', borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--primary)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
          }}>
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.display_name}
            </div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>
              {user.role}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            padding: '8px', borderRadius: 'var(--radius-sm)', width: '100%',
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <LogOut size={14} /> Abmelden
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
