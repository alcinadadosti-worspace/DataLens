import React, { useState } from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../design-system/tierStyles';

interface TierStatCardProps {
  tier: string;
  count: number;
  value: string;
  growth?: number;
  onClick?: () => void;
  selected?: boolean;
}

const TierStatCard: React.FC<TierStatCardProps> = ({ tier, count, value, growth, onClick, selected }) => {
  const style = TIER_STYLES[tier];
  const tierData = TIER_DEFINITIONS.find(t => t.id === tier);
  if (!style || !tierData) return null;

  const isDiamante = tier === 'diamante';
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'white',
        border: selected ? `2px solid ${style.accent}` : '1px solid #E8E2D6',
        borderRadius: 14,
        padding: 18,
        boxShadow: hover || selected ? style.glow : '0 2px 6px rgba(28,24,20,0.05)',
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* top gradient bar */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, top: 0, height: 4,
        background: style.grad,
        backgroundSize: isDiamante ? '200% 200%' : '100% 100%',
        animation: isDiamante ? 'dia-bg 8s ease-in-out infinite' : 'none',
      }} />

      {isDiamante && (
        <>
          <div className="diamante-shimmer-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <span className="sparkle s1" />
          <span className="sparkle s2" />
          <span className="sparkle s3" />
        </>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
        marginTop: 4,
      }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: '#1C1814',
        }}>
          {tierData.name}
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: '#6B6258',
          padding: '3px 8px',
          borderRadius: 999,
          background: '#F2EEE6',
        }}>
          {count} revendedores
        </div>
      </div>

      <div style={{
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>

      {growth !== undefined && (
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: growth >= 0 ? '#2E7D5B' : '#B83A3A',
          marginTop: 4,
        }}>
          {growth >= 0 ? '↑' : '↓'} {Math.abs(growth).toFixed(1).replace('.', ',')}% vs período ant.
        </div>
      )}
    </div>
  );
};

export default TierStatCard;
