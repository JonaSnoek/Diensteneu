import React, { useState, useEffect } from 'react';
import { api, resolveUrl } from '../utils/api';
import { getIconComponent } from '../utils/icons';
import { Search, Star, ExternalLink, ShieldAlert, LogOut, Settings, LayoutGrid, Heart, X, Maximize2 } from 'lucide-react';
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
  onNavigate: (page: 'setup' | 'login' | 'dashboard' | 'admin') => void;
  onLogout: () => void;
};

function Dashboard({ user, settings, onNavigate, onLogout }: DashboardProps) {
  const [launchers, setLaunchers] = useState<LauncherType[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All'); // 'All' | 'Favorites' | category_name
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Tool Iframe Overlay
  const [activeTool, setActiveTool] = useState<LauncherType | null>(null);

  const fetchLaunchers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/launchers/') as LauncherType[];
      setLaunchers(data);
      
      // Extract unique categories
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
    e.stopPropagation(); // Avoid opening the launcher
    if (user.role === 'Guest') {
      alert('Gäste können keine Favoriten speichern. Bitte loggen Sie sich ein.');
      return;
    }

    try {
      const endpoint = launcher.is_favorite 
        ? `/launchers/${launcher.id}/unfavorite` 
        : `/launchers/${launcher.id}/favorite`;
      await api.post(endpoint);
      
      // Update local state
      setLaunchers(launchers.map(l => {
        if (l.id === launcher.id) {
          return { ...l, is_favorite: !l.is_favorite };
        }
        return l;
      }));
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleTileClick = (launcher: LauncherType) => {
    // Resolve target path
    const url = launcher.target_url.startsWith('http') 
      ? launcher.target_url 
      : api.getUri(launcher.target_url);

    if (launcher.target_type === 'external_url' || launcher.target_type === 'internal_html') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setActiveTool(launcher);
    }
  };

  // Filter launchers based on selection and query
  const filteredLaunchers = launchers.filter(l => {
    // 1. Category Filter
    if (selectedCategory === 'Favorites') {
      if (!l.is_favorite) return false;
    } else if (selectedCategory !== 'All') {
      if (l.category !== selectedCategory) return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(query);
      const matchDesc = l.description?.toLowerCase().includes(query) || false;
      const matchCat = l.category.toLowerCase().includes(query);
      return matchTitle || matchDesc || matchCat;
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw' }}>
      {/* Background blobs */}
      <div className="bg-glow primary"></div>
      <div className="bg-glow accent"></div>

      {/* Dynamic Header */}
      <header className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 40px',
        margin: '20px 40px 10px 40px',
        borderRadius: 'var(--border-radius-sm)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {settings.logo_url ? (
            <img src={resolveUrl(settings.logo_url)} alt="Logo" style={{ height: '35px' }} />
          ) : (
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
              boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
            }}>
              P
            </div>
          )}
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {settings.portal_name}
          </span>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Nach Diensten suchen..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '42px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.03)' }}
          />
        </div>

        {/* User profile dropdown & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user.authenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.display_name}</div>
                <div className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '2px 6px', marginTop: '2px' }}>
                  {user.role}
                </div>
              </div>
              
              {/* Settings / Adminpanel link */}
              {(user.role === 'Root' || user.role === 'Admin') && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => onNavigate('admin')}
                  style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px' }}
                  title="Admin-Bereich"
                >
                  <Settings size={18} />
                </button>
              )}

              <button 
                className="btn btn-danger" 
                onClick={onLogout}
                style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px' }}
                title="Abmelden"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Gastmodus</span>
              <button className="btn btn-primary" onClick={() => onNavigate('login')} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Anmelden
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', flex: 1, padding: '10px 40px 40px 40px', gap: '24px' }}>
        
        {/* Sidebar categories filter */}
        <aside className="glass-panel" style={{
          width: '260px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderRadius: 'var(--border-radius-sm)',
          height: 'fit-content'
        }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Navigation
          </h3>

          <button 
            className={`btn ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            onClick={() => setSelectedCategory('All')}
          >
            <LayoutGrid size={16} /> All Services
          </button>

          {user.authenticated && user.role !== 'Guest' && (
            <button 
              className={`btn ${selectedCategory === 'Favorites' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              onClick={() => setSelectedCategory('Favorites')}
            >
              <Heart size={16} /> Favoriten
            </button>
          )}

          {categories.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '20px', marginBottom: '12px' }}>
                Kategorien
              </h3>
              {categories.map(cat => (
                <button 
                  key={cat}
                  className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </>
          )}
        </aside>

        {/* Launchers Grid Area */}
        <main style={{ flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(0, 200, 255, 0.1)',
                borderTopColor: 'var(--primary-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
              }} />
              <p style={{ color: 'var(--text-secondary)' }}>Kacheln werden geladen...</p>
            </div>
          ) : error ? (
            <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <ShieldAlert size={40} color="#ef4444" style={{ marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-primary)' }}>{error}</p>
              <button className="btn btn-secondary" onClick={fetchLaunchers} style={{ marginTop: '16px' }}>
                Erneut versuchen
              </button>
            </div>
          ) : filteredLaunchers.length === 0 ? (
            <div className="glass-panel" style={{ padding: '80px 40px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
              <LayoutGrid size={45} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>Keine Tools gefunden</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Es wurden keine Kacheln für die gewählte Kategorie oder Suchanfrage freigegeben.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {filteredLaunchers.map(launcher => {
                const IconComponent = getIconComponent(launcher.icon);
                return (
                  <div 
                    key={launcher.id}
                    className="glass-panel animate-fade-in"
                    onClick={() => handleTileClick(launcher)}
                    style={{
                      padding: '24px',
                      borderRadius: 'var(--border-radius-md)',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '180px',
                      justifyContent: 'space-between',
                      borderLeft: launcher.design_color ? `4px solid ${launcher.design_color}` : '1px solid var(--border-color)',
                      transform: 'translateY(0)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = launcher.design_color 
                        ? `0 10px 25px rgba(0, 0, 0, 0.4), 0 0 10px ${launcher.design_color}33` 
                        : '0 10px 25px rgba(0, 0, 0, 0.4)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                  >
                    {/* Top line with Icon and Favorite Star */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: launcher.design_color ? `${launcher.design_color}18` : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${launcher.design_color ? `${launcher.design_color}44` : 'var(--border-color)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: launcher.design_color || 'var(--primary-color)'
                      }}>
                        <IconComponent size={22} />
                      </div>
                      
                      {user.authenticated && user.role !== 'Guest' && (
                        <button 
                          onClick={(e) => toggleFavorite(e, launcher)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: launcher.is_favorite ? '#eab308' : 'var(--text-muted)',
                            transition: 'color 0.2s, transform 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <Star size={18} fill={launcher.is_favorite ? '#eab308' : 'none'} />
                        </button>
                      )}
                    </div>

                    {/* Middle details info */}
                    <div style={{ flex: 1, marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>
                        {launcher.title}
                      </h4>
                      <p style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        margin: 0
                      }}>
                        {launcher.description || 'Keine Beschreibung vorhanden.'}
                      </p>
                    </div>

                    {/* Bottom action indicator */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                      paddingTop: '10px',
                      marginTop: '10px'
                    }}>
                      <span>{launcher.category}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {launcher.target_type === 'external_url' ? 'Externer Link' : 'App'}
                        <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* FULL SCREEN IFRAME MODULE VIEWER OVERLAY */}
      {activeTool && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'black',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Iframe Control Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            background: '#0d0f1a',
            borderBottom: '1px solid #1c2035',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: activeTool.design_color ? `${activeTool.design_color}18` : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeTool.design_color || 'var(--primary-color)',
                fontSize: '0.85rem'
              }}>
                {React.createElement(getIconComponent(activeTool.icon), { size: 16 })}
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{activeTool.title}</span>
              <span className="badge badge-primary" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                Sandbox-Modus
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Open in new tab helper */}
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  const url = activeTool.target_url.startsWith('http') 
                    ? activeTool.target_url 
                    : api.getUri(activeTool.target_url);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                title="In neuem Tab öffnen"
              >
                <Maximize2 size={14} /> Extern öffnen
              </button>

              {/* Close Button */}
              <button 
                onClick={() => setActiveTool(null)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ef4444',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Sandboxed Iframe Container */}
          <iframe 
            src={activeTool.target_url.startsWith('http') ? activeTool.target_url : api.getUri(activeTool.target_url)}
            title={activeTool.title}
            sandbox="allow-scripts allow-downloads allow-forms allow-same-origin allow-popups allow-modals allow-top-navigation-by-user-activation allow-storage-access"
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff'
            }}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
