import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api, apiEvents, resolveUrl } from './utils/api';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminView from './pages/Admin/AdminView';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import AuthSettings from './pages/Admin/AuthSettings';
import LdapSettings from './pages/Admin/LdapSettings';
import LauncherManagement from './pages/Admin/LauncherManagement';
import ModuleManagement from './pages/Admin/ModuleManagement';
import SystemSettings from './pages/Admin/SystemSettings';
import AuditLogs from './pages/Admin/AuditLogs';

export type UserType = {
  authenticated: boolean;
  id?: number;
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  effective_role?: string;
  is_ldap: boolean;
  is_sso: boolean;
  ldap_dn: string | null;
  sso_issuer?: string | null;
};

export type SystemSettingsType = {
  portal_name: string;
  logo_url: string | null;
  header_logo_url: string | null;
  login_logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  allow_guest_access: boolean;
  allow_local_registration: boolean;
  session_timeout_minutes: number;
};

function applyFavicon(settings: SystemSettingsType) {
  if (!settings.favicon_url) return;
  const src = resolveUrl(settings.favicon_url);
  const existing = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
  if (existing) {
    existing.href = src;
  } else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = src;
    document.head.appendChild(link);
  }
}

function hexToRgb(hex: string): string {
  if (!hex) return '59, 130, 246';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '59, 130, 246';
}

function App() {
  const [page, setPage] = useState<'loading' | 'setup' | 'login' | 'app'>('loading');
  const [user, setUser] = useState<UserType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettingsType | null>(null);

  const fetchSettingsAndCheckAuth = async () => {
    try {
      const sysSettings = await api.get('/system/settings') as SystemSettingsType;
      setSettings(sysSettings);

      document.documentElement.style.setProperty('--primary-color', sysSettings.primary_color);
      document.documentElement.style.setProperty('--primary-rgb', hexToRgb(sysSettings.primary_color));
      document.title = sysSettings.portal_name;
      applyFavicon(sysSettings);

      const setupStatus = await api.get('/setup/status') as { setup_completed: boolean };
      if (!setupStatus.setup_completed) {
        setPage('setup');
        return;
      }

      try {
        const me = await api.get('/auth/me') as UserType;
        if (me.authenticated) {
          setUser(me);
          setPage('app');
        } else {
          // Guest session or unknown caller: always show the login first so the
          // user can choose how to sign in (or continue as guest).
          setUser(null);
          setPage('login');
        }
      } catch {
        setPage('login');
      }
    } catch (e) {
      console.error("Initialization failed: ", e);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      try {
        const setupStatus = await api.get('/setup/status') as { setup_completed: boolean };
        if (!setupStatus.setup_completed) setPage('setup');
        else setPage('login');
      } catch {
        setPage('setup');
      }
    }
  };

  useEffect(() => {
    fetchSettingsAndCheckAuth();
    apiEvents.on('SETUP_REQUIRED', () => setPage('setup'));
    apiEvents.on('UNAUTHORIZED', () => {
      setUser(null);
      fetchSettingsAndCheckAuth();
    });
  }, []);

  if (errorMessage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--danger)', gap: '16px', background: 'var(--bg)' }}>
        <p style={{ fontWeight: 600 }}>Fehler bei der Initialisierung</p>
        <pre style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{errorMessage}</pre>
        <button className="btn btn-primary" onClick={fetchSettingsAndCheckAuth}>Erneut versuchen</button>
      </div>
    );
  }

  if (page === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', background: 'var(--bg)' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Portal lädt...</p>
      </div>
    );
  }

  if (page === 'setup') {
    return <Setup onSetupCompleted={fetchSettingsAndCheckAuth} />;
  }

  if (page === 'login' || !user) {
    return <Login onLoginSuccess={(userPayload, token) => {
      localStorage.setItem('access_token', token);
      setUser(userPayload);
      setPage('app');
    }} onGuestContinue={() => {
      setUser({ authenticated: false, username: 'guest', display_name: 'Gast', email: null, role: 'Guest', is_ldap: false, is_sso: false, ldap_dn: null, sso_issuer: null });
      setPage('app');
    }} settings={settings} />;
  }

  const handleLogout = async () => {
    let endSessionUrl = '';
    try {
      const res = await api.post('/auth/logout');
      endSessionUrl = res?.end_session_url || '';
    } catch {}
    localStorage.removeItem('access_token');
    setUser(null);
    setPage('login');
    if (endSessionUrl) {
      window.location.href = endSessionUrl;
    }
  };

  return (
    <BrowserRouter>
      <Routes>
          <Route element={<Layout user={user} onLogout={handleLogout} settings={settings} />}>
            <Route path="/desktop" element={<Dashboard user={user} />} />
            <Route path="/desktop/:category" element={<Dashboard user={user} />} />
          <Route path="/admin" element={<AdminView user={user} />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement currentUser={user} />} />
            <Route path="auth" element={<AuthSettings />} />
            <Route path="ldap" element={<LdapSettings />} />
            <Route path="launchers" element={<LauncherManagement />} />
            <Route path="modules" element={<ModuleManagement currentUser={user} />} />
            <Route path="system" element={<SystemSettings settings={settings!} />} />
            <Route path="audit" element={<AuditLogs />} />
          </Route>
          <Route path="/" element={<Navigate to="/desktop" replace />} />
          <Route path="*" element={<Navigate to="/desktop" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
