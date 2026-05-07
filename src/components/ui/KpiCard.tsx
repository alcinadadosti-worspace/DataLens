import React from 'react';

interface KpiCardProps {
  eyebrow: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  meta?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ eyebrow, value, delta, deltaDirection, meta }) => {
  const deltaColor = deltaDirection === 'down' ? '#B83A3A' : '#2E7D5B';
  const arrow = deltaDirection === 'down' ? '↓' : '↑';

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E8E2D6',
      borderRadius: 14,
      padding: 18,
      boxShadow: '0 2px 6px rgba(28,24,20,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#6B6258',
      }}>
        {eyebrow}
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {delta && (
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: deltaColor,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {arrow} {delta}
          {meta && <span style={{ color: '#6B6258', fontWeight: 400 }}>{meta}</span>}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
