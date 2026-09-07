import React, { useState, useEffect } from 'react';
import { api, resolveUrl } from '../utils/api';
import { Shield, KeyRound, User, LogIn, AlertCircle } from 'lucide-react';
import type { UserType, SystemSettingsType } from '../App';
import Logo from '../components/Logo';

type LoginProps = {
  onLoginSuccess: (user: UserType, token: string) => void;
  onGuestContinue?: () => void;
  settings: SystemSettingsType | null;
};

type AuthMethods = {
  ldap: { enabled: boolean; disabled_until?: string | null };
  sso: { enabled: boolean; provider_name?: string | null };
  guest: { enabled: boolean };
};

function Login({ onLoginSuccess, onGuestContinue, settings }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ldapExpanded, setLdapExpanded] = useState(false);

  useEffect(() => {
    api.get('/auth/methods').then((data) => {
      if (data) setMethods(data as AuthMethods);
    }).catch(() => {
      setMethods({ ldap: { enabled: true }, sso: { enabled: false }, guest: { enabled: false } });
    });
  }, []);

  const ldapAvailable = methods?.ldap?.enabled ?? false;
  const ssoAvailable = methods?.sso?.enabled ?? false;
  const guestAvailable = (methods?.guest?.enabled ?? false) || Boolean(settings?.allow_guest_access);
  const ssoProviderName = methods?.sso?.provider_name || 'SSO';
  const methodsLoaded = Boolean(methods);
  // When SSO is the only other option, LDAP is shown directly (primary fallback).
  const ldapPrimary = ldapAvailable && !ssoAvailable;
  const showLdapForm = ldapAvailable && (ldapPrimary || ldapExpanded);

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
        authenticated: true, username: data.username, display_name: data.display_name,
        email: null, role: data.role, is_ldap: false, is_sso: false, ldap_dn: null, sso_issuer: null,
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

  if (!methodsLoaded) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {settings?.logo_url ? (
            <img
              src={resolveUrl(settings.logo_url)} alt="Logo"
              style={{ maxHeight: '44px', marginBottom: '14px', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              <Logo size={44} showText={false} />
            </div>
          )}
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '4px' }}>
            {settings?.portal_name || 'Service Portal'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            Melden Sie sich an, um fortzufahren.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)',
            fontSize: '0.82rem', marginBottom: '16px',
          }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* SSO */}
        {ssoAvailable && (
          <button
            onClick={handleSsoLogin}
            className="btn btn-sso btn-lg"
            style={{ width: '100%', marginBottom: '18px', justifyContent: 'center' }}
            disabled={ssoLoading}
          >
            <Shield size={20} />
            {ssoLoading ? `Weiterleitung zu ${ssoProviderName}...` : `Mit ${ssoProviderName} anmelden`}
          </button>
        )}

        {/* Divider */}
        {ssoAvailable && (ldapAvailable || guestAvailable) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '-4px 0 18px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.4px' }}>ODER</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        )}

        {/* LDAP */}
        {ldapAvailable ? (
          <>
            {!showLdapForm && (
              <button
                className="btn btn-secondary btn-lg"
                style={{ width: '100%', justifyContent: 'center', marginBottom: '14px' }}
                onClick={() => setLdapExpanded(true)}
              >
                <KeyRound size={18} />
                {ssoAvailable ? 'Mit LDAP anmelden' : 'Einloggen'}
              </button>
            )}

            {showLdapForm && (
              <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
              >
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>BENUTZERNAME</label>
                  <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Benutzername" required disabled={loading} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>PASSWORT</label>
                  <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort" required disabled={loading} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading}>
                    <LogIn size={16} />
                    {loading ? 'Anmeldung...' : 'Einloggen'}
                  </button>
                  {ssoAvailable && (
                    <button type="button" className="btn btn-ghost" onClick={() => { setLdapExpanded(false); setUsername(''); setPassword(''); setError(''); }}>
                      Abbrechen
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        ) : (
          ssoAvailable && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px', textAlign: 'center' }}>
              Derzeit nicht verfügbar.
            </div>
          )
        )}

        {/* Guest */}
        {guestAvailable && onGuestContinue && (
          <>
            {(ssoAvailable || ldapAvailable) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '6px 0 14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.4px' }}>ODER</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
            )}
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)', padding: '10px' }}
              onClick={onGuestContinue}
            >
              <User size={16} />
              Als Gast fortfahren
            </button>
          </>
        )}

        {!ssoAvailable && !ldapAvailable && !guestAvailable && (
          <div style={{ padding: '18px', textAlign: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Derzeit ist keine Anmeldung möglich.
          </div>
        )}
      </div>
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Erstellt von <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Jona Snoek</span>
      </div>
    </div>
  );
}

export default Login;