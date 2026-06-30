import { Wifi, Globe, Shield, Router } from 'lucide-react';

function NetworkView() {
  const cards = [
    { title: 'Netzwerkübersicht', desc: 'Topologie, Subnetze, VLANs', icon: <Globe size={24} /> },
    { title: 'Firewall', desc: 'Regeln, NAT, Zugriffslisten', icon: <Shield size={24} /> },
    { title: 'Router & Switche', desc: 'Konfiguration, Interfaces, Statistik', icon: <Router size={24} /> },
    { title: 'WLAN', desc: 'Access Points, SSIDs, Clients', icon: <Wifi size={24} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Netzwerk</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Netzwerkinfrastruktur und -dienste</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {cards.map(card => (
          <div key={card.title} className="card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--primary)', marginBottom: '14px' }}>{card.icon}</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>{card.title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NetworkView;
