import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import Logo from './Logo';
import { resolveUrl } from '../utils/api';
import type { SystemSettingsType, UserType } from '../App';

type LayoutProps = {
  user: UserType;
  onLogout: () => void;
  settings: SystemSettingsType | null;
};

function Layout({ user, onLogout, settings }: LayoutProps) {
  const navigate = useNavigate();
  const effective = user.effective_role || user.role;
  const isAdmin = effective === 'Root' || effective === 'Admin';

  const brand = settings?.header_logo_url ? (
    <img
      src={resolveUrl(settings.header_logo_url)}
      alt={settings.portal_name}
      style={{ height: '26px', maxWidth: '220px', objectFit: 'contain' }}
    />
  ) : (
    <>
      <Logo size={22} showText={false} />
      <span>{settings?.portal_name || 'Services'}</span>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 28px', height: '52px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => navigate('/desktop')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none', color: 'var(--text)',
            cursor: 'pointer', fontFamily: 'var(--font)',
            fontSize: '0.9rem', fontWeight: 700, padding: '4px 0',
          }}
        >
          {brand}
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span>{user.display_name}</span>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--primary)' }}>{user.role}</span>
        </div>

        {isAdmin && (
          <button onClick={() => navigate('/admin/dashboard')} className="btn-ghost" style={{ padding: '6px', borderRadius: '6px' }} title="Administration">
            <Settings size={15} />
          </button>
        )}

        <button onClick={onLogout} className="btn-ghost" style={{ padding: '6px', borderRadius: '6px' }} title="Abmelden">
          <LogOut size={15} />
        </button>
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
