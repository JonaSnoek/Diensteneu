import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import type { UserType } from '../../App';
import { UserPlus, Edit2, Trash2, ShieldCheck, ShieldAlert, Mail, UserCheck } from 'lucide-react';

type UserManagementProps = {
  currentUser: UserType;
};

type DbUserType = {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  is_ldap: boolean;
  ldap_dn: string | null;
  created_at: string;
};

function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<DbUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'alle' | 'lokal' | 'ldap' | 'pending'>('alle');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DbUserType | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('User');
  const [isActive, setIsActive] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/users/') as DbUserType[];
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Benutzerliste.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setUsername('');
    setPassword('');
    setDisplayName('');
    setEmail('');
    setRole('User');
    setIsActive(true);
    setError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: DbUserType) => {
    setSelectedUser(user);
    setUsername(user.username);
    setPassword(''); // Leave blank unless changing
    setDisplayName(user.display_name || '');
    setEmail(user.email || '');
    setRole(user.role);
    setIsActive(user.is_active);
    setError('');
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Bitte auszufüllende Felder ausfüllen.');
      return;
    }
    setError('');
    try {
      await api.post('/users/', {
        username,
        password,
        display_name: displayName || null,
        email: email || null,
        role,
        is_active: isActive
      });
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Benutzer konnte nicht erstellt werden.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    try {
      const payload: any = {
        display_name: displayName || null,
        email: email || null,
        role,
        is_active: isActive
      };
      if (password) {
        payload.password = password;
      }
      await api.put(`/users/${selectedUser.id}`, payload);
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Benutzer konnte nicht aktualisiert werden.');
    }
  };

  const handleDeleteUser = async (user: DbUserType) => {
    if (user.role === 'Root') {
      alert('Root-Benutzer kann nicht gelöscht werden.');
      return;
    }
    if (user.id === currentUser.id) {
      alert('Sie können Ihren eigenen Benutzer nicht löschen.');
      return;
    }

    if (window.confirm(`Möchten Sie den Benutzer '${user.username}' wirklich löschen?`)) {
      try {
        await api.delete(`/users/${user.id}`);
        fetchUsers();
      } catch (err: any) {
        alert(err.message || 'Benutzer konnte nicht gelöscht werden.');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    if (tab === 'lokal' && u.is_ldap) return false;
    if (tab === 'ldap' && !u.is_ldap) return false;
    if (tab === 'pending' && !(u.is_ldap && !u.is_active)) return false;
    const query = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(query) ||
      (u.display_name?.toLowerCase() || '').includes(query) ||
      (u.email?.toLowerCase() || '').includes(query) ||
      u.role.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '3px' }}>
          {(['alle', 'lokal', 'ldap', 'pending'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t)}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              {t === 'alle' ? 'Alle' : t === 'lokal' ? 'Lokal' : t === 'ldap' ? 'LDAP' : 'Ausstehend'}
            </button>
          ))}
        </div>
        <input type="text" className="form-input"
          placeholder="Suchen..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }} />
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} /> Benutzer hinzufügen
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Lädt Benutzer...</div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Benutzername</th>
                <th>Anzeigename</th>
                <th>E-Mail</th>
                <th>Typ</th>
                <th>Rolle</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td>{u.display_name || '-'}</td>
                  <td>
                    {u.email ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} color="var(--text-muted)" /> {u.email}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${u.is_ldap ? 'badge-accent' : 'badge-primary'}`}>
                      {u.is_ldap ? 'LDAP' : 'Lokal'}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {u.role === 'Root' ? (
                        <ShieldAlert size={14} color="var(--accent-color)" />
                      ) : u.role === 'Admin' ? (
                        <ShieldCheck size={14} color="var(--primary-color)" />
                      ) : (
                        <UserCheck size={14} color="var(--text-secondary)" />
                      )}
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.is_ldap && !u.is_active ? (
                      <span className="badge badge-accent" style={{ background: '#f59e0b', color: '#000' }}>
                        Ausstehend
                      </span>
                    ) : (
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleOpenEdit(u)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      >
                        <Edit2 size={12} /> Bearbeiten
                      </button>

                      {u.is_ldap && !u.is_active && (
                        <button className="btn btn-primary"
                          onClick={async () => {
                            try {
                              await api.put(`/users/${u.id}`, { is_active: true });
                              fetchUsers();
                            } catch (err: any) {
                              alert(err.message || 'Freigabe fehlgeschlagen.');
                            }
                          }}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                          <UserCheck size={12} /> Freigeben
                        </button>
                      )}
                      
                      {u.role !== 'Root' && u.id !== currentUser.id && (
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDeleteUser(u)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        >
                          <Trash2 size={12} /> Löschen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddModal && (
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
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Lokalen Benutzer hinzufügen</h3>
            {error && <div className="badge badge-danger" style={{ display: 'block', padding: '8px', marginBottom: '15px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">BENUTZERNAME</label>
                <input type="text" className="form-input" required value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">PASSWORT</label>
                <input type="password" className="form-input" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ANZEIGENAME</label>
                <input type="text" className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-MAIL</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ROLLE</label>
                  <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="Admin">Admin</option>
                    <option value="Creator">Creator</option>
                    <option value="User">User</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0, justifyContent: 'center' }}>
                  <div className="switch-container">
                    <span className="form-label">AKTIV</span>
                    <label className="switch">
                      <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
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
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Benutzer bearbeiten: {selectedUser.username}</h3>
            {error && <div className="badge badge-danger" style={{ display: 'block', padding: '8px', marginBottom: '15px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
            
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ANZEIGENAME</label>
                <input type="text" className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-MAIL</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              
              {!selectedUser.is_ldap && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">NEUES PASSWORT (LEER LASSEN FÜR KEINE ÄNDERUNG)</label>
                  <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              )}
              
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ROLLE</label>
                  <select 
                    className="form-select" 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    disabled={selectedUser.role === 'Root' && currentUser.role !== 'Root'}
                  >
                    {selectedUser.role === 'Root' && <option value="Root">Root</option>}
                    <option value="Admin">Admin</option>
                    <option value="Creator">Creator</option>
                    <option value="User">User</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0, justifyContent: 'center' }}>
                  <div className="switch-container">
                    <span className="form-label">AKTIV</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={e => setIsActive(e.target.checked)} 
                        disabled={selectedUser.role === 'Root'} // Root cannot be disabled
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
