import { useEffect, useState } from 'react';
import { api, apiEvents } from './utils/api';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/Admin/AdminPanel';

export type UserType = {
  authenticated: boolean;
  id?: number;
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  is_ldap: boolean;
  ldap_dn: string | null;
};

export type SystemSettingsType = {
  portal_name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  allow_guest_access: boolean;
  allow_local_registration: boolean;
  session_timeout_minutes: number;
};

function hexToRgb(hex: string): string {
  if (!hex) return '0, 200, 255';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
}

function App() {
  const [page, setPage] = useState<'loading' | 'setup' | 'login' | 'dashboard' | 'admin'>('loading');
  const [user, setUser] = useState<UserType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettingsType | null>(null);

  const fetchSettingsAndCheckAuth = async () => {
    try {
      // 1. Fetch system details (non-blocking)
      const sysSettings = await api.get('/system/settings') as SystemSettingsType;
      setSettings(sysSettings);
      
      // Inject CSS variables
      document.documentElement.style.setProperty('--primary-color', sysSettings.primary_color);
      document.documentElement.style.setProperty('--accent-color', sysSettings.accent_color);
      document.documentElement.style.setProperty('--primary-rgb', hexToRgb(sysSettings.primary_color));
      document.documentElement.style.setProperty('--accent-rgb', hexToRgb(sysSettings.accent_color));
      document.title = sysSettings.portal_name;

      // 2. Check setup status
      const setupStatus = await api.get('/setup/status') as { setup_completed: boolean };
      if (!setupStatus.setup_completed) {
        setPage('setup');
        return;
      }

      // 3. Check authentication status
      try {
        const me = await api.get('/auth/me') as UserType;
        setUser(me);
        setPage('dashboard');
      } catch (authError) {
        // me failed (401 or guest access blocked)
        if (sysSettings.allow_guest_access) {
          // Setup guest user payload
          setUser({
            authenticated: false,
            username: 'guest',
            display_name: 'Gast',
            email: null,
            role: 'Guest',
            is_ldap: false,
            ldap_dn: null
          });
          setPage('dashboard');
        } else {
          setPage('login');
        }
      }
    } catch (e) {
      console.error("Initialization failed: ", e);
      setErrorMessage(e instanceof Error ? e.message : String(e));
      // Fallback navigation based on setup status
      try {
        const setupStatus = await api.get('/setup/status') as { setup_completed: boolean };
        if (!setupStatus.setup_completed) {
          setPage('setup');
        } else {
          setPage('login');
        }
      } catch (innerError) {
        setPage('setup'); // Safe fallback
      }
    }
  };

  useEffect(() => {
    fetchSettingsAndCheckAuth();

    // Register API interceptor events
    apiEvents.on('SETUP_REQUIRED', () => {
      setPage('setup');
    });

    apiEvents.on('UNAUTHORIZED', () => {
      setUser(null);
      if (settings && settings.allow_guest_access) {
        // Fallback to guest
        setUser({
          authenticated: false,
          username: 'guest',
          display_name: 'Gast',
          email: null,
          role: 'Guest',
          is_ldap: false,
          ldap_dn: null
        });
        setPage('dashboard');
      } else {
        setPage('login');
      }
    });
  }, []);

  const handleLoginSuccess = (userPayload: UserType, token: string) => {
    localStorage.setItem('access_token', token);
    setUser(userPayload);
    setPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('access_token');
    setUser(null);
    fetchSettingsAndCheckAuth();
  };

  if (errorMessage) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'red',
        gap: '20px'
      }}>
        <p>❗️ Fehler bei der Initialisierung:</p>
        <pre>{errorMessage}</pre>
      </div>
    );
  }

  if (page === 'loading') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(0, 200, 255, 0.1)',
          borderTopColor: 'var(--primary-color, #00c8ff)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Portal lädt...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  switch (page) {
    case 'setup':
      return <Setup onSetupCompleted={fetchSettingsAndCheckAuth} />;
    case 'login':
      // Ensure settings are loaded before showing login page
      return settings ? (
        <Login onLoginSuccess={handleLoginSuccess} settings={settings} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p>Loading...</p>
        </div>
      );
    case 'dashboard':
      // Settings required for dashboard
      return (settings && user) ? (
        <Dashboard 
          user={user} 
          onNavigate={(p) => setPage(p)} 
          onLogout={handleLogout}
          settings={settings}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p>Lädt Dashboard...</p>
        </div>
      );
    case 'admin':
      // Settings required for admin panel
      return (settings && user) ? (
        <AdminPanel 
          user={user} 
          onNavigate={(p) => setPage(p)} 
          onLogout={handleLogout}
          settings={settings}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p>Lädt Admin‑Panel...</p>
        </div>
      );
    default:
      return <div>Unbekannte Seite.</div>;
  }
}

export default App;
