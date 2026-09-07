import React, { useState, useEffect } from 'react';
import { api, resolveUrl } from '../utils/api';
import { HelpCircle, Shield, LogIn } from 'lucide-react';
import type { UserType, SystemSettingsType } from '../App';
import Logo from '../components/Logo';

type LoginProps = {
  onLoginSuccess: (user: UserType, token: string) => void;
  settings: SystemSettingsType | null;
};

type AuthMethods = {
  ldap: { enabled: boolean; disabled_until?: string | null };
  sso: { enabled: boolean; provider_name?: string | null };
};

function Login({ onLoginSuccess, settings }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/methods').then((data) => {
      if (data) setMethods(data as AuthMethods);
    }).catch(() => {
      setMethods({ ldap: { enabled: true }, sso: { enabled: false } });
    });
  }, []);

  const ldapAvailable = methods?.ldap?.enabled ?? true;
  const ssoAvailable = methods?.sso?.enabled ?? false;
  const ssoProviderName = methods?.sso?.provider_name || 'SSO';
  const onlySso = !ldapAvailable && ssoAvailable;

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
        role: data.role, is_ldap: false, is_sso: false, ldap_dn: null
      };
      onLoginSuccess(userPayload, data.access_token);
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen. Überprüfen Sie Ihre Daten.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = async () => {
    setSsoLoading(true);
    setError('');
    try {
      const data = await api.get('/auth/sso/login');
      if (data && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setError('SSO ist derzeit nicht verfügbar.');
        setSsoLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'SSO-Login fehlgeschlagen.');
      setSsoLoading(false);
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

        {onlySso ? (
          <button
            onClick={handleSsoLogin}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem', marginBottom: '16px' }}
            disabled={ssoLoading}
          >
            <Shield size={20} />
            {ssoLoading ? `Weiterleitung zu ${ssoProviderName}...` : `Mit ${ssoProviderName} anmelden`}
          </button>
        ) : (
          (ssoAvailable && (
            <button
              onClick={handleSsoLogin}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}
              disabled={ssoLoading}
            >
              <Shield size={18} />
              {ssoLoading ? `Weiterleitung zu ${ssoProviderName}...` : `Mit ${ssoProviderName} anmelden`}
            </button>
          ))
        )}

        {ssoAvailable && !onlySso && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ODER</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>
              BENUTZERNAME{ldapAvailable && ' ODER LDAP-UID'}
            </label>
            <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder={ldapAvailable ? 'Benutzername oder LDAP-UID' : 'Benutzername'} required disabled={loading || (!ldapAvailable && ssoAvailable && onlySso)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>PASSWORT</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort" required disabled={loading || (!ldapAvailable && ssoAvailable && onlySso)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading || (!ldapAvailable && ssoAvailable && onlySso)}>
            <LogIn size={16} />
            {loading ? 'Anmeldung...' : (ldapAvailable ? 'Einloggen' : 'Lokales Konto anmelden')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <HelpCircle size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
          <span>
            {ldapAvailable && ssoAvailable && 'Unterstützt lokale Konten, LDAP/AD sowie SSO-Anmeldung.'}
            {ldapAvailable && !ssoAvailable && 'Unterstützt lokale Konten sowie LDAP/AD-Anbindung.'}
            {!ldapAvailable && ssoAvailable && 'Unterstützt lokale Konten sowie SSO-Anmeldung.'}
            {!ldapAvailable && !ssoAvailable && 'Nur lokale Konten.'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Login;