import React from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../../design-system/tierStyles';

interface TierBadgeProps {
  tier: string;
  size?: 'sm' | 'md';
}

const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'md' }) => {
  const style = TIER_STYLES[tier];
  const tierData = TIER_DEFINITIONS.find(t => t.id === tier);
  if (!style || !tierData) return null;

  const isDiamante = tier === 'diamante';
  const padding = size === 'sm' ? '3px 9px' : '5px 12px';
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding,
      borderRadius: 999,
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.01em',
      background: isDiamante ? style.grad : style.softGrad,
      backgroundSize: isDiamante ? '200% 200%' : '100% 100%',
      animation: isDiamante ? 'dia-bg 8s ease-in-out infinite' : 'none',
      color: style.badgeFg,
      position: 'relative',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: style.accent,
        boxShadow: isDiamante ? '0 0 6px rgba(107,125,217,0.6)' : 'none',
      }} />
      {tierData.name}
      {isDiamante && <span className="diamante-shimmer-overlay" />}
    </span>
  );
};

export default TierBadge;
