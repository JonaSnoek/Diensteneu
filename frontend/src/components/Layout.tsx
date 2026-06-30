import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import type { UserType } from '../App';

type LayoutProps = {
  user: UserType;
  onLogout: () => void;
};

function Layout({ user, onLogout }: LayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar user={user} onLogout={onLogout} />
      <main style={{ flex: 1, overflow: 'auto', padding: '32px', maxWidth: '1400px' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
