import React from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';
import { fmtBRLshort } from '../../utils/formatters';

interface DailyCycleChartProps {
  revenueByDayAndTier: Record<string, Record<string, number>>;
  tierIds?: string[];
  height?: number;
}

const DEFAULT_TIER_IDS = ['diamante', 'esmeralda', 'rubi', 'ouro', 'platina'];

const DailyCycleChart: React.FC<DailyCycleChartProps> = ({
  revenueByDayAndTier,
  tierIds = DEFAULT_TIER_IDS,
  height = 210,
}) => {
  const days = Object.keys(revenueByDayAndTier)
    .filter(d => d !== '?')
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (days.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287', fontSize: 13 }}>
        Sem dados de dia do ciclo
      </div>
    );
  }

  const activeTierIds = tierIds.filter(id =>
    days.some(d => (revenueByDayAndTier[d]?.[id] ?? 0) > 0)
  );

  const series = activeTierIds.map(tierId => ({
    tierId,
    points: days.map(d => revenueByDayAndTier[d]?.[tierId] ?? 0),
  }));

  const W = 600;
  const H = height;
  const padL = 52, padR = 12, padT = 12, padB = 28;
  const allVals = series.flatMap(s => s.points);
  const maxV = Math.max(...allVals, 1) * 1.1;
  const xStep = days.length > 1 ? (W - padL - padR) / (days.length - 1) : W - padL - padR;
  const yScale = (v: number) => padT + (H - padT - padB) * (1 - v / maxV);

  function path(points: number[]) {
    return points.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${(padL + i * xStep).toFixed(1)} ${yScale(v).toFixed(1)}`
    ).join(' ');
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => maxV * t);

  // Show at most 10 day labels to avoid crowding
  const step = Math.ceil(days.length / 10);
  const labeledDays = days.filter((_, i) => i % step === 0 || i === days.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#F2EEE6" strokeWidth="1" />
          <text x={padL - 8} y={yScale(v) + 3} textAnchor="end"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#9B9287' }}>
            {v >= 1000 ? fmtBRLshort(v).replace('R$ ', '') : Math.round(v)}
          </text>
        </g>
      ))}
      {labeledDays.map(d => {
        const i = days.indexOf(d);
        return (
          <text key={d} x={padL + i * xStep} y={H - 8} textAnchor="middle"
            style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, fill: '#6B6258' }}>
            {d}
          </text>
        );
      })}
      {series.map(s => {
        const style = TIER_STYLES[s.tierId];
        if (!style) return null;
        const isDiamante = s.tierId === 'diamante';
        return (
          <g key={s.tierId}>
            <path d={path(s.points)} fill="none" stroke={style.accent} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={isDiamante ? { filter: 'drop-shadow(0 0 3px rgba(107,125,217,0.55))' } : undefined} />
            <circle
              cx={padL + (days.length - 1) * xStep}
              cy={yScale(s.points[days.length - 1])}
              r="3.5" fill={style.accent} stroke="white" strokeWidth="2"
            />
          </g>
        );
      })}
    </svg>
  );
};

export default DailyCycleChart;
