import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { getIconComponent, COMMON_ICONS } from '../../utils/icons';
import { Plus, Edit2, Trash2 } from 'lucide-react';

type LauncherSchema = {
  id: number;
  title: string;
  description: string | null;
  icon: string;
  category: string;
  target_type: string;
  target_url: string;
  visibility: string;
  allowed_roles: string[];
  allowed_ldap_groups: string[];
  allowed_users: string[];
  display_order: number;
  design_color: string | null;
};

function LauncherManagement() {
  const [launchers, setLaunchers] = useState<LauncherSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLauncher, setSelectedLauncher] = useState<LauncherSchema | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('link');
  const [category, setCategory] = useState('General');
  const [targetType, setTargetType] = useState('external_url');
  const [targetUrl, setTargetUrl] = useState('');
  
  const [visibility, setVisibility] = useState('login_required');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedLdapGroupsStr, setAllowedLdapGroupsStr] = useState('');
  const [allowedUsersStr, setAllowedUsersStr] = useState('');
  
  const [displayOrder, setDisplayOrder] = useState(0);
  const [designColor, setDesignColor] = useState('#00c8ff');

  const fetchLaunchers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/launchers/all') as LauncherSchema[];
      setLaunchers(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Launcher-Liste.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaunchers();
  }, []);

  const handleOpenAdd = () => {
    setTitle('');
    setDescription('');
    setIcon('link');
    setCategory('General');
    setTargetType('external_url');
    setTargetUrl('');
    setVisibility('login_required');
    setAllowedRoles([]);
    setAllowedLdapGroupsStr('');
    setAllowedUsersStr('');
    setDisplayOrder(launchers.length);
    setDesignColor('#00c8ff');
    setError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (l: LauncherSchema) => {
    setSelectedLauncher(l);
    setTitle(l.title);
    setDescription(l.description || '');
    setIcon(l.icon);
    setCategory(l.category);
    setTargetType(l.target_type);
    setTargetUrl(l.target_url);
    setVisibility(l.visibility);
    setAllowedRoles(l.allowed_roles || []);
    setAllowedLdapGroupsStr((l.allowed_ldap_groups || []).join(', '));
    setAllowedUsersStr((l.allowed_users || []).join(', '));
    setDisplayOrder(l.display_order);
    setDesignColor(l.design_color || '#00c8ff');
    setError('');
    setShowEditModal(true);
  };

  const parseStringToArray = (str: string): string[] => {
    return str.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const handleRoleCheckbox = (role: string) => {
    if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter(r => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetUrl.trim()) {
      setError('Titel und Ziel-URL müssen ausgefüllt werden.');
      return;
    }

    try {
      await api.post('/launchers/', {
        title,
        description: description || null,
        icon,
        category,
        target_type: targetType,
        target_url: targetUrl,
        visibility,
        allowed_roles: allowedRoles,
        allowed_ldap_groups: parseStringToArray(allowedLdapGroupsStr),
        allowed_users: parseStringToArray(allowedUsersStr),
        display_order: displayOrder,
        design_color: designColor || null
      });
      setShowAddModal(false);
      fetchLaunchers();
      setSuccess('Launcher Kachel erfolgreich erstellt.');
    } catch (err: any) {
      setError(err.message || 'Launcher konnte nicht erstellt werden.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLauncher) return;

    try {
      await api.put(`/launchers/${selectedLauncher.id}`, {
        title,
        description: description || null,
        icon,
        category,
        target_type: targetType,
        target_url: targetUrl,
        visibility,
        allowed_roles: allowedRoles,
        allowed_ldap_groups: parseStringToArray(allowedLdapGroupsStr),
        allowed_users: parseStringToArray(allowedUsersStr),
        display_order: displayOrder,
        design_color: designColor || null
      });
      setShowEditModal(false);
      fetchLaunchers();
      setSuccess('Launcher Kachel erfolgreich aktualisiert.');
    } catch (err: any) {
      setError(err.message || 'Launcher konnte nicht aktualisiert werden.');
    }
  };

  const handleDelete = async (l: LauncherSchema) => {
    if (window.confirm(`Möchten Sie den Launcher '${l.title}' wirklich löschen?`)) {
      try {
        await api.delete(`/launchers/${l.id}`);
        fetchLaunchers();
        setSuccess(`Launcher '${l.title}' erfolgreich gelöscht.`);
      } catch (err: any) {
        setError(err.message || 'Löschen fehlgeschlagen.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Alert notices */}
      {error && <div className="badge badge-danger" style={{ display: 'block', padding: '10px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
      {success && <div className="badge badge-success" style={{ display: 'block', padding: '10px', textAlign: 'center', textTransform: 'none' }}>{success}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Erstellen und verwalten Sie Links, HTML-Module und Anwendungs-Kacheln für das zentrale Benutzer-Dashboard.
        </p>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Kachel hinzufügen
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Lädt Kacheln...</div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Icon</th>
                <th>Titel</th>
                <th>Kategorie</th>
                <th>Ziel-Typ</th>
                <th>Ziel-URL / Pfad</th>
                <th>Sichtbarkeit</th>
                <th>Reihenfolge</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {launchers.map(l => {
                const Icon = getIconComponent(l.icon);
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: l.design_color ? `${l.design_color}18` : 'rgba(255,255,255,0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: l.design_color || 'var(--primary-color)',
                        border: `1px solid ${l.design_color || 'var(--border-color)'}`
                      }}>
                        <Icon size={16} />
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.title}</td>
                    <td>{l.category}</td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                        {l.target_type}
                      </span>
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {l.target_url}
                    </td>
                    <td>
                      <span className={`badge ${
                        l.visibility === 'public' ? 'badge-success' :
                        l.visibility === 'login_required' ? 'badge-primary' :
                        l.visibility === 'hidden' ? 'badge-danger' : 'badge-warning'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {l.visibility}
                      </span>
                    </td>
                    <td>{l.display_order}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleOpenEdit(l)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        >
                          <Edit2 size={12} /> Bearbeiten
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDelete(l)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        >
                          <Trash2 size={12} /> Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {(showAddModal || showEditModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '650px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>
              {showAddModal ? 'Neue Launcher Kachel erstellen' : 'Launcher Kachel bearbeiten'}
            </h3>
            {error && <div className="badge badge-danger" style={{ display: 'block', padding: '8px', marginBottom: '15px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
            
            <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">TITEL</label>
                  <input type="text" className="form-input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Firmen-Wiki" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">KATEGORIE</label>
                  <input type="text" className="form-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. Tools, Verwaltung" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">BESCHREIBUNG</label>
                <textarea 
                  className="form-input" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Kurze Dienstbeschreibung..." 
                  style={{ resize: 'none', height: '60px' }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ICON</label>
                  <select className="form-select" value={icon} onChange={e => setIcon(e.target.value)}>
                    {COMMON_ICONS.map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">KACHEL FARBE (AKZENT)</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="color" 
                      className="form-input" 
                      value={designColor} 
                      onChange={e => setDesignColor(e.target.value)} 
                      style={{ width: '50px', height: '45px', padding: '2px', cursor: 'pointer' }}
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      value={designColor} 
                      onChange={e => setDesignColor(e.target.value)} 
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ZIEL TYP</label>
                  <select className="form-select" value={targetType} onChange={e => setTargetType(e.target.value)}>
                    <option value="external_url">Externe Webseite (URL)</option>
                    <option value="internal_html">Internes HTML Modul</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">SORTIERREIHENFOLGE (DISPLAY ORDER)</label>
                  <input type="number" className="form-input" value={displayOrder} onChange={e => setDisplayOrder(parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">ZIEL URL ODER MODUL PFAD</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={targetUrl} 
                  onChange={e => setTargetUrl(e.target.value)} 
                  placeholder={targetType === 'external_url' ? 'https://wiki.example.com' : '/api/modules/files/rechner/index.html'} 
                />
              </div>

              <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '5px' }}>
                <label className="form-label">SICHTBARKEIT & BERECHTIGUNG</label>
                <select className="form-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
                  <option value="public">Öffentlich (Gast darf sehen & nutzen)</option>
                  <option value="login_required">Login erforderlich (Jeder angemeldete User)</option>
                  <option value="role_restricted">Rollen-basiert (Nach Portalrollen)</option>
                  <option value="ldap_group_restricted">LDAP-basiert (Nach LDAP-Gruppennamen)</option>
                  <option value="user_restricted">Benutzerliste (Explizite Usernamen)</option>
                  <option value="hidden">Versteckt (Nur Admins)</option>
                </select>
              </div>

              {/* Conditional RBAC visibility inputs */}
              {visibility === 'role_restricted' && (
                <div className="form-group animate-fade-in">
                  <label className="form-label">ZUGELASSENE ROLLEN</label>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    {['Admin', 'Creator', 'User', 'Guest'].map(role => (
                      <label key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={allowedRoles.includes(role)} onChange={() => handleRoleCheckbox(role)} />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {visibility === 'ldap_group_restricted' && (
                <div className="form-group animate-fade-in">
                  <label className="form-label">ZUGELASSENE LDAP GRUPPEN (KOMMA-SEPARIERT)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="z.B. IT-Support, HR-Team, dev_staff" 
                    value={allowedLdapGroupsStr}
                    onChange={e => setAllowedLdapGroupsStr(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Der Benutzer wird zugelassen, sobald er in mindestens einer dieser Gruppen Mitglied ist.</span>
                </div>
              )}

              {visibility === 'user_restricted' && (
                <div className="form-group animate-fade-in">
                  <label className="form-label">ZUGELASSENE BENUTZERNAMEN (KOMMA-SEPARIERT)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="z.B. admin, jdoe, user123" 
                    value={allowedUsersStr}
                    onChange={e => setAllowedUsersStr(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">{showAddModal ? 'Erstellen' : 'Speichern'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LauncherManagement;
