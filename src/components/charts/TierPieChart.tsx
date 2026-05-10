import React, { useState } from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';

interface PieDatum {
  tierId: string;
  value: number;
  label: string;
  color?: string;
}

interface TierPieChartProps {
  data: PieDatum[];
  size?: number;
  hoverReveal?: boolean;
}

const TierPieChart: React.FC<TierPieChartProps> = ({ data, size = 220, hoverReveal = false }) => {
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 8;
  let angle = -Math.PI / 2;

  function slicePath(start: number, end: number) {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const slices = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = (start + end) / 2;
    const pct = (d.value / total) * 100;
    return { ...d, start, end, mid, pct };
  });

  const showLabel = (s: typeof slices[0]) =>
    hoverReveal ? s.tierId === hoveredTier : s.pct >= 6;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block', overflow: 'visible' }}>
      <defs>
        {slices.map(s => {
          const style = TIER_STYLES[s.tierId];
          if (!style) return null;
          return (
            <radialGradient key={s.tierId} id={`pie-${s.tierId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={style.accent} stopOpacity="0.85" />
              <stop offset="100%" stopColor={style.accent} stopOpacity="1" />
            </radialGradient>
          );
        })}
      </defs>
      {slices.map(s => {
        const style = TIER_STYLES[s.tierId];
        const isDiamante = s.tierId === 'diamante';
        const isHovered = s.tierId === hoveredTier;
        const dimmed = hoveredTier !== null && !isHovered;
        const fill = style ? `url(#pie-${s.tierId})` : (s.color ?? '#6B6258');
        return (
          <path key={s.tierId + s.label}
            d={slicePath(s.start, s.end)}
            fill={fill}
            stroke="white"
            strokeWidth="2"
            opacity={dimmed ? 0.4 : 1}
            onMouseEnter={() => setHoveredTier(s.tierId)}
            onMouseLeave={() => setHoveredTier(null)}
            style={{
              cursor: 'pointer',
              filter: isHovered
                ? `drop-shadow(0 0 10px ${style?.accent ?? '#888'}AA) brightness(1.12)`
                : isDiamante ? 'drop-shadow(0 0 6px rgba(107,125,217,0.7))' : 'none',
              transition: 'opacity 180ms, filter 180ms',
            }}
          />
        );
      })}
      {slices.filter(showLabel).map(s => {
        const lr = r * 0.62;
        const x = cx + lr * Math.cos(s.mid);
        const y = cy + lr * Math.sin(s.mid);
        return (
          <text key={s.tierId + 'label' + s.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            style={{
              fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
              fill: 'white', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
            }}>
            {s.pct.toFixed(1).replace('.', ',')}%
          </text>
        );
      })}
    </svg>
  );
};

export default TierPieChart;
