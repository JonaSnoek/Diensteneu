import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { ShieldAlert, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

type AuditLogType = {
  id: number;
  timestamp: string;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
};

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Pagination
  const [actionFilter, setActionFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const limit = 50;
  const [offset, setOffset] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const query = `limit=${limit}&offset=${offset}` + 
        (actionFilter ? `&action=${actionFilter}` : '') + 
        (usernameFilter ? `&username=${usernameFilter}` : '');
        
      const response = await api.get(`/audit/logs?${query}`) as { total: number; logs: AuditLogType[] };
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Audit-Logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, actionFilter, usernameFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0); // Reset pagination
    fetchLogs();
  };

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('FAIL') || action.includes('DELETE') || action.includes('ERR')) {
      return 'badge-danger';
    }
    if (action.includes('SUCCESS') || action.includes('SYNC') || action.includes('INIT')) {
      return 'badge-success';
    }
    if (action.includes('UPDATE') || action.includes('CREATE')) {
      return 'badge-warning';
    }
    return 'badge-primary';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search Filter Form */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
          <label className="form-label">FILTER BENUTZERNAME</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="z.B. admin" 
              value={usernameFilter} 
              onChange={e => setUsernameFilter(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, width: '180px' }}>
          <label className="form-label">FILTER AKTION</label>
          <select className="form-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">Alle Aktionen</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="SYSTEM_INIT">SYSTEM_INIT</option>
            <option value="CREATE_USER">CREATE_USER</option>
            <option value="UPDATE_USER">UPDATE_USER</option>
            <option value="DELETE_USER">DELETE_USER</option>
            <option value="UPLOAD_MODULE">UPLOAD_MODULE</option>
            <option value="UPDATE_MODULE">UPDATE_MODULE</option>
            <option value="DELETE_MODULE">DELETE_MODULE</option>
            <option value="CREATE_LAUNCHER">CREATE_LAUNCHER</option>
            <option value="UPDATE_LAUNCHER">UPDATE_LAUNCHER</option>
            <option value="DELETE_LAUNCHER">DELETE_LAUNCHER</option>
            <option value="LDAP_SYNC">LDAP_SYNC</option>
            <option value="UPDATE_LDAP_CONFIG">UPDATE_LDAP_CONFIG</option>
            <option value="UPDATE_SYSTEM_SETTINGS">UPDATE_SYSTEM_SETTINGS</option>
          </select>
        </div>

        <button type="submit" className="btn btn-secondary" disabled={loading}>
          Filtern
        </button>
        
        <button type="button" className="btn btn-secondary" onClick={fetchLogs} disabled={loading} style={{ minWidth: '40px', padding: '10px' }} title="Aktualisieren">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </form>

      {error && <div className="badge badge-danger" style={{ display: 'block', padding: '10px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}

      {/* Logs Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Logs werden geladen...</div>
      ) : logs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
          <ShieldAlert size={35} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Keine Audit-Log-Einträge gefunden.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '170px' }}>Zeitstempel (UTC)</th>
                  <th>Benutzer</th>
                  <th>Kategorie / Aktion</th>
                  <th>Beschreibung (Details)</th>
                  <th>IP-Adresse</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.username || '-'}</td>
                    <td>
                      <span className={`badge ${getActionBadgeClass(log.action)}`} style={{ fontSize: '0.62rem', letterSpacing: '0.3px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '400px', wordBreak: 'break-word', whiteSpace: 'normal', fontSize: '0.82rem' }}>
                      {log.details}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Zeige {offset + 1} - {Math.min(offset + limit, total)} von {total} Einträgen
            </span>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handlePrevPage} 
                disabled={offset === 0}
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={14} /> Zurück
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleNextPage} 
                disabled={offset + limit >= total}
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                Weiter <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditLogs;
