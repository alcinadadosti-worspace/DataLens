import React from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../../design-system/tierStyles';
import { useTierMetrics } from '../../hooks/useAnalytics';

interface SidebarProps {
  active: string;
  onNavigate: (route: string) => void;
  activeTier: string | null;
}

const navItems = [
  { id: 'tiers',              label: 'Visão geral',       icon: 'ph-squares-four' },
  { id: 'distribuicao',       label: 'Distribuição',      icon: 'ph-chart-pie' },
  { id: 'dashboard',          label: 'Dashboard',         icon: 'ph-chart-line' },
  { id: 'comparacao-semanal', label: 'Comp. Semanal',     icon: 'ph-calendar-dots' },
  { id: 'table',              label: 'Pedidos',           icon: 'ph-table' },
  { id: 'supervisors',        label: 'Supervisores',      icon: 'ph-users' },
  { id: 'import',             label: 'Importar',          icon: 'ph-upload-simple' },
];

const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, activeTier }) => {
  const tierMetrics = useTierMetrics();
  const themed = !!activeTier;

  return (
    <div style={{
      position: 'fixed',
      top: 64, bottom: 0, left: 0, width: 240,
      background: themed ? 'rgba(255,255,255,0.55)' : '#FAF7F2',
      backdropFilter: themed ? 'blur(14px) saturate(1.1)' : 'none',
      WebkitBackdropFilter: themed ? 'blur(14px) saturate(1.1)' : 'none',
      borderRight: '1px solid rgba(28,24,20,0.08)',
      padding: '20px 12px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      transition: 'background 400ms ease',
    }}>
      {navItems.map(item => {
        const isActive = active === item.id;
        return (
          <div
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: isActive ? '#FFFFFF' : 'transparent',
              color: isActive ? '#1C1814' : '#3D362E',
              fontWeight: isActive ? 600 : 500, fontSize: 14,
              boxShadow: isActive ? '0 1px 2px rgba(28,24,20,0.05)' : 'none',
              border: isActive ? '1px solid #E8E2D6' : '1px solid transparent',
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <i className={`ph ${isActive ? 'ph-bold' : ''} ${item.icon}`} style={{ fontSize: 18 }} />
            {item.label}
          </div>
        );
      })}

      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#9B9287',
        padding: '20px 14px 8px',
      }}>
        Segmentações
      </div>

      {TIER_DEFINITIONS.map(t => {
        const style = TIER_STYLES[t.id];
        const isActive = active === `detail-${t.id}`;
        const metrics = tierMetrics.find(m => m.tierId === t.id);
        return (
          <div
            key={t.id}
            onClick={() => onNavigate(`detail-${t.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              background: isActive ? '#FFFFFF' : 'transparent',
              border: isActive ? '1px solid #E8E2D6' : '1px solid transparent',
              color: '#3D362E', fontSize: 13, fontWeight: isActive ? 600 : 500,
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: style.grad,
              boxShadow: t.id === 'diamante' ? '0 0 6px rgba(107,125,217,0.5)' : 'none',
            }} />
            <span style={{ flex: 1 }}>{t.name}</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, color: '#9B9287',
            }}>
              {metrics ? metrics.resellerCount : 0}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default Sidebar;
