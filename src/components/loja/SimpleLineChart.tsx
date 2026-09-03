import React, { useState } from 'react';
import { fmtNumber } from '../../utils/formatters';

interface SimpleLineChartProps {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ points, height = 220, color = '#1C1814', formatValue }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  if (points.length === 0) return null;

  const W = 720;
  const H = height;
  const padL = 48, padR = 12, padT = 16, padB = 28;

  const vals = points.map(p => p.value);
  const max = Math.max(...vals) * 1.1 || 1;
  const min = 0;
  const xStep = (W - padL - padR) / Math.max(points.length - 1, 1);
  const yScale = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${yScale(p.value)}`).join(' ');
  const areaPath = `${path} L ${padL + (points.length - 1) * xStep} ${H - padB} L ${padL} ${H - padB} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (max - min) * t);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString('pt-BR'));

  const labelEvery = Math.ceil(points.length / 10);

  return (
    <div style={{ position: 'relative' }}>
      {hovered !== null && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${((padL + hovered * xStep) / W) * 100}%`,
          transform: 'translate(-50%, -100%)',
          background: '#1C1814', color: '#FAF7F2', borderRadius: 8,
          padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{ fontWeight: 600 }}>{points[hovered].label}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(points[hovered].value)}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="loja-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#F2EEE6" strokeWidth="1" />
            <text x={padL - 8} y={yScale(v) + 3} textAnchor="end"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#9B9287' }}>
              {fmtNumber(Math.round(v))}
            </text>
          </g>
        ))}

        {points.map((p, i) => (
          i % labelEvery === 0 && (
            <text key={i} x={padL + i * xStep} y={H - 8} textAnchor="middle"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 9, fill: '#6B6258' }}>
              {p.label}
            </text>
          )
        ))}

        <path d={areaPath} fill="url(#loja-area-grad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={padL + i * xStep} cy={yScale(p.value)}
            r={hovered === i ? 5 : 3}
            fill={hovered === i ? color : 'white'}
            stroke={color} strokeWidth="2"
            style={{ cursor: 'pointer', transition: 'r 150ms' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
    </div>
  );
};

export default SimpleLineChart;
