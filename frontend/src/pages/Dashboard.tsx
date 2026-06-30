import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, resolveUrl } from '../utils/api';
import { getIconComponent } from '../utils/icons';
import { Search, Star, ExternalLink, LayoutGrid, X, Maximize2 } from 'lucide-react';
import type { UserType, SystemSettingsType } from '../App';

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
  user: UserType;
  settings: SystemSettingsType;
};

function Dashboard({ settings }: DashboardProps) {
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

  useEffect(() => {
    fetchLaunchers();
  }, []);

  const toggleFavorite = async (e: React.MouseEvent, launcher: LauncherType) => {
    e.stopPropagation();
    try {
      if (launcher.is_favorite) {
        await api.post(`/launchers/${launcher.id}/favorite`);
      } else {
        await api.post(`/launchers/${launcher.id}/favorite`);
      }
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {selectedCategory === 'All' ? 'Alle Dienste' : selectedCategory}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {filteredLaunchers.length} Kacheln
          </p>
        </div>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Kacheln durchsuchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', borderRadius: 'var(--radius-sm)' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => {}}
          style={{
            padding: '8px 16px', borderRadius: '20px', border: 'none',
            background: selectedCategory === 'All' ? 'var(--primary)' : 'var(--bg-elevated)',
            color: selectedCategory === 'All' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.82rem', cursor: 'pointer', fontWeight: selectedCategory === 'All' ? 600 : 400,
          }}
        >
          Alle
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {}}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none',
              background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-elevated)',
              color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.82rem', cursor: 'pointer', fontWeight: selectedCategory === cat ? 600 : 400,
            }}
          >
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {filteredLaunchers.map(launcher => {
            const IconComp = getIconComponent(launcher.icon);
            return (
              <div
                key={launcher.id}
                className="card"
                style={{ padding: '20px', cursor: 'pointer', position: 'relative' }}
                onClick={() => openTool(launcher)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: launcher.design_color ? `${launcher.design_color}20` : 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: launcher.design_color || 'var(--primary)',
                  }}>
                    <IconComp size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                      {launcher.title}
                    </div>
                    {launcher.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {launcher.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={e => toggleFavorite(e, launcher)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: launcher.is_favorite ? 'var(--primary)' : 'var(--text-muted)', padding: '4px', flexShrink: 0 }}
                  >
                    <Star size={14} fill={launcher.is_favorite ? 'var(--primary)' : 'none'} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {launcher.category}
                  </span>
                  {launcher.target_type === 'external_url' && (
                    <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                  )}
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
            <button onClick={() => setActiveTool(null)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px' }}>
              <X size={20} />
            </button>
            <span style={{ fontWeight: 600 }}>{activeTool.title}</span>
            <button
              onClick={() => window.open(activeTool.target_url, '_blank')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}
            >
              <ExternalLink size={16} />
            </button>
            <button
              onClick={() => setActiveTool(null)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}
            >
              <Maximize2 size={16} />
            </button>
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
