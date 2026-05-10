import React, { useRef, useState } from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../../design-system/tierStyles';
import { fmtBRLshort } from '../../utils/formatters';

interface TopReseller {
  name: string;
  tierId: string;
  value: number;
}

interface DailyCycleChartProps {
  revenueByDayAndTier: Record<string, Record<string, number>>;
  topResellersByDay?: Record<string, TopReseller[]>;
  tierIds?: string[];
  height?: number;
}

const DEFAULT_TIER_IDS = ['diamante', 'esmeralda', 'rubi', 'ouro', 'platina'];

const DailyCycleChart: React.FC<DailyCycleChartProps> = ({
  revenueByDayAndTier,
  topResellersByDay,
  tierIds = DEFAULT_TIER_IDS,
  height = 210,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
    return points
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(padL + i * xStep).toFixed(1)} ${yScale(v).toFixed(1)}`)
      .join(' ');
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => maxV * t);
  const step = Math.ceil(days.length / 10);
  const labeledDays = days.filter((_, i) => i % step === 0 || i === days.length - 1);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const viewX = (e.clientX - rect.left) * scaleX - padL;
    const idx = Math.round(viewX / xStep);
    setHoveredIdx(Math.max(0, Math.min(days.length - 1, idx)));
  }

  const hoveredDay = hoveredIdx !== null ? days[hoveredIdx] : null;
  const hoveredX = hoveredIdx !== null ? padL + hoveredIdx * xStep : null;

  // Tooltip position: left side if in right half, right side if in left half
  const tooltipLeftPct = hoveredIdx !== null
    ? Math.max(5, Math.min(95, (hoveredIdx / (days.length - 1)) * 100))
    : 50;

  return (
    <div style={{ position: 'relative' }}>
      {/* Hover tooltip */}
      {hoveredDay !== null && hoveredIdx !== null && (
        <div
          className="chart-tooltip-enter"
          style={{
            position: 'absolute',
            top: 4,
            left: `${tooltipLeftPct}%`,
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'linear-gradient(160deg, #252018 0%, #1C1814 100%)',
            color: '#FAF7F2',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(28,24,20,0.4), 0 0 0 1px rgba(255,255,255,0.07)',
            pointerEvents: 'none',
            zIndex: 20,
            minWidth: 210,
          }}
        >
          {/* Top accent */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #C9A227, #E8C54788)' }} />
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C9A227', marginBottom: 8 }}>
              Dia {hoveredDay} do ciclo
            </div>

            {/* Revenue per tier */}
            {activeTierIds.map(tierId => {
              const val = revenueByDayAndTier[hoveredDay]?.[tierId] ?? 0;
              if (val === 0) return null;
              const tStyle = TIER_STYLES[tierId] || TIER_STYLES.cf;
              const tierDef = TIER_DEFINITIONS.find(t => t.id === tierId);
              return (
                <div key={tierId} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: tStyle.accent, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: '#D8D0C0' }}>{tierDef?.name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#FAF7F2' }}>
                    {fmtBRLshort(val)}
                  </span>
                </div>
              );
            })}

            {/* Top resellers */}
            {topResellersByDay && topResellersByDay[hoveredDay]?.length > 0 && (
              <>
                <div style={{ margin: '8px 0 6px', height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 5 }}>
                  Maiores compradores
                </div>
                {topResellersByDay[hoveredDay].map((s, i) => {
                  const tStyle = TIER_STYLES[s.tierId] || TIER_STYLES.cf;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: i < 2 ? 4 : 0 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: `${tStyle.accent}22`, border: `1px solid ${tStyle.accent}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: tStyle.accent, fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 11 }}>{s.name}</span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A227',
                        background: 'rgba(201,162,39,0.08)', padding: '1px 6px', borderRadius: 4,
                      }}>
                        {fmtBRLshort(s.value)}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: '7px solid #1C1814',
          }} />
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#F2EEE6" strokeWidth="1" />
            <text x={padL - 8} y={yScale(v) + 3} textAnchor="end"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#9B9287' }}>
              {v >= 1000 ? fmtBRLshort(v).replace('R$ ', '') : Math.round(v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {labeledDays.map(d => {
          const i = days.indexOf(d);
          const isHov = hoveredDay === d;
          return (
            <text key={d} x={padL + i * xStep} y={H - 8} textAnchor="middle"
              style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, fill: isHov ? '#1C1814' : '#6B6258', fontWeight: isHov ? 700 : 400 }}>
              {d}
            </text>
          );
        })}

        {/* Vertical crosshair */}
        {hoveredX !== null && (
          <line
            x1={hoveredX} x2={hoveredX}
            y1={padT} y2={H - padB}
            stroke="#D8D0C0" strokeWidth="1" strokeDasharray="4 3"
          />
        )}

        {/* Series lines */}
        {series.map(s => {
          const style = TIER_STYLES[s.tierId];
          if (!style) return null;
          const isDiamante = s.tierId === 'diamante';
          return (
            <g key={s.tierId}>
              <path d={path(s.points)} fill="none" stroke={style.accent} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={isDiamante ? { filter: 'drop-shadow(0 0 3px rgba(107,125,217,0.55))' } : undefined} />
              {/* Dot at end of line */}
              <circle
                cx={padL + (days.length - 1) * xStep}
                cy={yScale(s.points[days.length - 1])}
                r="3.5" fill={style.accent} stroke="white" strokeWidth="2"
              />
              {/* Hover dot */}
              {hoveredIdx !== null && (
                <circle
                  cx={padL + hoveredIdx * xStep}
                  cy={yScale(s.points[hoveredIdx])}
                  r="4.5" fill={style.accent} stroke="white" strokeWidth="2"
                  style={{ filter: `drop-shadow(0 0 4px ${style.accent}99)` }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default DailyCycleChart;
