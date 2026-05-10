import React, { useState } from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';
import { fmtBRLshort } from '../../utils/formatters';

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
  topResellersByTier?: Record<string, { name: string; value: number }[]>;
}

const TierBarChart: React.FC<TierBarChartProps> = ({ data, height = 220, topResellersByTier }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  const totalW = data.length * 80;

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && topResellersByTier && (() => {
        const d = data[hovered];
        const sellers = topResellersByTier[d.tierId] ?? [];
        const tStyle = TIER_STYLES[d.tierId] || TIER_STYLES.cf;
        const rawPct = (hovered * 80 + 40) / totalW * 100;
        const leftPct = Math.max(12, Math.min(88, rawPct));
        return (
          <div style={{
            position: 'absolute',
            top: 4,
            left: `${leftPct}%`,
            transform: 'translateX(-50%) translateY(-100%)',
            background: '#1C1814',
            color: '#FAF7F2',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            lineHeight: 1.75,
            boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
            border: `1px solid ${tStyle.accent}44`,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: tStyle.accent, marginBottom: 6,
            }}>
              Top investidores · {d.label}
            </div>
            {sellers.length === 0 ? (
              <div style={{ color: '#6B6258', fontSize: 11 }}>Sem dados</div>
            ) : sellers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#6B6258', width: 14 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{s.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A227', paddingLeft: 10 }}>
                  {fmtBRLshort(s.value)}
                </span>
              </div>
            ))}
            <div style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1C1814',
            }} />
          </div>
        );
      })()}

      <svg
        viewBox={`0 0 ${totalW} ${height + 56}`}
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
        <line x1="0" x2={totalW} y1={height + 1} y2={height + 1} stroke="#E8E2D6" strokeWidth="1" />
        {data.map((d, i) => {
          const barH = (d.value / max) * (height - 24);
          const x = i * 80 + 16;
          const y = height - barH;
          const isDiamante = d.tierId === 'diamante';
          const isHovered = hovered === i;
          const dimmed = hovered !== null && !isHovered;
          const tStyle = TIER_STYLES[d.tierId] || TIER_STYLES.cf;
          return (
            <g key={d.tierId + i}
              style={{ cursor: topResellersByTier ? 'pointer' : 'default' }}
              onMouseEnter={() => topResellersByTier && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={x} y={y} width={48} height={barH}
                fill={`url(#bar-${d.tierId})`} rx="6"
                opacity={dimmed ? 0.38 : 1}
                style={{
                  filter: isHovered
                    ? `drop-shadow(0 0 10px ${tStyle.accent}BB)`
                    : isDiamante ? 'drop-shadow(0 0 6px rgba(107,125,217,0.6))' : 'none',
                  transition: 'opacity 180ms, filter 180ms',
                }}
              />
              <text x={x + 24} y={y - 6} textAnchor="middle"
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  fill: '#3D362E', fontWeight: 600,
                  opacity: dimmed ? 0.3 : 1, transition: 'opacity 180ms',
                }}>
                {d.valueLabel}
              </text>
              <text x={x + 24} y={height + 18} textAnchor="middle"
                style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
                  fill: isHovered ? '#1C1814' : '#6B6258',
                  fontWeight: isHovered ? 600 : 500,
                  transition: 'fill 180ms',
                }}>
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
    </div>
  );
};

export default TierBarChart;
