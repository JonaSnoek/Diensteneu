import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from './Logo';
import type { UserType } from '../App';

type LayoutProps = {
  user: UserType;
  onLogout: () => void;
};

function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate();

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
          <Logo size={22} showText={false} />
          Services
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span>{user.display_name}</span>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--primary)' }}>{user.role}</span>
        </div>

        <button onClick={onLogout} className="btn-ghost" style={{ padding: '6px', borderRadius: '6px' }}>
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
