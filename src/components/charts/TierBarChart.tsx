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
  onBarClick?: (tierId: string) => void;
}

const TierBarChart: React.FC<TierBarChartProps> = ({ data, height = 220, topResellersByTier, onBarClick }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);
  const totalW = data.length * 80;

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip */}
      {hovered !== null && topResellersByTier && (() => {
        const d = data[hovered];
        const sellers = topResellersByTier[d.tierId] ?? [];
        const tStyle = TIER_STYLES[d.tierId] || TIER_STYLES.cf;
        const rawPct = (hovered * 80 + 40) / totalW * 100;
        const leftPct = Math.max(12, Math.min(88, rawPct));
        return (
          <div
            className="chart-tooltip-enter"
            style={{
              position: 'absolute',
              top: 4,
              left: `${leftPct}%`,
              transform: 'translateX(-50%) translateY(-100%)',
              background: 'linear-gradient(160deg, #252018 0%, #1C1814 100%)',
              color: '#FAF7F2',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: `0 8px 32px rgba(28,24,20,0.4), 0 0 0 1px ${tStyle.accent}33`,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: 200,
            }}
          >
            {/* Color accent bar at top */}
            <div style={{
              height: 3,
              background: `linear-gradient(90deg, ${tStyle.accent}, ${tStyle.accent}88)`,
              boxShadow: `0 0 8px ${tStyle.accent}88`,
            }} />
            <div style={{ padding: '10px 14px' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: tStyle.accent, marginBottom: 8,
              }}>
                Top investidores · {d.label}
              </div>
              {sellers.length === 0 ? (
                <div style={{ color: '#6B6258', fontSize: 11 }}>Sem dados</div>
              ) : sellers.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < sellers.length - 1 ? 4 : 0 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: `${tStyle.accent}22`,
                    border: `1px solid ${tStyle.accent}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: tStyle.accent, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{s.name}</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: '#C9A227',
                    background: 'rgba(201,162,39,0.08)',
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    {fmtBRLshort(s.value)}
                  </span>
                </div>
              ))}
              {onBarClick && (
                <div style={{
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 10, color: '#6B6258', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <i className="ph ph-arrow-square-out" style={{ fontSize: 11 }} />
                  Clique para ver o tier
                </div>
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
              <React.Fragment key={d.tierId}>
                <linearGradient id={`bar-${d.tierId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.accent} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={s.accent} stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id={`bar-hover-${d.tierId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.accent} stopOpacity="1" />
                  <stop offset="60%" stopColor={s.accent} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={s.accent} stopOpacity="0.7" />
                </linearGradient>
                <filter id={`glow-${d.tierId}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </React.Fragment>
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
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onBarClick && onBarClick(d.tierId)}
            >
              {/* Glow halo behind bar — only when hovered */}
              {isHovered && (
                <rect
                  x={x - 6} y={y - 2} width={60} height={barH + 2}
                  rx="10"
                  fill={tStyle.accent}
                  opacity={0.18}
                  style={{ filter: `blur(6px)` }}
                />
              )}

              {/* Bar — in its own g for lift transform */}
              <g style={{
                transform: isHovered ? 'translateY(-5px)' : 'translateY(0px)',
                transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}>
                <rect
                  x={x} y={y} width={48} height={barH}
                  fill={isHovered ? `url(#bar-hover-${d.tierId})` : `url(#bar-${d.tierId})`}
                  rx="6"
                  opacity={dimmed ? 0.32 : 1}
                  style={{
                    filter: isHovered
                      ? `url(#glow-${d.tierId})`
                      : isDiamante ? 'drop-shadow(0 0 6px rgba(107,125,217,0.6))' : 'none',
                    transition: 'opacity 200ms',
                  }}
                />
                {/* Shine sweep on hovered bar */}
                {isHovered && (
                  <rect
                    x={x} y={y} width={48} height={barH * 0.4}
                    rx="6"
                    fill="url(#shine)"
                    opacity={0.25}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                <text x={x + 24} y={y - 7} textAnchor="middle"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: isHovered ? 11 : 10,
                    fill: isHovered ? tStyle.accent : '#3D362E',
                    fontWeight: 700,
                    opacity: dimmed ? 0.25 : 1,
                    transition: 'opacity 200ms, font-size 200ms',
                  }}>
                  {d.valueLabel}
                </text>
              </g>

              {/* Bottom labels — not affected by lift */}
              <text x={x + 24} y={height + 18} textAnchor="middle"
                style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
                  fill: isHovered ? '#1C1814' : '#6B6258',
                  fontWeight: isHovered ? 700 : 500,
                  transition: 'fill 200ms',
                }}>
                {d.label}
              </text>
              {d.count && (
                <text x={x + 24} y={height + 34} textAnchor="middle"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                    fill: isHovered ? tStyle.accent : '#9B9287',
                    transition: 'fill 200ms',
                  }}>
                  {d.count}
                </text>
              )}

              {/* Underline highlight */}
              {isHovered && (
                <rect
                  x={x} y={height + 2} width={48} height={2}
                  rx="1"
                  fill={tStyle.accent}
                  opacity={0.7}
                />
              )}
            </g>
          );
        })}

        {/* Shared shine gradient */}
        <defs>
          <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default TierBarChart;
