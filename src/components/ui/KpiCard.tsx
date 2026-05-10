import React, { useState } from 'react';

interface KpiCardProps {
  eyebrow: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  meta?: string;
  tooltip?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ eyebrow, value, delta, deltaDirection, meta, tooltip }) => {
  const [hovered, setHovered] = useState(false);
  const deltaColor = deltaDirection === 'down' ? '#B83A3A' : '#2E7D5B';
  const arrow = deltaDirection === 'down' ? '↓' : '↑';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: '1px solid #E8E2D6',
        borderRadius: 14,
        padding: 18,
        boxShadow: hovered && tooltip ? '0 4px 14px rgba(28,24,20,0.1)' : '0 2px 6px rgba(28,24,20,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        transition: 'box-shadow 200ms',
      }}
    >
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
      {tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: 0,
          background: '#1C1814',
          color: '#FAF7F2',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 12,
          lineHeight: 1.75,
          boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 180ms, transform 180ms',
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #1C1814',
          }} />
        </div>
      )}
    </div>
  );
};

export default KpiCard;
