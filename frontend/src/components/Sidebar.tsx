import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Shield,
  ChevronDown, LogOut, Menu, X,
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
    icon: <LayoutDashboard size={18} />,
    path: '/desktop',
    children: [
      { label: 'Alle Kacheln', path: '/desktop' },
      { label: 'Software', path: '/desktop/software' },
      { label: 'Hardware', path: '/desktop/hardware' },
    ],
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

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: collapsed ? 0 : 'var(--sidebar-width)',
    height: '100vh',
    background: 'var(--bg-surface)',
    borderRight: collapsed ? 'none' : '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflow: 'hidden',
    transition: 'width 0.25s ease, border 0.25s ease',
  };

  const innerStyle: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.15s ease',
    transitionDelay: collapsed ? '0s' : '0.1s',
  };

  return (
    <>
      {!collapsed && (
        <div
          onClick={onToggle}
          style={{
            position: 'fixed', inset: 0, zIndex: 99,
            background: 'rgba(0,0,0,0.4)',
            display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}
      <aside style={navStyle}>
        <div style={innerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
            <Logo size={28} showText={false} />
            <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1 }}>Services</span>
            <button className="btn-ghost" onClick={onToggle} style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
            {navItems.map(item => (
              <div key={item.label} style={{ marginBottom: '2px' }}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'transparent', border: 'none', color: 'var(--text)',
                        fontSize: '0.85rem', cursor: 'pointer',
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
                        size={13}
                        style={{
                          color: 'var(--text-muted)',
                          transform: expanded.includes(item.label) ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                    {expanded.includes(item.label) && (
                      <div style={{ marginLeft: '6px' }}>
                        {item.children.map(child => (
                          <button
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              width: '100%', padding: '7px 12px 7px 38px', borderRadius: 'var(--radius-sm)',
                              background: location.pathname === child.path ? 'var(--primary)' : 'transparent',
                              border: 'none', color: location.pathname === child.path ? '#fff' : 'var(--text-secondary)',
                              fontSize: '0.82rem', cursor: 'pointer',
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
                      width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                      background: isActive(item.path) ? 'var(--primary)' : 'transparent',
                      border: 'none', color: isActive(item.path) ? '#fff' : 'var(--text)',
                      fontSize: '0.85rem', cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (!isActive(item.path)) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive(item.path)) e.currentTarget.style.background = 'transparent';
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
            padding: '14px', borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'var(--primary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
              }}>
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.display_name}
                </div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>
                  {user.role}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="btn-ghost"
              style={{ justifyContent: 'center', padding: '7px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
            >
              <LogOut size={13} /> Abmelden
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}

export default Sidebar;
