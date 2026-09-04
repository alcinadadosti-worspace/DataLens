import React from 'react';
import GlossyContent from '../ui/GlossyContent';

interface LojaSidebarProps {
  active: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { id: 'loja-overview',    label: 'Ranking geral',      icon: 'ph-trophy' },
  { id: 'loja-consultores', label: 'Consultores',        icon: 'ph-users' },
  { id: 'loja-canais',      label: 'Canais & Formas',    icon: 'ph-share-network' },
  { id: 'loja-categorias',  label: 'Categorias',         icon: 'ph-tag' },
  { id: 'loja-abc',         label: 'Curva ABC',          icon: 'ph-chart-bar' },
  { id: 'loja-pedidos',     label: 'Gestão de pedidos',  icon: 'ph-package' },
  { id: 'loja-periodo',     label: 'Período',            icon: 'ph-calendar-dots' },
  { id: 'loja-horario',     label: 'Venda por hora',     icon: 'ph-clock' },
  { id: 'loja-fidelidade-servicos', label: 'Fidelidade & serviços', icon: 'ph-heart' },
  { id: 'loja-import',      label: 'Importar',           icon: 'ph-upload-simple' },
];

const LojaSidebar: React.FC<LojaSidebarProps> = ({ active, onNavigate }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 64, bottom: 0, left: 0, width: 240,
      background: '#FAF7F2',
      borderRight: '1px solid rgba(28,24,20,0.08)',
      padding: '20px 12px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      {navItems.map(item => {
        const isActive = active === item.id;
        return (
          <div
            key={item.id}
            className={`glossy-btn${isActive ? ' glossy-active' : ''}`}
            onClick={() => onNavigate(item.id)}
            style={{ borderRadius: 10, fontSize: 14 }}
          >
            <GlossyContent
              justify="flex-start"
              icon={<i className={`ph ${isActive ? 'ph-bold' : ''} ${item.icon}`} style={{ fontSize: 18 }} />}
            >
              {item.label}
            </GlossyContent>
          </div>
        );
      })}
    </div>
  );
};

export default LojaSidebar;
