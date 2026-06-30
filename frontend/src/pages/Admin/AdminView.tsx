import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Users, Cpu, LayoutGrid, FolderCode, Settings, ShieldAlert, ChevronLeft } from 'lucide-react';
import type { UserType } from '../../App';

type AdminViewProps = {
  user: UserType;
};

const adminTabs = [
  { id: '/admin/users', label: 'Benutzer', icon: Users },
  { id: '/admin/ldap', label: 'LDAP / AD', icon: Cpu },
  { id: '/admin/launchers', label: 'Kacheln (Tiles)', icon: LayoutGrid },
  { id: '/admin/modules', label: 'HTML-Module', icon: FolderCode },
  { id: '/admin/system', label: 'Einstellungen', icon: Settings },
  { id: '/admin/audit', label: 'Audit-Logs', icon: ShieldAlert },
];

function AdminView(_props: AdminViewProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/desktop')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
            fontSize: '0.82rem', cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} /> Zurück
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Administration</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        {adminTabs.map(tab => {
          const TabIcon = tab.icon;
          const active = location.pathname === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: 'none', color: active ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem', fontWeight: active ? 600 : 400, cursor: 'pointer',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}

export default AdminView;
