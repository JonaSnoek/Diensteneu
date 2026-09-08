import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Cpu, ShieldCheck, UserRound, Power, Clock, Check, XCircle, FlaskConical, ExternalLink, Plus, Users, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AuthStatus = {
  ldap: {
    enabled: boolean;
    master_enabled: boolean;
    disabled_until: string | null;
    state: 'active' | 'temp_disabled' | 'permanently_disabled';
  };
  sso: {
    enabled: boolean;
    provider_name: string | null;
  };
  guest: {
    enabled: boolean;
  };
};

type SsoConfig = {
  enabled: boolean;
  provider_name: string;
  issuer_url: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string;
  username_claim: string;
  display_name_claim: string;
  email_claim: string;
  groups_claim: string;
  group_to_role_mapping: { [key: string]: string };
};

function formatLocal(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function authMethodsLabel(status: AuthStatus | null): string {
  if (!status) return 'Loading';
  const ldap = status.ldap.state;
  const sso = status.sso.enabled;
  if (ldap === 'active' && sso) return 'LDAP + SSO';
  if (ldap !== 'active' && sso) return 'Nur SSO';
  if (ldap === 'active' && !sso) return 'Nur LDAP';
  return 'Keine';
}

function AuthSettings() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // LDAP temp disable inputs
  const [tempDuration, setTempDuration] = useState<number>(120); // minutes
  const [tempUntil, setTempUntil] = useState<string>('');

  // SSO form
  const [sso, setSso] = useState<SsoConfig | null>(null);
  const [savingSso, setSavingSso] = useState(false);
  const [testingSso, setTestingSso] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [newGroupKey, setNewGroupKey] = useState('');
  const [newGroupRole, setNewGroupRole] = useState('User');
  const [knownGroups, setKnownGroups] = useState<string[]>([]);
  const [newGroupCustom, setNewGroupCustom] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const timerRef = useRef<number | null>(null);

  const fetchAll = async () => {
    try {
      const data = await api.get('/auth/admin/status') as AuthStatus;
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Status konnte nicht geladen werden.');
    }
    try {
      const cfg = await api.get('/auth/sso/config') as SsoConfig;
      setSso(cfg);
    } catch (err: any) {
      setError(err.message || 'SSO-Konfiguration konnte nicht geladen werden.');
    }
  };

  useEffect(() => {
    fetchAll();
    loadSsoGroups();
    timerRef.current = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  const remainingLabel = () => {
    if (!status?.ldap.disabled_until || status.ldap.state !== 'temp_disabled') return null;
    const untilMs = new Date(status.ldap.disabled_until).getTime();
    const diffMs = untilMs - now;
    if (diffMs <= 0) return 'läuft gleich ab';
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs} Std ${rem} Min` : `${mins} Min`;
  };

  const runLdapAction = async (url: string, body: any = null, successMsg: string) => {
    setError('');
    setSuccess('');
    try {
      await api.post(url, body);
      setSuccess(successMsg);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Aktion fehlgeschlagen.');
    }
  };

  const handleTempDisable = async () => {
    setError('');
    setSuccess('');
    let body: any = {};
    if (tempUntil) {
      const local = new Date(tempUntil);
      if (isNaN(local.getTime())) { setError('Ungültiger Zeitpunkt.'); return; }
      body = { disable_until: new Date(local).toISOString() };
    } else {
      body = { duration_minutes: tempDuration };
    }
    try {
      const res = await api.post('/auth/admin/ldap/deactivate-temporarily', body);
      setSuccess(`LDAP temporär deaktiviert (${res.message || 'erfolgreich'}).`);
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Deaktivierung fehlgeschlagen.');
    }
  };

  const handleSaveSso = async () => {
    if (!sso) return;
    setError('');
    setSuccess('');
    setSavingSso(true);
    try {
      await api.post('/auth/sso/config', sso);
      setSuccess('SSO-Konfiguration gespeichert.');
      await fetchAll();
    } catch (err: any) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setSavingSso(false);
    }
  };

  const handleTestSso = async () => {
    if (!sso) return;
    setError('');
    setTestResult(null);
    setTestingSso(true);
    try {
      const res = await api.post('/auth/sso/test', sso);
      setTestResult({ ok: true, message: res.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Verbindungstest fehlgeschlagen.' });
    } finally {
      setTestingSso(false);
    }
  };

  const loadSsoGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await api.get('/auth/sso/groups') as { groups: string[] };
      setKnownGroups(res?.groups || []);
    } catch (err: any) {
      setError(err.message || 'Gruppen konnten nicht geladen werden.');
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleAddGroupMapping = () => {
    if (!sso || !newGroupKey.trim()) return;
    setSso({
      ...sso,
      group_to_role_mapping: {
        ...(sso.group_to_role_mapping || {}),
        [newGroupKey.trim()]: newGroupRole,
      },
    });
    setNewGroupKey('');
    setNewGroupRole('User');
  };

  const handleRemoveGroupMapping = (groupKey: string) => {
    if (!sso) return;
    const updated = { ...(sso.group_to_role_mapping || {}) };
    delete updated[groupKey];
    setSso({ ...sso, group_to_role_mapping: updated });
  };

  if (!status || !sso) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Authentifizierungseinstellungen laden...</div>;
  }

  const ls = status.ldap;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {error && <div className="badge badge-danger" style={{ display: 'block', padding: '12px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
      {success && <div className="badge badge-success" style={{ display: 'block', padding: '12px', textAlign: 'center', textTransform: 'none' }}>{success}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          LDAP und SSO werden unabhängig voneinander verwaltet und können sich nicht gegenseitig blockieren.
          Aktuell aktive Verfahren: <strong>{authMethodsLabel(status)}</strong>
        </p>
      </div>

      {/* ------------------------------ LDAP ------------------------------ */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="var(--primary-color)" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>LDAP / AD</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '10px' }}>LDAP-Anmeldung</span>
            </div>
          </div>

          <span className={`badge ${ls.state === 'active' ? 'badge-success' : ls.state === 'temp_disabled' ? 'badge-warning' : 'badge-danger'}`}>
            {ls.state === 'active' ? 'Aktiv' : ls.state === 'temp_disabled' ? 'Temporär deaktiviert' : 'Dauerhaft deaktiviert'}
          </span>
        </div>

        {/* Status details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</div>
            <div style={{ fontSize: '0.95rem' }}>
              {ls.state === 'active' && 'LDAP aktiv'}
              {ls.state === 'temp_disabled' && `Deaktiviert bis ${formatLocal(ls.disabled_until)} Uhr`}
              {ls.state === 'permanently_disabled' && 'Permanent deaktiviert'}
            </div>
          </div>
          {ls.state === 'temp_disabled' && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>VERBLEIBENDE ZEIT</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--warning)' }}>
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {remainingLabel()}
              </div>
            </div>
          )}
          {ls.state === 'active' && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>AUTO-AKTIVIERUNG</div>
              <div style={{ fontSize: '0.95rem' }}>sofort verfügbar</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          {ls.state !== 'active' && (
            <button className="btn btn-primary" onClick={() => runLdapAction('/auth/admin/ldap/activate', null, 'LDAP wurde aktiviert.')}>
              <Power size={14} /> Aktivieren
            </button>
          )}
          {ls.state === 'temp_disabled' && (
            <button className="btn btn-secondary" onClick={() => runLdapAction('/auth/admin/ldap/reactivate', null, 'LDAP wurde vorzeitig wieder aktiviert.')}>
              <Check size={14} /> Vorzeitig aktivieren
            </button>
          )}
          {ls.state === 'active' && (
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('LDAP dauerhaft deaktivieren? Die Konfiguration bleibt erhalten.')) {
                runLdapAction('/auth/admin/ldap/deactivate', null, 'LDAP wurde dauerhaft deaktiviert.');
              }
            }}>
              <XCircle size={14} /> Dauerhaft deaktivieren
            </button>
          )}

          {ls.state === 'active' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  className="form-select"
                  value={tempDuration}
                  onChange={e => setTempDuration(Number(e.target.value))}
                  style={{ width: '140px' }}
                >
                  <option value={15}>15 Minuten</option>
                  <option value={30}>30 Minuten</option>
                  <option value={60}>1 Stunde</option>
                  <option value={120}>2 Stunden</option>
                  <option value={240}>4 Stunden</option>
                  <option value={480}>8 Stunden</option>
                  <option value={720}>12 Stunden</option>
                  <option value={1440}>24 Stunden</option>
                </select>
                <button className="btn btn-secondary" onClick={handleTempDisable}>
                  <Clock size={14} /> Temporär deaktivieren
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={tempUntil}
                  onChange={e => setTempUntil(e.target.value)}
                  style={{ width: '220px' }}
                />
                <button className="btn btn-secondary" onClick={handleTempDisable} disabled={!tempUntil}>
                  Bis zu diesem Zeitpunkt
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Die LDAP-Konfiguration (Server, Filter, Rollen-Mapping) wird beim Deaktivieren nicht gelöscht.
          </span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => navigate('/admin/ldap')}>
            <ExternalLink size={14} /> LDAP-Konfiguration verwalten
          </button>
        </div>
      </div>

      {/* ------------------------------ SSO ------------------------------ */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--primary-color)" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>SSO (OpenID Connect)</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '10px' }}>{sso.provider_name || 'SSO'}</span>
            </div>
          </div>

          <div className="switch-container" style={{ padding: 0 }}>
            <span className="form-label" style={{ marginRight: '10px' }}>SSO AKTIVIEREN</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={sso.enabled}
                onChange={e => { setSso({ ...sso, enabled: e.target.checked }); }}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {sso.enabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">PROVIDER NAME</label>
                <input className="form-input" value={sso.provider_name} onChange={e => setSso({ ...sso, provider_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">ISSUER URL</label>
                <input className="form-input" placeholder="https://auth.example.com/realms/portal" value={sso.issuer_url} onChange={e => setSso({ ...sso, issuer_url: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">CLIENT ID</label>
                <input className="form-input" placeholder="portal-client" value={sso.client_id} onChange={e => setSso({ ...sso, client_id: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">CLIENT SECRET</label>
                <input className="form-input" type="password" placeholder="********" value={sso.client_secret} onChange={e => setSso({ ...sso, client_secret: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">REDIRECT URI</label>
                <input className="form-input" placeholder="http://localhost:8000/api/auth/sso/callback" value={sso.redirect_uri} onChange={e => setSso({ ...sso, redirect_uri: e.target.value })} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Muss exakt der im Identity-Provider registrierten Callback-URL entsprechen.
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">SCOPES</label>
                <input className="form-input" value={sso.scopes} onChange={e => setSso({ ...sso, scopes: e.target.value })} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <code>groups</code> wird automatisch angefordert, sobald ein Gruppen-Rollenmapping konfiguriert ist.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">USERNAME CLAIM</label>
                  <input className="form-input" value={sso.username_claim} onChange={e => setSso({ ...sso, username_claim: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">DISPLAY NAME CLAIM</label>
                  <input className="form-input" value={sso.display_name_claim} onChange={e => setSso({ ...sso, display_name_claim: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">EMAIL CLAIM</label>
                  <input className="form-input" value={sso.email_claim} onChange={e => setSso({ ...sso, email_claim: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Group claiming (per scope groups) */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Users size={18} color="var(--primary-color)" />
                <span className="form-label" style={{ margin: 0 }}>GRUPPEN-CLAIMING (GROUPS-SCOPE)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label className="form-label">GROUPS CLAIM</label>
                  <input className="form-input" placeholder="groups" value={sso.groups_claim} onChange={e => setSso({ ...sso, groups_claim: e.target.value })} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Claim-Name im ID-Token, der die Gruppen enthält (z.&nbsp;B. <code>groups</code> im Keycloak).
                  </span>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">GRUPPE (AUS TOKEN)</label>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={loadSsoGroups}
                      disabled={groupsLoading}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      <RefreshCw size={12} /> {groupsLoading ? 'Lädt...' : 'Gruppen neu laden'}
                    </button>
                  </div>
                  {newGroupCustom ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="z.B. it-admins"
                        value={newGroupKey}
                        onChange={e => setNewGroupKey(e.target.value)}
                      />
                      <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => setNewGroupCustom(false)}>
                        Aus Liste wählen
                      </button>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={newGroupKey}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '__custom__') {
                          setNewGroupCustom(true);
                          setNewGroupKey('');
                        } else {
                          setNewGroupCustom(false);
                          setNewGroupKey(v);
                        }
                      }}
                    >
                      <option value="">— Gruppe auswählen —</option>
                      {knownGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      <option value="__custom__">✎ Andere Gruppe eingeben…</option>
                    </select>
                  )}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Gruppen werden aus den SSO-Anmeldungen der Benutzer geladen ({knownGroups.length} bekannt).
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">ROLLE</label>
                  <select className="form-select" value={newGroupRole} onChange={e => setNewGroupRole(e.target.value)} style={{ width: '130px' }}>
                    <option value="Root">Root</option>
                    <option value="Admin">Admin</option>
                    <option value="Moderator">Moderator</option>
                    <option value="Creator">Creator</option>
                    <option value="Editor">Editor</option>
                    <option value="User">User</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>
                <button className="btn btn-secondary" onClick={handleAddGroupMapping}>
                  <Plus size={14} /> Hinzufügen
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(sso.group_to_role_mapping || {}).map(([g, r]) => (
                  <div key={g} className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.8rem' }}>
                    <span>{g} ➔ {r}</span>
                    <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => handleRemoveGroupMapping(g)}>×</span>
                  </div>
                ))}
                {Object.keys(sso.group_to_role_mapping || {}).length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Keine Gruppen-Zuordnungen definiert. SSO-Benutzer erhalten standardmäßig die Rolle "User".
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleSaveSso} disabled={savingSso}>
                <Check size={14} /> {savingSso ? 'Speichern...' : 'Speichern'}
              </button>
              <button className="btn btn-secondary" onClick={handleTestSso} disabled={testingSso}>
                <FlaskConical size={14} /> {testingSso ? 'Teste...' : 'Verbindung testen'}
              </button>
            </div>

            {testResult && (
              <div className={`badge ${testResult.ok ? 'badge-success' : 'badge-danger'}`} style={{ display: 'block', marginTop: '12px', textAlign: 'center', textTransform: 'none' }}>
                {testResult.message}
              </div>
            )}
          </>
        )}
      </div>

      {/* ------------------------------ GAST ------------------------------ */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserRound size={20} color="var(--primary-color)" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Gastzugang</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '10px' }}>Ohne Benutzerkonto</span>
            </div>
          </div>

          <div className="switch-container" style={{ padding: 0 }}>
            <span className="form-label" style={{ marginRight: '10px' }}>GASTZUGANG</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={status.guest.enabled}
                onChange={async (e) => {
                  setError(''); setSuccess('');
                  try {
                    const next = e.target.checked;
                    await api.put('/system/settings', { allow_guest_access: next });
                    setSuccess(next ? 'Gastzugang aktiviert.' : 'Gastzugang deaktiviert.');
                    await fetchAll();
                  } catch (err: any) {
                    setError(err.message || 'Änderung fehlgeschlagen.');
                  }
                }}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '12px' }}>
          <div>
            <div className="panel-label">STATUS</div>
            <div style={{ fontSize: '0.95rem' }}>
              {status.guest.enabled ? 'Gäste können sich ohne Anmeldung fortbewegen.' : 'Der Gastzugang ist deaktiviert.'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Gäste erhalten automatisch die Rolle <strong>Guest</strong> und sehen nur die dafür freigegebenen Inhalte. Sie erhalten keine Admin- oder erweiterten Rechte.
        </div>
      </div>
    </div>
  );
}

export default AuthSettings;