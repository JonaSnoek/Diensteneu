import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
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
      <Sidebar user={user} onLogout={onLogout} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 0,
        transition: 'margin-left 0.25s ease',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button className="btn-ghost" onClick={() => setSidebarOpen(o => !o)} style={{ padding: '6px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </header>
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1400px', width: '100%' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
