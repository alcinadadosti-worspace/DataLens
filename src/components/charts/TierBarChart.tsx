import React from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';

interface BarDatum {
  tierId: string;
  label: string;
  value: number;
  valueLabel: string;
  count?: string;
}

interface TierBarChartProps {
  data: BarDatum[];
  height?: number;
}

const TierBarChart: React.FC<TierBarChartProps> = ({ data, height = 220 }) => {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <svg
      viewBox={`0 0 ${data.length * 80} ${height + 56}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        {data.map((d) => {
          const s = TIER_STYLES[d.tierId] || TIER_STYLES.cf;
          return (
            <linearGradient key={d.tierId} id={`bar-${d.tierId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.accent} stopOpacity="0.95" />
              <stop offset="100%" stopColor={s.accent} stopOpacity="0.55" />
            </linearGradient>
          );
        })}
      </defs>
      <line x1="0" x2={data.length * 80} y1={height + 1} y2={height + 1} stroke="#E8E2D6" strokeWidth="1" />
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 24);
        const x = i * 80 + 16;
        const y = height - barH;
        const isDiamante = d.tierId === 'diamante';
        return (
          <g key={d.tierId + i}>
            <rect
              x={x} y={y} width={48} height={barH}
              fill={`url(#bar-${d.tierId})`} rx="6"
              style={isDiamante ? { filter: 'drop-shadow(0 0 6px rgba(107,125,217,0.6))' } : undefined}
            />
            <text x={x + 24} y={y - 6} textAnchor="middle"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#3D362E', fontWeight: 600 }}>
              {d.valueLabel}
            </text>
            <text x={x + 24} y={height + 18} textAnchor="middle"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, fill: '#6B6258', fontWeight: 500 }}>
              {d.label}
            </text>
            {d.count && (
              <text x={x + 24} y={height + 34} textAnchor="middle"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#9B9287' }}>
                {d.count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default TierBarChart;
