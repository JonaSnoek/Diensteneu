import { useState, useEffect, type ReactNode } from 'react';
import { api } from '../../utils/api';
import { Cpu, ShieldCheck, UserRound, Activity, Database, Server, HardDrive } from 'lucide-react';

type AuthStatus = {
  ldap: { enabled: boolean; disabled_until: string | null; state: 'active' | 'temp_disabled' | 'permanently_disabled' | string };
  sso: { enabled: boolean; provider_name: string | null };
  guest: { enabled: boolean };
};

type SystemStatus = {
  database_connected: boolean;
  totals: { users: number; modules: number; launchers: number };
  disk: { total_gb: number; used_gb: number; free_gb: number; usage_pct: number };
  server_time: string;
};

function formatLocal(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AuthTile({ icon, title, label, dotClass, hint }: {
  icon: ReactNode;
  title: string;
  label: string;
  dotClass: string;
  hint: string;
}) {
  return (
    <div className="panel" style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>
        <span className={`status-dot ${dotClass}`} />
        {label}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{hint}</div>
    </div>
  );
}

function AdminDashboard() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/admin/status').then(setAuth).catch((e: any) => setError(e.message || 'Status nicht ladbar.'));
    api.get('/system/status').then(setSys).catch((e: any) => setError(e.message || 'Systemstatus nicht ladbar.'));
  }, []);

  if (error) {
    return (
      <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Übersicht über Authentifizierung und System.</p>
      </div>

      {/* Authentifizierung */}
      <div>
        <div className="panel-header" style={{ border: 'none', paddingBottom: '0', marginBottom: '12px' }}>
          <div className="panel-title" style={{ fontSize: '0.95rem' }}>
            <ShieldCheck size={17} color="var(--primary)" /> Authentifizierung
          </div>
        </div>
        <div className="stat-grid">
          <AuthTile
            icon={<Cpu size={18} />}
            title="LDAP / AD"
            label={
              !auth ? 'Lädt...'
              : auth.ldap.state === 'temp_disabled' ? `Deaktiviert bis ${formatLocal(auth.ldap.disabled_until)} Uhr`
              : auth.ldap.state === 'permanently_disabled' ? 'Permanent deaktiviert'
              : auth.ldap.enabled ? 'Aktiv' : 'Deaktiviert'
            }
            dotClass={
              !auth ? 'status-dot-info'
              : auth.ldap.state === 'active' && auth.ldap.enabled ? 'status-dot-active'
              : auth.ldap.state === 'temp_disabled' ? 'status-dot-warning'
              : 'status-dot-danger'
            }
            hint={auth?.ldap.enabled ? 'LDAP-Anmeldung ist verfügbar.' : 'LDAP-Anmeldung ist derzeit nicht verfügbar.'}
          />
          <AuthTile
            icon={<ShieldCheck size={18} />}
            title="SSO"
            label={auth ? (auth.sso.enabled ? 'Aktiv' : 'Deaktiviert') : 'Lädt...'}
            dotClass={auth?.sso.enabled ? 'status-dot-active' : 'status-dot-danger'}
            hint={auth?.sso.enabled ? `Anmeldung über ${auth.sso.provider_name || 'SSO'} ist verfügbar.` : 'Anmeldung über SSO ist nicht konfiguriert.'}
          />
          <AuthTile
            icon={<UserRound size={18} />}
            title="Gastzugang"
            label={auth ? (auth.guest.enabled ? 'Aktiv' : 'Deaktiviert') : 'Lädt...'}
            dotClass={auth?.guest.enabled ? 'status-dot-active' : 'status-dot-danger'}
            hint={auth?.guest.enabled ? 'Gäste können ohne Anmeldung fortfahren.' : 'Der Gastzugang ist deaktiviert.'}
          />
        </div>
      </div>

      {/* System */}
      <div>
        <div className="panel-header" style={{ border: 'none', paddingBottom: '0', marginBottom: '12px' }}>
          <div className="panel-title" style={{ fontSize: '0.95rem' }}>
            <Activity size={17} color="var(--primary)" /> System
          </div>
        </div>
        <div className="stat-grid">
          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Database size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Datenbank</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
              <span className={`status-dot ${sys?.database_connected ? 'status-dot-active' : 'status-dot-danger'}`} />
              {sys ? (sys.database_connected ? 'Verbunden' : 'Fehler') : 'Lädt...'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Datenbankverbindung wird geprüft.</div>
          </div>

          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <UserRound size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Benutzer</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{sys ? sys.totals.users : '–'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Registrierte Konten</div>
          </div>

          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Server size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Dienste</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{sys ? sys.totals.launchers : '–'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Kacheln · Module: {sys ? sys.totals.modules : '–'}</div>
          </div>

          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <HardDrive size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Speicher</span>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{sys ? `${sys.disk.usage_pct}%` : '–'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {sys ? `${sys.disk.used_gb} / ${sys.disk.total_gb} GB` : 'Speicherauslastung'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;