import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react';

function OidcSettings() {
  const [enabled, setEnabled] = useState(false);
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [scopes, setScopes] = useState('openid profile email');
  const [usernameClaim, setUsernameClaim] = useState('preferred_username');
  const [displayNameClaim, setDisplayNameClaim] = useState('name');
  const [emailClaim, setEmailClaim] = useState('email');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [testResult, setTestResult] = useState<{status: string; message: string} | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/oidc/config').then((data) => {
      if (data) {
        setEnabled(data.enabled || false);
        setIssuerUrl(data.issuer_url || '');
        setClientId(data.client_id || '');
        setClientSecret(data.client_secret || '');
        setRedirectUri(data.redirect_uri || '');
        setScopes(data.scopes || 'openid profile email');
        setUsernameClaim(data.username_claim || 'preferred_username');
        setDisplayNameClaim(data.display_name_claim || 'name');
        setEmailClaim(data.email_claim || 'email');
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/oidc/config', {
        enabled,
        issuer_url: issuerUrl,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scopes,
        username_claim: usernameClaim,
        display_name_claim: displayNameClaim,
        email_claim: emailClaim,
      });
      setMessageType('success');
      setMessage('OIDC/SSO-Konfiguration gespeichert.');
    } catch (err: any) {
      setMessageType('error');
      setMessage(err.message || 'Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post('/auth/oidc/test', {
        enabled,
        issuer_url: issuerUrl,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scopes,
        username_claim: usernameClaim,
        display_name_claim: displayNameClaim,
        email_claim: emailClaim,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'Test fehlgeschlagen.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Shield size={24} color="var(--primary-color)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>OpenID Connect (SSO)</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Single Sign-On über externen OIDC-Provider (z. B. Keycloak, Authentik, Google).
          </div>
        </div>
      </div>

      {message && (
        <div className={`badge badge-${messageType === 'success' ? 'success' : 'danger'}`} style={{ display: 'block' }}>
          {messageType === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {message}
        </div>
      )}

      <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        <span className="switch-slider"></span>
        <span>{enabled ? 'SSO aktiviert' : 'SSO deaktiviert'}</span>
      </label>

      {enabled && (
        <>
          <div className="form-group">
            <label className="form-label">ISSUER URL</label>
            <input className="form-input" value={issuerUrl} onChange={e => setIssuerUrl(e.target.value)} placeholder="https://auth.example.com/realms/portal" />
          </div>

          <div className="form-group">
            <label className="form-label">CLIENT ID</label>
            <input className="form-input" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="portal-client" />
          </div>

          <div className="form-group">
            <label className="form-label">CLIENT SECRET</label>
            <input className="form-input" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="********" />
          </div>

          <div className="form-group">
            <label className="form-label">REDIRECT URI</label>
            <input className="form-input" value={redirectUri} onChange={e => setRedirectUri(e.target.value)} placeholder="https://portal.example.com/api/auth/oidc/callback" />
          </div>

          <div className="form-group">
            <label className="form-label">SCOPES</label>
            <input className="form-input" value={scopes} onChange={e => setScopes(e.target.value)} placeholder="openid profile email" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">USERNAME CLAIM</label>
              <input className="form-input" value={usernameClaim} onChange={e => setUsernameClaim(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">DISPLAY NAME CLAIM</label>
              <input className="form-input" value={displayNameClaim} onChange={e => setDisplayNameClaim(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">EMAIL CLAIM</label>
              <input className="form-input" value={emailClaim} onChange={e => setEmailClaim(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
              {testing ? <Loader size={14} className="spin" /> : null}
              {testing ? 'Teste...' : 'Verbindung testen'}
            </button>
          </div>

          {testResult && (
            <div className={`badge badge-${testResult.status === 'success' ? 'success' : 'danger'}`} style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
              {testResult.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testResult.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OidcSettings;
