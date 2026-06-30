import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { PanelLeft } from 'lucide-react';
import type { UserType } from '../App';

type LayoutProps = {
  user: UserType;
  onLogout: () => void;
};

function Layout({ user, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setSidebarOpen(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar
        user={user}
        onLogout={onLogout}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="btn-ghost"
          style={{
            position: 'fixed', top: '12px', left: '12px', zIndex: 50,
            padding: '8px', borderRadius: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <PanelLeft size={18} />
        </button>
      )}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 0,
        transition: 'margin-left 0.2s ease',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <main style={{
          flex: 1,
          padding: '28px 32px',
          maxWidth: '1400px',
          width: '100%',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
