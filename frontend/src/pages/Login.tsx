import React, { useState } from 'react';
import { api, resolveUrl } from '../utils/api';
import { LogIn, HelpCircle } from 'lucide-react';
import type { UserType, SystemSettingsType } from '../App';
import Logo from '../components/Logo';

type LoginProps = {
  onLoginSuccess: (user: UserType, token: string) => void;
  settings: SystemSettingsType | null;
};

function Login({ onLoginSuccess, settings }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        display_name: data.display_name, email: null,
        role: data.role, is_ldap: false, ldap_dn: null
      };
      onLoginSuccess(userPayload, data.access_token);
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen. Überprüfen Sie Ihre Daten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {settings?.logo_url ? (
            <img src={resolveUrl(settings.logo_url)} alt="Logo" style={{ maxHeight: '48px', marginBottom: '16px' }} />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <Logo size={48} showText={false} />
            </div>
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
            {settings?.portal_name || 'Service Portal'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Melden Sie sich an, um fortzufahren.
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>BENUTZERNAME</label>
            <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Benutzername oder LDAP-UID" required disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>PASSWORT</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort" required disabled={loading} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '6px' }} disabled={loading}>
            {loading ? 'Anmeldung...' : 'Einloggen'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <HelpCircle size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
          <span>Unterstützt lokale Konten sowie LDAP/AD-Anbindung.</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
