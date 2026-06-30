import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, resolveUrl } from '../utils/api';
import { getIconComponent } from '../utils/icons';
import {
  Search, ExternalLink, LayoutGrid, X, Maximize2,
  ChevronRight, Settings, Users, Cpu, FolderCode,
  ShieldAlert,
} from 'lucide-react';

type LauncherType = {
  id: number;
  title: string;
  description: string | null;
  icon: string;
  category: string;
  target_type: string;
  target_url: string;
  visibility: string;
  display_order: number;
  design_color: string | null;
  is_favorite: boolean;
};

const palette = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#f97316', '#8b5cf6', '#ec4899', '#14b8a6',
];

function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

type CategoryNodeProps = {
  label: string;
  color: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function CategoryNode({ label, color, icon, count, children, defaultOpen }: CategoryNodeProps) {
  const [open, setOpen] = useState(defaultOpen || false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'box-shadow 0.25s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          width: '100%', padding: '20px 24px',
          background: 'transparent', border: 'none',
          color: 'var(--text)', cursor: 'pointer',
          fontFamily: 'var(--font)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, flexShrink: 0,
          transition: 'transform 0.3s',
          transform: open ? 'scale(1.05)' : 'scale(1)',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '2px' }}>{label}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {count} Einträge
          </div>
        </div>
        <ChevronRight
          size={18}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.3s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.35s ease',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div ref={contentRef} style={{ padding: open ? '0 24px 20px' : '0 24px' }}>
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '16px',
            }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ItemCardProps = {
  title: string;
  description?: string | null;
  icon: string;
  color: string;
  onClick: () => void;
};

function ItemCard({ title, description, icon, color, onClick }: ItemCardProps) {
  const IconComp = getIconComponent(icon);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        width: '100%', padding: '12px 14px',
        background: 'transparent', border: '1px solid var(--border)',
        borderRadius: '10px', color: 'var(--text)',
        cursor: 'pointer', fontFamily: 'var(--font)',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${color}08`;
        e.currentTarget.style.borderColor = `${color}30`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{
        width: '34px', height: '34px', borderRadius: '9px',
        background: `${color}12`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: color,
      }}>
        <IconComp size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{title}</div>
        {description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </div>
        )}
      </div>
      <ExternalLink size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}

const adminItems = [
  { label: 'Benutzer', icon: Users, path: '/admin/users' },
  { label: 'LDAP / AD', icon: Cpu, path: '/admin/ldap' },
  { label: 'Kacheln (Tiles)', icon: LayoutGrid, path: '/admin/launchers' },
  { label: 'HTML-Module', icon: FolderCode, path: '/admin/modules' },
  { label: 'Einstellungen', icon: Settings, path: '/admin/system' },
  { label: 'Audit-Logs', icon: ShieldAlert, path: '/admin/audit' },
];

function Dashboard() {
  const navigate = useNavigate();
  const [launchers, setLaunchers] = useState<LauncherType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState<LauncherType | null>(null);

  const fetchLaunchers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/launchers/') as LauncherType[];
      setLaunchers(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLaunchers(); }, []);

  const grouped = launchers.reduce<Record<string, LauncherType[]>>((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category].push(l);
    return acc;
  }, {});

  const filteredEntries = Object.entries(grouped)
    .map(([cat, items]) => [
      cat,
      searchQuery
        ? items.filter(l =>
            l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : items,
    ] as [string, LauncherType[]])
    .filter(([, items]) => items.length > 0);

  const openTool = (launcher: LauncherType) => {
    if (launcher.target_type === 'external_url' || launcher.target_type === 'internal_html') {
      window.open(launcher.target_url, '_blank', 'noopener,noreferrer');
    } else {
      setActiveTool(launcher);
    }
  };

  const totalItems = launchers.length + adminItems.length;

  return (
    <div>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Übersicht
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {totalItems} verfügbare Einträge
        </p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '32px', flexWrap: 'wrap',
      }}>
        <div className="search-wrap" style={{ width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Durchsuchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px', borderRadius: '10px' }}
          />
        </div>
      </div>

      {error && (
        <div className="badge badge-danger" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEntries.map(([cat, items]) => {
            const color = hashColor(cat);
            const IconComp = getIconComponent(items[0]?.icon || 'folder');
            return (
              <div key={cat} className="animate-fade-in">
                <CategoryNode
                  label={cat}
                  color={color}
                  icon={<IconComp size={20} />}
                  count={items.length}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.map((item, i) => (
                      <div key={item.id} style={{ animation: `fadeIn 0.2s ease ${i * 0.04}s both` }}>
                        <ItemCard
                          title={item.title}
                          description={item.description}
                          icon={item.icon}
                          color={color}
                          onClick={() => openTool(item)}
                        />
                      </div>
                    ))}
                  </div>
                </CategoryNode>
              </div>
            );
          })}

          <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <CategoryNode
              label="Administration"
              color={palette[0]}
              icon={<Settings size={20} />}
              count={adminItems.length}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {adminItems.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.path} style={{ animation: `fadeIn 0.2s ease ${i * 0.04}s both` }}>
                      <button
                        onClick={() => navigate(item.path)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          width: '100%', padding: '12px 14px',
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: '10px', color: 'var(--text)',
                          cursor: 'pointer', fontFamily: 'var(--font)',
                          transition: 'all 0.15s', textAlign: 'left',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${palette[0]}08`;
                          e.currentTarget.style.borderColor = `${palette[0]}30`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '9px',
                          background: `${palette[0]}12`, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          color: palette[0],
                        }}>
                          <ItemIcon size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{item.label}</div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </CategoryNode>
          </div>
        </div>
      )}

      {activeTool && activeTool.target_type !== 'external_url' && activeTool.target_type !== 'internal_html' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 20px', background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
          }}>
            <button onClick={() => setActiveTool(null)} className="btn-ghost" style={{ padding: '4px' }}>
              <X size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeTool.title}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <button onClick={() => window.open(activeTool.target_url, '_blank')} className="btn-ghost" style={{ padding: '4px' }}>
                <ExternalLink size={16} />
              </button>
              <button onClick={() => {}} className="btn-ghost" style={{ padding: '4px' }}>
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          <iframe
            src={resolveUrl(activeTool.target_url)}
            style={{ flex: 1, border: 'none', width: '100%' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-storage-access"
            title={activeTool.title}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
