import React from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';

interface TrendSeries {
  tierId: string;
  label?: string;
  points: number[];
  color?: string;
}

interface TrendLineChartProps {
  series: TrendSeries[];
  labels?: string[];
  height?: number;
}

const TrendLineChart: React.FC<TrendLineChartProps> = ({ series, labels, height = 200 }) => {
  const defaultLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const xLabels = labels ?? defaultLabels;
  const W = 720;
  const H = height;
  const padL = 44, padR = 12, padT = 12, padB = 28;

  const allVals = series.flatMap(s => s.points).filter(v => v > 0);
  if (allVals.length === 0) return null;

  const max = Math.max(...allVals) * 1.1;
  const min = 0;
  const numPoints = Math.max(...series.map(s => s.points.length));
  const xStep = (W - padL - padR) / Math.max(numPoints - 1, 1);
  const yScale = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));

  function path(points: number[]) {
    return points.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${yScale(v)}`
    ).join(' ');
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (max - min) * t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#F2EEE6" strokeWidth="1" />
          <text x={padL - 8} y={yScale(v) + 3} textAnchor="end"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#9B9287' }}>
            {v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1000 ? Math.round(v / 1e3) + 'k' : Math.round(v)}
          </text>
        </g>
      ))}
      {xLabels.slice(0, numPoints).map((m, i) => (
        <text key={m + i} x={padL + i * xStep} y={H - 8} textAnchor="middle"
          style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, fill: '#6B6258' }}>
          {m}
        </text>
      ))}
      {series.map(s => {
        const style = TIER_STYLES[s.tierId];
        const color = s.color ?? (style ? style.accent : '#6B6258');
        const isDiamante = s.tierId === 'diamante';
        if (s.points.length === 0) return null;
        return (
          <g key={s.tierId + (s.label ?? '')}>
            <path
              d={path(s.points)}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={isDiamante ? { filter: 'drop-shadow(0 0 4px rgba(107,125,217,0.6))' } : undefined}
            />
            <circle
              cx={padL + (s.points.length - 1) * xStep}
              cy={yScale(s.points[s.points.length - 1])}
              r="4" fill={color} stroke="white" strokeWidth="2"
            />
          </g>
        );
      })}
    </svg>
  );
};

export default TrendLineChart;
