import React, { useState, useEffect, useRef } from 'react';
import { api, resolveUrl } from '../../utils/api';
import type { SystemSettingsType } from '../../App';
import { Settings, Save, Upload, Image } from 'lucide-react';

type SystemSettingsProps = {
  settings: SystemSettingsType;
};

type DbStatusType = {
  database_connected: boolean;
  totals: {
    users: number;
    modules: number;
    launchers: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    usage_pct: number;
  };
  server_time: string;
};

type LogoFieldProps = {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: () => void;
};

function LogoField({ label, hint, value, uploading, onChange, onUpload }: LogoFieldProps) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Image size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text" className="form-input"
          placeholder="URL oder leer lassen (Standard-Text)"
          value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}
        />
        <button type="button" className="btn" onClick={onUpload} disabled={uploading} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={15} /> {uploading ? 'Lade...' : 'Hochladen'}
        </button>
      </div>
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={resolveUrl(value)} alt="Logo-Vorschau" style={{ height: '32px', objectFit: 'contain' }} onError={e => (e.currentTarget.style.display = 'none')} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{value}</span>
        </div>
      )}
    </div>
  );
}

function SystemSettings({ settings: initialSettings }: SystemSettingsProps) {
  const [portalName, setPortalName] = useState(initialSettings.portal_name);
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url || '');
  const [headerLogoUrl, setHeaderLogoUrl] = useState(initialSettings.header_logo_url || '');
  const [loginLogoUrl, setLoginLogoUrl] = useState(initialSettings.login_logo_url || '');
  const [faviconUrl, setFaviconUrl] = useState(initialSettings.favicon_url || '');
  const [primaryColor, setPrimaryColor] = useState(initialSettings.primary_color);
  const [accentColor, setAccentColor] = useState(initialSettings.accent_color);
  const [allowGuest, setAllowGuest] = useState(initialSettings.allow_guest_access);
  const [sessionTimeout, setSessionTimeout] = useState(initialSettings.session_timeout_minutes);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo uploads
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef<'login' | 'header' | 'favicon'>('login');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = fileTargetRef.current;
    if (!file) return;
    setUploadingLogo(target);
    setError('');
    setSuccess('');
    try {
      const result = await api.upload(`/system/upload-logo?target=${target}`, file) as any;
      const url = result.logo_url;
      if (target === 'header') { setHeaderLogoUrl(url); if (!logoUrl) setLogoUrl(url); }
      else if (target === 'favicon') { setFaviconUrl(url); }
      else { setLoginLogoUrl(url); setLogoUrl(url); }
      setSuccess('Logo erfolgreich hochgeladen. Seite evtl. neu laden (F5) für den Effekt.');
    } catch (err: any) {
      setError(err.message || 'Logo-Upload fehlgeschlagen.');
    } finally {
      setUploadingLogo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (target: 'login' | 'header' | 'favicon') => {
    fileTargetRef.current = target;
    fileInputRef.current?.click();
  };

  // Diagnostic Status
  const [statusData, setStatusData] = useState<DbStatusType | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.get('/system/status') as DbStatusType;
      setStatusData(data);
    } catch (e) {
      console.error("Failed to load system diagnostics:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updated = await api.put('/system/settings', {
        portal_name: portalName,
        logo_url: logoUrl || null,
        header_logo_url: headerLogoUrl || null,
        login_logo_url: loginLogoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primaryColor,
        accent_color: accentColor,
        allow_guest_access: allowGuest,
        session_timeout_minutes: sessionTimeout
      }) as any;

      // Update local storage/css variables on live page
      document.documentElement.style.setProperty('--primary-color', updated.primary_color);
      document.documentElement.style.setProperty('--accent-color', updated.accent_color);
      document.title = updated.portal_name;

      // Refresh favicon <link> with the new uploaded icon
      const favSrc = resolveUrl(updated.favicon_url || '');
      const iconLink = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
      if (updated.favicon_url) {
        if (iconLink) iconLink.href = favSrc;
        else {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.href = favSrc;
          document.head.appendChild(link);
        }
      }

      setSuccess('Systemeinstellungen erfolgreich aktualisiert. Bitte laden Sie das Portal ggf. neu, um alle Designänderungen zu sehen.');
    } catch (err: any) {
      setError(err.message || 'Speichern der Einstellungen fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
      
      {/* Left Side: Configuration form */}
      <div className="glass-panel" style={{ padding: '30px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} color="var(--primary-color)" /> Grundeinstellungen
        </h3>

        {error && <div className="badge badge-danger" style={{ display: 'block', padding: '10px', marginBottom: '15px', textAlign: 'center', textTransform: 'none' }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ display: 'block', padding: '10px', marginBottom: '15px', textAlign: 'center', textTransform: 'none' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">PORTAL NAME (BRANDING)</label>
            <input type="text" className="form-input" required value={portalName} onChange={e => setPortalName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">LOGOS</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <LogoField
                label="Login-Logo"
                hint="(Login-Karte)"
                value={loginLogoUrl}
                uploading={uploadingLogo === 'login'}
                onChange={setLoginLogoUrl}
                onUpload={() => triggerUpload('login')}
              />
              <LogoField
                label="Header-Logo"
                hint="(breites Logo oben, ersetzt den Text)"
                value={headerLogoUrl}
                uploading={uploadingLogo === 'header'}
                onChange={setHeaderLogoUrl}
                onUpload={() => triggerUpload('header')}
              />
              <LogoField
                label="Favicon"
                hint="(Browser-Tab-Icon)"
                value={faviconUrl}
                uploading={uploadingLogo === 'favicon'}
                onChange={setFaviconUrl}
                onUpload={() => triggerUpload('favicon')}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico" onChange={handleLogoUpload} style={{ display: 'none' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Alle drei werden unabhängig voneinander ersetzt. Ohne Header-Logo wird Logo + Portalname als Text angezeigt.
                </span>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">THEME PRIMÄRFARBE</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="color" className="form-input" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: '50px', height: '45px', padding: '2px', cursor: 'pointer' }} />
                <input type="text" className="form-input" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">THEME AKZENTFARBE</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="color" className="form-input" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: '50px', height: '45px', padding: '2px', cursor: 'pointer' }} />
                <input type="text" className="form-input" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SITZUNGS-TIMEOUT (MINUTEN)</label>
              <input type="number" className="form-input" required value={sessionTimeout} onChange={e => setSessionTimeout(parseInt(e.target.value) || 60)} />
            </div>
            
            <div className="form-group" style={{ justifyContent: 'center' }}>
              <div className="switch-container">
                <div>
                  <span className="form-label" style={{ fontWeight: 600 }}>GAST-ZUGANG ERLAUBEN</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={allowGuest} onChange={e => setAllowGuest(e.target.checked)} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={16} /> {loading ? 'Speichern...' : 'Einstellungen speichern'}
            </button>
          </div>
        </form>
      </div>

      {/* Right Side: System Status / Diagnostics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* DB Connection status */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Systemstatus
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Datenbank</span>
              {statusData?.database_connected ? (
                <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Verbunden</span>
              ) : (
                <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Getrennt</span>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Registrierte User</span>
              <span style={{ fontWeight: 'bold' }}>{statusData?.totals.users ?? '-'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Geladene Module</span>
              <span style={{ fontWeight: 'bold' }}>{statusData?.totals.modules ?? '-'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Dashboard Kacheln</span>
              <span style={{ fontWeight: 'bold' }}>{statusData?.totals.launchers ?? '-'}</span>
            </div>
          </div>
        </div>

        {/* Disk space usage */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Speicherplatz (Disk)
          </h4>

          {statusData?.disk ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Belegt</span>
                <span style={{ fontWeight: 600 }}>{statusData.disk.used_gb} GB / {statusData.disk.total_gb} GB</span>
              </div>
              
              {/* Progress bar */}
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${statusData.disk.usage_pct}%`,
                  background: statusData.disk.usage_pct > 85 ? '#ef4444' : 'var(--primary-color)',
                  borderRadius: '3px'
                }} />
              </div>
              
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
                {statusData.disk.free_gb} GB frei ({statusData.disk.usage_pct}% belegt)
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lade Details...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;
