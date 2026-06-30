import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, resolveUrl } from '../utils/api';
import { getIconComponent } from '../utils/icons';
import { Search, Star, ExternalLink, LayoutGrid, X, Maximize2 } from 'lucide-react';

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

type DashboardProps = {
  _dummy?: never;
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

function Dashboard(_props: DashboardProps) {
  const { category: routeCategory } = useParams();
  const [launchers, setLaunchers] = useState<LauncherType[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState<LauncherType | null>(null);

  const selectedCategory = routeCategory
    ? routeCategory.charAt(0).toUpperCase() + routeCategory.slice(1)
    : 'All';

  const fetchLaunchers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/launchers/') as LauncherType[];
      setLaunchers(data);
      const cats = Array.from(new Set(data.map(l => l.category)));
      setCategories(cats);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Portal-Kacheln.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLaunchers(); }, []);

  const toggleFavorite = async (e: React.MouseEvent, launcher: LauncherType) => {
    e.stopPropagation();
    try {
      await api.post(`/launchers/${launcher.id}/favorite`);
      setLaunchers(prev => prev.map(l =>
        l.id === launcher.id ? { ...l, is_favorite: !l.is_favorite } : l
      ));
    } catch (err) {
      console.error('Toggle favorite failed', err);
    }
  };

  const openTool = (launcher: LauncherType) => {
    if (launcher.target_type === 'external_url' || launcher.target_type === 'internal_html') {
      window.open(launcher.target_url, '_blank', 'noopener,noreferrer');
    } else {
      setActiveTool(launcher);
    }
  };

  const filteredLaunchers = launchers.filter(l => {
    if (selectedCategory !== 'All' && l.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.title.toLowerCase().includes(q) || (l.description && l.description.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {selectedCategory === 'All' ? 'Alle Dienste' : selectedCategory}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {filteredLaunchers.length} Kacheln
          </p>
        </div>
        <div className="search-wrap">
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      <div className="category-filters">
        <button className={`cat-btn ${selectedCategory === 'All' ? 'cat-btn-active' : ''}`}>
          Alle
        </button>
        {categories.map(cat => (
          <button key={cat} className={`cat-btn ${selectedCategory === cat ? 'cat-btn-active' : ''}`}>
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="badge badge-danger" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div className="spinner" />
        </div>
      ) : filteredLaunchers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <LayoutGrid size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p>Keine Kacheln gefunden.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '14px' }}>
          {filteredLaunchers.map((launcher, idx) => {
            const IconComp = getIconComponent(launcher.icon);
            const color = launcher.design_color || hashColor(launcher.category);
            return (
              <div
                key={launcher.id}
                className="card"
                onClick={() => openTool(launcher)}
                style={{
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  padding: '0',
                  animation: `fadeIn 0.25s ease ${idx * 0.03}s both`,
                }}
              >
                <div style={{
                  height: '3px',
                  background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  width: '100%',
                }} />
                <div style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: `${color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      color: color,
                    }}>
                      <IconComp size={19} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '3px' }}>
                        {launcher.title}
                      </div>
                      {launcher.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {launcher.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => toggleFavorite(e, launcher)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: launcher.is_favorite ? color : 'var(--text-muted)',
                        padding: '4px', flexShrink: 0, marginTop: '-2px',
                      }}
                    >
                      <Star size={13} fill={launcher.is_favorite ? color : 'none'} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 500, padding: '2px 8px',
                      borderRadius: '4px', background: `${color}12`, color: color,
                    }}>
                      {launcher.category}
                    </span>
                    {launcher.target_type === 'external_url' && (
                      <ExternalLink size={11} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTool && activeTool.target_type !== 'external_url' && activeTool.target_type !== 'internal_html' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setActiveTool(null)} className="btn-ghost" style={{ padding: '4px' }}>
              <X size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeTool.title}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <button onClick={() => window.open(activeTool.target_url, '_blank')} className="btn-ghost" style={{ padding: '4px' }}>
                <ExternalLink size={16} />
              </button>
              <button onClick={() => setActiveTool(null)} className="btn-ghost" style={{ padding: '4px' }}>
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
