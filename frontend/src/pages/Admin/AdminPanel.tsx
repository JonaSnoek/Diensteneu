import { useState } from 'react';
import type { UserType, SystemSettingsType } from '../../App';
import { Users, Cpu, LayoutGrid, FolderCode, Settings, ShieldAlert, ChevronLeft, LogOut } from 'lucide-react';

// Subcomponents (we will create these next)
import UserManagement from './UserManagement';
import LdapSettings from './LdapSettings';
import LauncherManagement from './LauncherManagement';
import ModuleManagement from './ModuleManagement';
import SystemSettings from './SystemSettings';
import AuditLogs from './AuditLogs';

type AdminPanelProps = {
  user: UserType;
  settings: SystemSettingsType;
  onNavigate: (page: 'setup' | 'login' | 'dashboard' | 'admin') => void;
  onLogout: () => void;
};

type ActiveTabType = 'users' | 'ldap' | 'launchers' | 'modules' | 'system' | 'audit';

function AdminPanel({ user, settings, onNavigate, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('users');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement currentUser={user} />;
      case 'ldap':
        return <LdapSettings />;
      case 'launchers':
        return <LauncherManagement />;
      case 'modules':
        return <ModuleManagement currentUser={user} />;
      case 'system':
        return <SystemSettings settings={settings} />;
      case 'audit':
        return <AuditLogs />;
      default:
        return <div>Tab nicht gefunden.</div>;
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'users': return 'Benutzerverwaltung';
      case 'ldap': return 'LDAP / AD Anbindungen';
      case 'launchers': return 'Launcher & Kacheln';
      case 'modules': return 'HTML-Module & Werkzeuge';
      case 'system': return 'Systemeinstellungen';
      case 'audit': return 'Audit Logs (Sicherheit)';
      default: return 'Administration';
    }
  };

  return (
    <div className="portal-container" style={{ minHeight: '100vh', width: '100vw' }}>
      {/* Sidebar background effects */}
      <div className="bg-glow primary"></div>
      <div className="bg-glow accent"></div>

      {/* Admin Sidebar Navigation */}
      <aside className="glass-panel" style={{
        width: '280px',
        margin: '20px 0 20px 20px',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 'var(--border-radius-sm)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 5
      }}>
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              color: 'white',
              boxShadow: 'var(--shadow-neon)'
            }}>
              A
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', display: 'block', letterSpacing: '-0.3px' }}>
                Adminpanel
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--primary-color)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {user.role} Modus
              </span>
            </div>
          </div>

          {/* Back to Portal button */}
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', marginBottom: '24px', justifyContent: 'flex-start' }}
            onClick={() => onNavigate('dashboard')}
          >
            <ChevronLeft size={16} /> Zurück zum Portal
          </button>

          {/* Navigation Items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'users', label: 'Benutzer', icon: Users },
              { id: 'ldap', label: 'LDAP / AD', icon: Cpu },
              { id: 'launchers', label: 'Kacheln (Tiles)', icon: LayoutGrid },
              { id: 'modules', label: 'HTML-Module', icon: FolderCode },
              { id: 'system', label: 'Einstellungen', icon: Settings },
              { id: 'audit', label: 'Audit-Logs', icon: ShieldAlert }
            ].map(tab => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
                  onClick={() => setActiveTab(tab.id as ActiveTabType)}
                >
                  <TabIcon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.display_name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.username}</div>
          </div>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={onLogout}>
            <LogOut size={16} /> Abmelden
          </button>
        </div>
      </aside>

      {/* Tab Viewport */}
      <main style={{ flex: 1, padding: '20px 40px', overflowY: 'auto', zIndex: 5 }}>
        <div className="glass-panel" style={{
          padding: '40px',
          minHeight: 'calc(100vh - 40px)',
          borderRadius: 'var(--border-radius-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Header Title */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              {getTabLabel()}
            </h2>
          </div>

          {/* Active View */}
          <div style={{ flex: 1 }}>
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminPanel;
