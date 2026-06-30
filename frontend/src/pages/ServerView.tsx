import { Server, HardDrive, Terminal, Cpu } from 'lucide-react';

function ServerView() {
  const cards = [
    { title: 'Server-Übersicht', desc: 'Alle physischen und virtuellen Server', icon: <Server size={24} /> },
    { title: 'Storage', desc: 'Festplatten, RAID, Partitionen', icon: <HardDrive size={24} /> },
    { title: 'SSH-Zugang', desc: 'Terminal, Verbindungen, Schlüssel', icon: <Terminal size={24} /> },
    { title: 'Auslastung', desc: 'CPU, RAM, IO, Netzwerk', icon: <Cpu size={24} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Server</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Serververwaltung und -überwachung</p>
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

export default ServerView;
