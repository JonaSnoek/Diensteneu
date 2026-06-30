import { Cloud, Box, Container, Layers } from 'lucide-react';

function VirtualizationView() {
  const cards = [
    { title: 'VMs', desc: 'Virtuelle Maschinen, Snapshots, Templates', icon: <Box size={24} /> },
    { title: 'Container', desc: 'Docker, LXC, Images, Volumes', icon: <Container size={24} /> },
    { title: 'Cluster', desc: 'Ressourcen-Pools, Hochverfügbarkeit', icon: <Layers size={24} /> },
    { title: 'Hypervisor', desc: 'ESXi, Proxmox, Xen-Konfiguration', icon: <Cloud size={24} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Virtualisierung</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Virtuelle Infrastruktur verwalten</p>
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

export default VirtualizationView;
