import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import type { UserType } from '../../App';
import { FolderCode, Upload, Trash2, FileCheck, Eye, EyeOff } from 'lucide-react';

type ModuleSchema = {
  id: string;
  name: string;
  version: string;
  description: string | null;
  icon: string;
  entry_point: string;
  category: string;
  is_active: boolean;
  uploaded_at: string;
  uploaded_by_id: number | null;
};

type ModuleManagementProps = {
  currentUser: UserType;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ModuleManagement({ currentUser: _currentUser }: ModuleManagementProps) {
  const [modules, setModules] = useState<ModuleSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [singleHtmlFile, setSingleHtmlFile] = useState<File | null>(null);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const data = await api.get('/modules/') as ModuleSchema[];
      setModules(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Module.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleSingleHtmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSingleHtmlFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleSingleHtmlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleHtmlFile) {
      setError('Bitte wählen Sie eine HTML-Datei aus.');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.upload('/modules/upload-html', singleHtmlFile) as ModuleSchema;
      setSuccess(`HTML-Datei '${data.name}' erfolgreich hochgeladen.`);
      setSingleHtmlFile(null);
      const fileInput = document.getElementById('single-html-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchModules();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen der HTML-Datei.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Bitte wählen Sie eine ZIP-Datei aus.');
      return;
    }
    
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const data = await api.upload('/modules/upload', selectedFile) as ModuleSchema;
      setSuccess(`Modul '${data.name}' (v${data.version}) erfolgreich hochgeladen und extrahiert.`);
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('module-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      fetchModules();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen des Moduls.');
    } finally {
      setUploading(false);
    }
  };

  const toggleModuleActive = async (mod: ModuleSchema) => {
    setError('');
    setSuccess('');
    try {
      const updated = await api.put(`/modules/${mod.id}`, {
        is_active: !mod.is_active
      }) as ModuleSchema;
      
      setModules(modules.map(m => {
        if (m.id === mod.id) {
          return { ...m, is_active: updated.is_active };
        }
        return m;
      }));
      setSuccess(`Modul '${mod.name}' wurde ${updated.is_active ? 'aktiviert' : 'deaktiviert'}.`);
    } catch (err: any) {
      setError(err.message || 'Status konnte nicht geändert werden.');
    }
  };

  const handleDelete = async (mod: ModuleSchema) => {
    if (window.confirm(`Möchten Sie das Modul '${mod.name}' und alle zugehörigen Dateien wirklich löschen? Dies löscht auch die entsprechende Dashboard-Kachel!`)) {
      setError('');
      setSuccess('');
      try {
        await api.delete(`/modules/${mod.id}`);
        setModules(modules.filter(m => m.id !== mod.id));
        setSuccess(`Modul '${mod.name}' erfolgreich gelöscht.`);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Löschen des Moduls.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && <div className="badge badge-danger" style={{ display: 'block', padding: '10px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
      {success && <div className="badge badge-success" style={{ display: 'block', padding: '10px', textAlign: 'center', textTransform: 'none' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
        
        {/* Left Side: Installed Modules Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Installierte HTML-Werkzeuge</h3>
          
          {loading ? (
            <div>Lädt Module...</div>
          ) : modules.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
              <FolderCode size={30} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Es wurden noch keine Module hochgeladen.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Modul Name</th>
                    <th>ID / Ordner</th>
                    <th>Version</th>
                    <th>Kategorie</th>
                    <th>Status</th>
                    <th>Hochgeladen</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><code>/{m.id}</code></td>
                      <td>{m.version}</td>
                      <td>{m.category}</td>
                      <td>
                        <span className={`badge ${m.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {m.is_active ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(m.uploaded_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className={`btn ${m.is_active ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => toggleModuleActive(m)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            title={m.is_active ? 'Deaktivieren' : 'Aktivieren'}
                          >
                            {m.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleDelete(m)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Modul löschen"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Upload Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Single HTML Upload */}
          <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} color="var(--primary-color)" /> Einzelne HTML-Datei
            </h3>
            
            <form onSubmit={handleSingleHtmlSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: singleHtmlFile ? 'rgba(var(--primary-rgb), 0.03)' : 'rgba(0,0,0,0.1)',
                borderColor: singleHtmlFile ? 'var(--primary-color)' : 'var(--border-color)',
                transition: 'all 0.2s',
                position: 'relative'
              }}>
                <input 
                  id="single-html-input"
                  type="file" 
                  accept=".html"
                  onChange={handleSingleHtmlChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                {singleHtmlFile ? (
                  <div>
                    <FileCheck size={22} color="var(--primary-color)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {singleHtmlFile.name}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={22} color="var(--text-muted)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      .html Datei auswählen
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploading || !singleHtmlFile}>
                {uploading ? 'Wird hochgeladen...' : 'HTML-Datei hochladen'}
              </button>
            </form>
          </div>

          {/* ZIP Uploader */}
          <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} color="var(--primary-color)" /> ZIP-Modul hochladen
            </h3>
            
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: selectedFile ? 'rgba(var(--primary-rgb), 0.03)' : 'rgba(0,0,0,0.1)',
                borderColor: selectedFile ? 'var(--primary-color)' : 'var(--border-color)',
                transition: 'all 0.2s',
                position: 'relative'
              }}>
                <input 
                  id="module-file-input"
                  type="file" 
                  accept=".zip"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                {selectedFile ? (
                  <div>
                    <FileCheck size={22} color="var(--primary-color)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {roundSize(selectedFile.size)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={22} color="var(--text-muted)" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Klicken oder ZIP-Datei hierher ziehen
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploading || !selectedFile}>
                {uploading ? 'Wird hochgeladen...' : 'Modul installieren'}
              </button>
            </form>

            <div style={{
              marginTop: '16px',
              padding: '10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-color)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>Anforderungen:</strong>
              - ZIP mit HTML/JS/CSS + <code>manifest.json</code> (id, name, version)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function roundSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default ModuleManagement;
