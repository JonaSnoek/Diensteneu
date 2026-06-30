import { Activity, BarChart3, Bell, LineChart } from 'lucide-react';

function MonitoringView() {
  const cards = [
    { title: 'Dashboard', desc: 'Live-Status, Last, Verfügbarkeit', icon: <Activity size={24} /> },
    { title: 'Metriken', desc: 'CPU, RAM, Netzwerk, Disk über Zeit', icon: <LineChart size={24} /> },
    { title: 'Alarme', desc: 'Benachrichtigungen, Schwellwerte, Eskalation', icon: <Bell size={24} /> },
    { title: 'Berichte', desc: 'Auslastungsreports, Trends, SLA', icon: <BarChart3 size={24} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Monitoring</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Systemüberwachung und Metriken</p>
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

export default MonitoringView;
