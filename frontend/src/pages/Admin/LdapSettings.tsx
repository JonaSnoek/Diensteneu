import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Plus, Trash2, Cpu, RefreshCw, Check } from 'lucide-react';

type LdapConfigSchema = {
  name: string;
  server_url: string;
  use_ssl: boolean;
  base_dn: string;
  bind_dn: string | null;
  bind_password: string | null;
  user_search_filter: string;
  group_search_filter: string;
  group_to_role_mapping: { [key: string]: string };
  sync_interval_minutes: number;
  enabled: boolean;
};

function LdapSettings() {
  const [configs, setConfigs] = useState<LdapConfigSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active server config index for details view
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Group role mapping input state
  const [newGroupKey, setNewGroupKey] = useState('');
  const [newGroupVal, setNewGroupVal] = useState('User');

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await api.get('/ldap/configs') as LdapConfigSchema[];
      setConfigs(data);
      if (data.length > 0) {
        setActiveIndex(0);
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der LDAP-Einstellungen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleAddConfig = () => {
    const newCfg: LdapConfigSchema = {
      name: `LDAP Server ${configs.length + 1}`,
      server_url: 'ldap://localhost:389',
      use_ssl: false,
      base_dn: 'dc=example,dc=org',
      bind_dn: '',
      bind_password: '',
      user_search_filter: '(uid={username})',
      group_search_filter: '(memberUid={username})',
      group_to_role_mapping: {},
      sync_interval_minutes: 60,
      enabled: false
    };
    setConfigs([...configs, newCfg]);
    setActiveIndex(configs.length);
  };

  const handleRemoveConfig = (idx: number) => {
    if (window.confirm('Möchten Sie diese LDAP-Konfiguration wirklich löschen?')) {
      const updated = configs.filter((_, i) => i !== idx);
      setConfigs(updated);
      setActiveIndex(Math.max(0, idx - 1));
    }
  };

  const handleChangeConfigField = (field: keyof LdapConfigSchema, value: any) => {
    setConfigs(configs.map((c, i) => {
      if (i === activeIndex) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  // Group Mapping CRUD
  const handleAddMapping = () => {
    if (!newGroupKey.trim()) return;
    const currentMappings = configs[activeIndex].group_to_role_mapping || {};
    const updatedMappings = {
      ...currentMappings,
      [newGroupKey.trim()]: newGroupVal
    };
    handleChangeConfigField('group_to_role_mapping', updatedMappings);
    setNewGroupKey('');
  };

  const handleRemoveMapping = (groupKey: string) => {
    const currentMappings = { ...configs[activeIndex].group_to_role_mapping };
    delete currentMappings[groupKey];
    handleChangeConfigField('group_to_role_mapping', currentMappings);
  };

  // Test LDAP Connection
  const handleTestConnection = async (cfg: LdapConfigSchema) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.post('/ldap/test-connection', cfg);
      setSuccess(`Verbindungstest erfolgreich: ${response.message}`);
    } catch (err: any) {
      setError(err.message || 'Verbindung fehlgeschlagen.');
    }
  };

  // Save Settings
  const handleSaveConfigs = async () => {
    setError('');
    setSuccess('');
    try {
      await api.post('/ldap/configs', configs);
      setSuccess('LDAP-Konfigurationen erfolgreich gespeichert.');
      fetchConfigs();
    } catch (err: any) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    }
  };

  // Trigger LDAP Synchronisation
  const handleSyncNow = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.post('/ldap/sync') as any;
      setSuccess(`Synchronisation abgeschlossen. Erstellt: ${result.created}, Aktualisiert: ${result.updated}, Deaktiviert: ${result.deactivated}`);
    } catch (err: any) {
      setError(err.message || 'LDAP-Synchronisation fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>LDAP-Einstellungen laden...</div>;
  }

  const activeConfig = configs[activeIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Alert panels */}
      {error && <div className="badge badge-danger" style={{ display: 'block', padding: '12px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
      {success && <div className="badge badge-success" style={{ display: 'block', padding: '12px', textAlign: 'center', textTransform: 'none' }}>{success}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Konfigurieren Sie Active Directory- oder OpenLDAP-Server, um Benutzer-Authentifizierungen und Berechtigungen automatisch abzugleichen.
        </p>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleSyncNow} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Abgleich läuft...' : 'Jetzt synchronisieren'}
          </button>
          
          <button className="btn btn-primary" onClick={handleSaveConfigs}>
            <Check size={14} /> Einstellungen speichern
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', minHeight: '400px' }}>
        {/* Left Side: Connection Profiles list */}
        <div className="glass-panel" style={{ width: '220px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PROFILE</span>
            <button className="btn btn-secondary" onClick={handleAddConfig} style={{ padding: '4px 8px', borderRadius: '4px' }}>
              <Plus size={12} /> Hinzufügen
            </button>
          </div>
          
          {configs.map((c, idx) => (
            <div 
              key={idx}
              onClick={() => setActiveIndex(idx)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: '8px',
                background: activeIndex === idx ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeIndex === idx ? 'var(--primary-color)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span style={{
                fontSize: '0.88rem',
                fontWeight: activeIndex === idx ? 600 : 500,
                color: c.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '130px'
              }}>
                {c.name}
              </span>
              
              <button 
                onClick={(e) => { e.stopPropagation(); handleRemoveConfig(idx); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          
          {configs.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '15px' }}>
              Keine Server eingerichtet.
            </div>
          )}
        </div>

        {/* Right Side: Active profile editing inputs */}
        {activeConfig ? (
          <div className="glass-panel" style={{ flex: 1, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={20} color="var(--primary-color)" />
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{activeConfig.name} konfigurieren</span>
              </div>
              
              <div className="switch-container" style={{ padding: 0 }}>
                <span className="form-label" style={{ marginRight: '10px' }}>AKTIVIEREN</span>
                <label className="switch">
                  <input type="checkbox" checked={activeConfig.enabled} onChange={e => handleChangeConfigField('enabled', e.target.checked)} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">PROFILNAME</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={activeConfig.name} 
                    onChange={e => handleChangeConfigField('name', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SERVER URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="ldap://localhost:389" 
                    value={activeConfig.server_url} 
                    onChange={e => handleChangeConfigField('server_url', e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">BASE DN</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="dc=example,dc=org" 
                    value={activeConfig.base_dn} 
                    onChange={e => handleChangeConfigField('base_dn', e.target.value)} 
                  />
                </div>
                
                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <div className="switch-container" style={{ marginTop: '20px' }}>
                    <span className="form-label">SSL (ENCRYPTED) VERWENDEN</span>
                    <label className="switch">
                      <input type="checkbox" checked={activeConfig.use_ssl} onChange={e => handleChangeConfigField('use_ssl', e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">BIND DN (VERBINDUNGSBENUTZER)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="cn=admin,dc=example,dc=org (Leer lassen für anonymous)" 
                    value={activeConfig.bind_dn || ''} 
                    onChange={e => handleChangeConfigField('bind_dn', e.target.value || null)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">BIND PASSWORT</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="********" 
                    value={activeConfig.bind_password || ''} 
                    onChange={e => handleChangeConfigField('bind_password', e.target.value || null)} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">BENUTZER SUCHFILTER</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={activeConfig.user_search_filter} 
                    onChange={e => handleChangeConfigField('user_search_filter', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GRUPPEN SUCHFILTER</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={activeConfig.group_search_filter} 
                    onChange={e => handleChangeConfigField('group_search_filter', e.target.value)} 
                  />
                </div>
              </div>

              {/* Group Mappings */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                <span className="form-label" style={{ display: 'block', marginBottom: '10px' }}>GRUPPEN-ZUORDNUNGEN (ROLLENMAPPING)</span>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="LDAP Gruppe (z.B. IT-Admins)" 
                    value={newGroupKey}
                    onChange={e => setNewGroupKey(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select 
                    className="form-select" 
                    value={newGroupVal} 
                    onChange={e => setNewGroupVal(e.target.value)}
                    style={{ width: '130px' }}
                  >
                    <option value="Root">Root</option>
                    <option value="Admin">Admin</option>
                    <option value="Creator">Creator</option>
                    <option value="User">User</option>
                    <option value="Guest">Guest</option>
                  </select>
                  <button className="btn btn-secondary" onClick={handleAddMapping}>Hinzufügen</button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(activeConfig.group_to_role_mapping || {}).map(([g, r]) => (
                    <div key={g} className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.8rem' }}>
                      <span>{g} ➔ {r}</span>
                      <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => handleRemoveMapping(g)}>×</span>
                    </div>
                  ))}
                  
                  {Object.keys(activeConfig.group_to_role_mapping || {}).length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Keine Gruppen-Zuordnungen definiert. Benutzer erhalten standardmäßig die Rolle "User".
                    </div>
                  )}
                </div>
              </div>

              {/* Test button */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => handleTestConnection(activeConfig)}>
                  Verbindungstest durchführen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ flex: 1, padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <Cpu size={35} style={{ marginBottom: '10px' }} />
              <p>Erstellen Sie ein LDAP-Verbindungsprofil oder wählen Sie ein bestehendes aus.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LdapSettings;
