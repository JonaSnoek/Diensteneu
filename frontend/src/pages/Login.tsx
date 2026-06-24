import React, { useState, useEffect } from 'react';
import { api, resolveUrl } from '../utils/api';
import { LogIn, HelpCircle, Shield } from 'lucide-react';
import type { UserType, SystemSettingsType } from '../App';

type LoginProps = {
  onLoginSuccess: (user: UserType, token: string) => void;
  settings: SystemSettingsType | null;
};

function Login({ onLoginSuccess, settings }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/oidc/status').then((data) => {
      if (data && data.enabled) setSsoAvailable(true);
    }).catch(() => {});
  }, []);

  const handleSsoLogin = async () => {
    setSsoLoading(true);
    try {
      const data = await api.get('/auth/oidc/login');
      if (data && data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (err: any) {
      setError(err.message || 'SSO-Login nicht verfügbar.');
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Bitte geben Sie Benutzername und Passwort ein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.post('/auth/login', { username, password });
      
      const userPayload: UserType = {
        authenticated: true,
        username: data.username,
        display_name: data.display_name,
        email: null,
        role: data.role,
        is_ldap: false, // Updated by server fetch
        ldap_dn: null
      };
      
      onLoginSuccess(userPayload, data.access_token);
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen. Überprüfen Sie Ihre Daten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-glow primary"></div>
      <div className="bg-glow accent"></div>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          {settings?.logo_url ? (
            <img 
              src={resolveUrl(settings.logo_url)} 
              alt="Logo" 
              style={{ maxHeight: '60px', marginBottom: '16px' }} 
            />
          ) : (
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: 'var(--shadow-neon)'
            }}>
              <LogIn size={26} color="white" />
            </div>
          )}
          
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {settings?.portal_name || 'Service Portal'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Melden Sie sich an, um fortzufahren.
          </p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', width: '100%', padding: '10px 14px', marginBottom: '20px', textAlign: 'center', borderRadius: '6px', textTransform: 'none' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">BENUTZERNAME</label>
            <input 
              type="text" 
              className="form-input" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username oder LDAP-UID"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">PASSWORT</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Anmeldung...' : 'Einloggen'}
          </button>
        </form>

        {ssoAvailable && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ODER</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>
            <button
              onClick={handleSsoLogin}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={ssoLoading}
            >
              <Shield size={18} />
              {ssoLoading ? 'Weiterleitung...' : 'Mit SSO / Single Sign-On anmelden'}
            </button>
          </>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '25px',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <HelpCircle size={16} color="var(--primary-color)" style={{ flexShrink: 0 }} />
          <span>Unterstützt lokale Konten, LDAP/AD sowie SSO (OpenID Connect).</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
