import React, { useState } from 'react';
import { api } from '../utils/api';
import { Shield, Database, Cpu, CheckCircle } from 'lucide-react';

type SetupProps = {
  onSetupCompleted: () => void;
};

function Setup({ onSetupCompleted }: SetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // State variables for Setup wizard
  const [dbUrl, setDbUrl] = useState('sqlite:///portal.db');
  const [portalName, setPortalName] = useState('Central Service Portal');
  const [primaryColor, setPrimaryColor] = useState('#00c8ff');
  const [accentColor, setAccentColor] = useState('#9d00ff');
  const [allowGuest, setAllowGuest] = useState(true);

  // LDAP optional state
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [ldapServerUrl, setLdapServerUrl] = useState('ldap://localhost:389');
  const [ldapBaseDn, setLdapBaseDn] = useState('dc=example,dc=org');
  const [ldapBindDn, setLdapBindDn] = useState('');
  const [ldapBindPassword, setLdapBindPassword] = useState('');
  const [ldapUserFilter, setLdapUserFilter] = useState('(uid={username})');
  const [ldapGroupFilter, setLdapGroupFilter] = useState('(memberUid={username})');
  const [groupMappings, setGroupMappings] = useState<{ [key: string]: string }>({
    'admins': 'Admin',
    'creators': 'Creator'
  });
  const [newGroupKey, setNewGroupKey] = useState('');
  const [newGroupVal, setNewGroupVal] = useState('User');

  // Admin user state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('Super Admin');
  const [adminEmail, setAdminEmail] = useState('');

  const handleAddMapping = () => {
    if (newGroupKey.trim()) {
      setGroupMappings({
        ...groupMappings,
        [newGroupKey.trim()]: newGroupVal
      });
      setNewGroupKey('');
    }
  };

  const handleRemoveMapping = (key: string) => {
    const updated = { ...groupMappings };
    delete updated[key];
    setGroupMappings(updated);
  };

  const handleTestLdap = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/ldap/test-connection', {
        name: 'LDAP Test',
        server_url: ldapServerUrl,
        use_ssl: ldapServerUrl.startsWith('ldaps:'),
        base_dn: ldapBaseDn,
        bind_dn: ldapBindDn || null,
        bind_password: ldapBindPassword || null,
        user_search_filter: ldapUserFilter,
        group_search_filter: ldapGroupFilter,
        group_to_role_mapping: groupMappings,
        enabled: true
      });
      alert(`Verbindungstest erfolgreich: ${response.message}`);
    } catch (err: any) {
      setError(err.message || 'Verbindung zum LDAP-Server fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword !== adminPasswordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (adminPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        database_url: dbUrl,
        admin_username: adminUsername,
        admin_password: adminPassword,
        admin_display_name: adminDisplayName,
        admin_email: adminEmail || null,
        portal_name: portalName,
        primary_color: primaryColor,
        accent_color: accentColor,
        allow_guest_access: allowGuest,
        ldap_enabled: ldapEnabled,
        ldap_server_url: ldapEnabled ? ldapServerUrl : null,
        ldap_base_dn: ldapEnabled ? ldapBaseDn : null,
        ldap_bind_dn: (ldapEnabled && ldapBindDn) ? ldapBindDn : null,
        ldap_bind_password: (ldapEnabled && ldapBindPassword) ? ldapBindPassword : null,
        ldap_user_filter: ldapEnabled ? ldapUserFilter : null,
        ldap_group_filter: ldapEnabled ? ldapGroupFilter : null,
        ldap_group_to_role: ldapEnabled ? groupMappings : null
      };

      await api.post('/setup/initialize', payload);
      setStep(4); // Success step
    } catch (err: any) {
      setError(err.message || 'Systeminitialisierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-glow primary"></div>
      <div className="bg-glow accent"></div>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '650px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Portal Setup-Wizard
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Richten Sie Ihr zentrales Service-Portal in wenigen Schritten ein.
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '10%',
            right: '10%',
            height: '2px',
            background: 'rgba(255, 255, 255, 0.08)',
            zIndex: -1,
            transform: 'translateY(-50%)'
          }}>
            <div style={{
              width: `${(step - 1) * 33.3}%`,
              height: '100%',
              background: 'var(--primary-color)',
              transition: 'width 0.3s'
            }} />
          </div>

          {[
            { n: 1, label: 'Datenbank', icon: Database },
            { n: 2, label: 'LDAP (Opt)', icon: Cpu },
            { n: 3, label: 'Superadmin', icon: Shield },
            { n: 4, label: 'Fertig', icon: CheckCircle }
          ].map(s => {
            const Icon = s.icon;
            const active = step >= s.n;
            const current = step === s.n;
            return (
              <div key={s.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: current 
                    ? 'linear-gradient(135deg, var(--primary-color), var(--accent-color))' 
                    : active 
                      ? 'var(--primary-color)' 
                      : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${active ? 'transparent' : 'var(--border-color)'}`,
                  color: active ? 'white' : 'var(--text-muted)',
                  boxShadow: current ? 'var(--shadow-neon)' : 'none',
                  transition: 'all 0.3s'
                }}>
                  <Icon size={18} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '24px', textAlign: 'center', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        {/* STEP 1: DB & Basic customization */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} color="var(--primary-color)" /> 1. Datenbank & Portal-Design
            </h2>

            <div className="form-group">
              <label className="form-label">DATENBANK VERBINDUNGSSTRING</label>
              <input 
                type="text" 
                className="form-input" 
                value={dbUrl} 
                onChange={e => setDbUrl(e.target.value)} 
                placeholder="sqlite:///backend/data/portal.db"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Verwende <strong>sqlite:///portal.db</strong> für ein einfaches lokales Setup oder eine PostgreSQL-URI für produktive Deployments.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">PORTAL NAME</label>
              <input 
                type="text" 
                className="form-input" 
                value={portalName} 
                onChange={e => setPortalName(e.target.value)} 
                placeholder="My Services Portal"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">PRIMÄRFARBE (NEON)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="color" 
                    className="form-input" 
                    value={primaryColor} 
                    onChange={e => setPrimaryColor(e.target.value)} 
                    style={{ width: '50px', height: '45px', padding: '2px', cursor: 'pointer' }}
                  />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={primaryColor} 
                    onChange={e => setPrimaryColor(e.target.value)} 
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">AKZENTFARBE (NEON)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="color" 
                    className="form-input" 
                    value={accentColor} 
                    onChange={e => setAccentColor(e.target.value)} 
                    style={{ width: '50px', height: '45px', padding: '2px', cursor: 'pointer' }}
                  />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={accentColor} 
                    onChange={e => setAccentColor(e.target.value)} 
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className="switch-container" style={{ margin: '15px 0 25px 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Gast-Zugang erlauben</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nicht-eingeloggte User dürfen freigegebene Kacheln sehen.</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={allowGuest} onChange={e => setAllowGuest(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Optional LDAP settings */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Cpu size={20} color="var(--primary-color)" /> 2. LDAP / Active Directory (Optional)
              </h2>
              <label className="switch">
                <input type="checkbox" checked={ldapEnabled} onChange={e => setLdapEnabled(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            {!ldapEnabled ? (
              <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                  LDAP ist aktuell deaktiviert. Sie können ausschließlich lokale Benutzerkonten nutzen.
                </p>
                <button className="btn btn-secondary" onClick={() => setLdapEnabled(true)}>
                  LDAP jetzt konfigurieren
                </button>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="form-group">
                  <label className="form-label">LDAP SERVER URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={ldapServerUrl} 
                    onChange={e => setLdapServerUrl(e.target.value)} 
                    placeholder="ldap://localhost:389 oder ldaps://ldap.example.com:636"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">BASE DN</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={ldapBaseDn} 
                      onChange={e => setLdapBaseDn(e.target.value)} 
                      placeholder="dc=example,dc=org"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BIND DN (ADMIN USER)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={ldapBindDn} 
                      onChange={e => setLdapBindDn(e.target.value)} 
                      placeholder="cn=admin,dc=example,dc=org (Optional)"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">BIND PASSWORT</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={ldapBindPassword} 
                    onChange={e => setLdapBindPassword(e.target.value)} 
                    placeholder="LDAP Admin Passwort (Optional)"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">USER SEARCH FILTER</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={ldapUserFilter} 
                      onChange={e => setLdapUserFilter(e.target.value)} 
                      placeholder="(uid={username}) oder (sAMAccountName={username})"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GROUP SEARCH FILTER</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={ldapGroupFilter} 
                      onChange={e => setLdapGroupFilter(e.target.value)} 
                      placeholder="(memberUid={username}) oder (member={dn})"
                    />
                  </div>
                </div>

                {/* Group Role Mappings */}
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>LDAP GRUPPEN-MAPPING</label>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="LDAP Gruppenname (z.B. support_admins)"
                      value={newGroupKey}
                      onChange={e => setNewGroupKey(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select 
                      className="form-select" 
                      value={newGroupVal}
                      onChange={e => setNewGroupVal(e.target.value)}
                      style={{ width: '150px' }}
                    >
                      <option value="Root">Root</option>
                      <option value="Admin">Admin</option>
                      <option value="Creator">Creator</option>
                      <option value="User">User</option>
                      <option value="Guest">Guest</option>
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={handleAddMapping}>
                      Hinzufügen
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {Object.entries(groupMappings).map(([k, v]) => (
                      <div key={k} className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}>
                        <span>{k} ➔ {v}</span>
                        <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => handleRemoveMapping(k)}>×</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleTestLdap} disabled={loading}>
                    Verbindung testen
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Zurück
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Admin account creation */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} color="var(--primary-color)" /> 3. Root-Administrator erstellen
            </h2>

            <div className="form-group">
              <label className="form-label">BENUTZERNAME</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={adminUsername} 
                onChange={e => setAdminUsername(e.target.value)} 
                placeholder="Super-Admin Username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">ANZEIGENAME</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={adminDisplayName} 
                onChange={e => setAdminDisplayName(e.target.value)} 
                placeholder="z.B. John Doe"
              />
            </div>

            <div className="form-group">
              <label className="form-label">EMAIL ADRESSE</label>
              <input 
                type="email" 
                className="form-input" 
                value={adminEmail} 
                onChange={e => setAdminEmail(e.target.value)} 
                placeholder="admin@example.com (Optional)"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">PASSWORT</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required
                  value={adminPassword} 
                  onChange={e => setAdminPassword(e.target.value)} 
                  placeholder="Passwort"
                />
              </div>

              <div className="form-group">
                <label className="form-label">PASSWORT BESTÄTIGEN</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required
                  value={adminPasswordConfirm} 
                  onChange={e => setAdminPasswordConfirm(e.target.value)} 
                  placeholder="Bestätigung"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                Zurück
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Installiert...' : 'Setup abschließen'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Success Screen */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }} className="animate-fade-in">
            <CheckCircle size={70} color="var(--primary-color)" style={{ marginBottom: '24px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Setup erfolgreich abgeschlossen!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Der Root-Administrator wurde angelegt und die Datenbanktabellen erfolgreich initialisiert.
              Aus Sicherheitsgründen wurde der Setup-Wizard nun dauerhaft deaktiviert und kann nicht erneut aufgerufen werden.
            </p>
            <button className="btn btn-primary" onClick={onSetupCompleted} style={{ padding: '12px 30px' }}>
              Zum Portal anmelden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;
