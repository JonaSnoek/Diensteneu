import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Shield,
  ChevronDown, LogOut, X,
} from 'lucide-react';
import { useState } from 'react';
import Logo from './Logo';
import type { UserType } from '../App';

type SidebarProps = {
  user: UserType;
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
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
    icon: <LayoutDashboard size={17} />,
    path: '/desktop',
    children: [
      { label: 'Alle Kacheln', path: '/desktop' },
      { label: 'Software', path: '/desktop/software' },
      { label: 'Hardware', path: '/desktop/hardware' },
    ],
  },
  {
    label: 'Administration',
    icon: <Shield size={17} />,
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

function Sidebar({ user, onLogout, collapsed, onToggle }: SidebarProps) {
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

  const linkStyle = (active: boolean, child = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: child ? '7px 12px 7px 36px' : '8px 12px',
    borderRadius: '6px',
    background: active ? `rgba(var(--primary-rgb), 0.1)` : 'transparent',
    border: 'none',
    color: active ? 'var(--primary)' : 'var(--text-secondary)',
    fontSize: child ? '0.8rem' : '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'left' as const,
    fontFamily: 'var(--font)',
    fontWeight: active ? 500 : 400,
  });

  const asideStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0,
    width: collapsed ? 0 : 'var(--sidebar-width)',
    height: '100vh',
    background: 'var(--bg-surface)',
    borderRight: collapsed ? 'none' : '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflow: 'hidden',
    transition: 'width 0.2s ease',
  };

  const innerStyle: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.15s',
    transitionDelay: collapsed ? '0s' : '0.05s',
  };

  return (
    <>
      {!collapsed && (
        <div
          onClick={onToggle}
          style={{
            position: 'fixed', inset: 0, zIndex: 99,
            background: 'rgba(0,0,0,0.3)',
          }}
          className="sidebar-overlay"
        />
      )}
      <aside style={asideStyle}>
        <div style={innerStyle}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '16px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <Logo size={26} showText={false} />
            <span style={{ fontSize: '0.95rem', fontWeight: 700, flex: 1 }}>Services</span>
            <button className="btn-ghost" onClick={onToggle} style={{ padding: '4px', borderRadius: '6px' }}>
              <X size={16} />
            </button>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {navItems.map(item => (
              <div key={item.label} style={{ marginBottom: '2px' }}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      style={linkStyle(isActive(item.path))}
                      onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ display: 'flex' }}>{item.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                      <ChevronDown size={12} style={{
                        color: 'var(--text-muted)',
                        transform: expanded.includes(item.label) ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }} />
                    </button>
                    {expanded.includes(item.label) && (
                      <div style={{ marginTop: '2px' }}>
                        {item.children.map(child => (
                          <button
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            style={linkStyle(location.pathname === child.path, true)}
                            onMouseEnter={e => {
                              if (location.pathname !== child.path) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                              }
                            }}
                            onMouseLeave={e => {
                              if (location.pathname !== child.path) {
                                e.currentTarget.style.background = 'transparent';
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
                    style={linkStyle(isActive(item.path))}
                    onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </nav>

          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: 'var(--primary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              }}>
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.display_name}
                </div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)' }}>
                  {user.role}
                </div>
              </div>
            </div>
            <button onClick={onLogout} className="btn-ghost" style={{ justifyContent: 'center', width: '100%', padding: '7px', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <LogOut size={12} /> Abmelden
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) { .sidebar-overlay { display: block !important; } }
      `}</style>
    </>
  );
}

export default Sidebar;
