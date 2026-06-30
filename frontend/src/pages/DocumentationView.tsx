import { BookOpen, FileText, HelpCircle, ExternalLink } from 'lucide-react';

function DocumentationView() {
  const cards = [
    { title: 'Handbücher', desc: 'Bedienungsanleitungen und Dokumentation', icon: <BookOpen size={24} /> },
    { title: 'Wiki', desc: 'Interne Wissensdatenbank', icon: <FileText size={24} /> },
    { title: 'FAQ', desc: 'Häufig gestellte Fragen', icon: <HelpCircle size={24} /> },
    { title: 'Externe Links', desc: 'Nützliche Referenzen und Quellen', icon: <ExternalLink size={24} /> },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Dokumentation</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Dokumentationen und Wissensdatenbank</p>
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

export default DocumentationView;
