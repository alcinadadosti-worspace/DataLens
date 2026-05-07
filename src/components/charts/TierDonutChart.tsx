import React from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';

interface DonutDatum {
  tierId: string;
  value: number;
  label: string;
  color?: string;
}

interface TierDonutChartProps {
  data: DonutDatum[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

const TierDonutChart: React.FC<TierDonutChartProps> = ({ data, size = 180, centerLabel, centerValue }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 12;
  const innerR = r - 28;
  let angle = -Math.PI / 2;

  function arcPath(start: number, end: number) {
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end), y3 = cy + innerR * Math.sin(end);
    const x4 = cx + innerR * Math.cos(start), y4 = cy + innerR * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  const arcs = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...d, start, end };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block' }}>
      {arcs.map((a, i) => {
        const style = TIER_STYLES[a.tierId];
        const isDiamante = a.tierId === 'diamante';
        const fill = style ? style.accent : (a.color ?? '#6B6258');
        return (
          <path key={a.tierId + i}
            d={arcPath(a.start, a.end)}
            fill={fill}
            style={isDiamante ? { filter: 'drop-shadow(0 0 5px rgba(107,125,217,0.7))' } : undefined}
          />
        );
      })}
      {centerLabel && (
        <text x={cx} y={cy - 4} textAnchor="middle"
          style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, fill: '#6B6258', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {centerLabel}
        </text>
      )}
      {centerValue && (
        <text x={cx} y={cy + 16} textAnchor="middle"
          style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 18, fill: '#1C1814', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {centerValue}
        </text>
      )}
    </svg>
  );
};

export default TierDonutChart;
