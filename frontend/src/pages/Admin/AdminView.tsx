import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, LayoutGrid, FolderCode, Users, ShieldCheck, Cpu, Settings, ShieldAlert, ChevronLeft } from 'lucide-react';
import type { UserType } from '../../App';

type AdminViewProps = {
  user: UserType;
};

type NavItem = { id: string; label: string; icon: any; };

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: '', items: [{ id: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Dienste', items: [
    { id: '/admin/launchers', label: 'Kacheln', icon: LayoutGrid },
    { id: '/admin/modules', label: 'HTML-Module', icon: FolderCode },
  ]},
  { label: 'Benutzer & Rechte', items: [{ id: '/admin/users', label: 'Benutzer', icon: Users }] },
  { label: 'Authentifizierung', items: [
    { id: '/admin/auth', label: 'Authentifizierung', icon: ShieldCheck },
    { id: '/admin/ldap', label: 'LDAP / AD', icon: Cpu },
  ]},
  { label: 'System', items: [
    { id: '/admin/system', label: 'Einstellungen', icon: Settings },
    { id: '/admin/audit', label: 'Audit-Logs', icon: ShieldAlert },
  ]},
];

function AdminView(_props: AdminViewProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        <button
          onClick={() => navigate('/desktop')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
            borderRadius: '8px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
            fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}
        >
          <ChevronLeft size={15} /> Zurück
        </button>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Administration</h1>
      </div>

      <nav className="admin-nav">
        {navGroups.map(group => (
          <div key={group.label} className="admin-nav-group">
            {group.label && <div className="admin-nav-group-label">{group.label}</div>}
            <div className="admin-nav-items">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`admin-nav-item${active ? ' admin-nav-item-active' : ''}`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export default AdminView;
