import React from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../../design-system/tierStyles';
import { useTierMetrics } from '../../hooks/useAnalytics';
import GlossyContent from '../ui/GlossyContent';

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
      background: themed ? 'var(--vd-surface-translucent, rgba(255,255,255,0.55))' : 'var(--vd-bg, #FAF7F2)',
      backdropFilter: 'blur(14px) saturate(1.1)',
      WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
      borderRight: '1px solid var(--vd-border-soft, rgba(28,24,20,0.08))',
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

      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--vd-text-muted, #9B9287)',
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
            className={`glossy-btn${isActive ? ' glossy-active' : ''}`}
            onClick={() => onNavigate(`detail-${t.id}`)}
            style={{ borderRadius: 10, fontSize: 13 }}
          >
            <GlossyContent
              compact
              justify="flex-start"
              icon={
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: style.grad,
                  boxShadow: t.id === 'diamante' ? '0 0 6px rgba(107,125,217,0.5)' : 'none',
                  flexShrink: 0,
                }} />
              }
              trailing={
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(45,45,45,0.6)', marginLeft: 'auto' }}>
                  {metrics ? metrics.resellerCount : 0}
                </span>
              }
            >
              {t.name}
            </GlossyContent>
          </div>
        );
      })}
    </div>
  );
};

export default Sidebar;
