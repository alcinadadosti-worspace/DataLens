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

const PREMIUM_TIERS = new Set(['rubi', 'esmeralda', 'diamante']);

function tooltipHeaderBg(tierId: string, accent: string): string {
  if (tierId === 'diamante') return 'linear-gradient(90deg, #FCE4F0, #DCEAFE 35%, #C4F4E5 60%, #FFF1B5)';
  if (tierId === 'esmeralda') return 'linear-gradient(90deg, #1F8A5B, #2DA07066, #0F5C3F44)';
  if (tierId === 'rubi') return 'linear-gradient(90deg, #C32E47, #DC456566, #8A142644)';
  return `linear-gradient(90deg, ${accent}, ${accent}88)`;
}

function tooltipBoxShadow(tierId: string, accent: string): string {
  if (tierId === 'diamante') return '0 8px 48px rgba(107,125,217,0.55), 0 0 0 1px rgba(107,125,217,0.3)';
  if (tierId === 'esmeralda') return '0 8px 40px rgba(31,138,91,0.45), 0 0 0 1px rgba(45,160,112,0.3)';
  if (tierId === 'rubi') return '0 8px 40px rgba(195,46,71,0.45), 0 0 0 1px rgba(220,69,101,0.3)';
  return `0 8px 32px rgba(28,24,20,0.4), 0 0 0 1px ${accent}33`;
}

function tooltipAccentColor(tierId: string, accent: string): string {
  if (tierId === 'diamante') return '#B0BFEF';
  return accent;
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
        const isPremium = PREMIUM_TIERS.has(d.tierId);
        const isDiamante = d.tierId === 'diamante';
        return (
          <div
            className="chart-tooltip-enter"
            style={{
              position: 'absolute',
              top: 4,
              left: `${leftPct}%`,
              transform: 'translateX(-50%) translateY(-100%)',
              background: isDiamante
                ? 'linear-gradient(160deg, #1E1828 0%, #1A1422 100%)'
                : 'linear-gradient(160deg, #252018 0%, #1C1814 100%)',
              color: '#FAF7F2',
              borderRadius: isPremium ? 14 : 12,
              overflow: 'hidden',
              boxShadow: tooltipBoxShadow(d.tierId, tStyle.accent),
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: 210,
            }}
          >
            {/* Header accent bar */}
            <div style={{
              height: isDiamante ? 4 : 3,
              background: tooltipHeaderBg(d.tierId, tStyle.accent),
              boxShadow: isDiamante ? '0 0 10px rgba(200,220,255,0.6)' : `0 0 6px ${tStyle.accent}66`,
            }} />

            <div style={{ padding: '10px 14px' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tooltipAccentColor(d.tierId, tStyle.accent),
                marginBottom: 8,
                ...(isDiamante && {
                  background: 'linear-gradient(90deg, #D0AAFF, #A8C8FF, #A8F0D8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }),
              }}>
                Top revendedores · {d.label}
              </div>

              {sellers.length === 0 ? (
                <div style={{ color: '#6B6258', fontSize: 11 }}>Sem dados</div>
              ) : sellers.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < sellers.length - 1 ? 5 : 0 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: isDiamante ? 'rgba(176,191,239,0.15)' : `${tStyle.accent}22`,
                    border: `1px solid ${isDiamante ? 'rgba(176,191,239,0.35)' : tStyle.accent + '44'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    color: tooltipAccentColor(d.tierId, tStyle.accent),
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{s.name}</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: '#C9A227',
                    background: 'rgba(201,162,39,0.1)',
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    {fmtBRLshort(s.value)}
                  </span>
                </div>
              ))}

              {onBarClick && (
                <div style={{
                  marginTop: 10, paddingTop: 8,
                  borderTop: `1px solid ${isDiamante ? 'rgba(176,191,239,0.15)' : 'rgba(255,255,255,0.07)'}`,
                  fontSize: 10, color: '#6B6258',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <i className="ph ph-arrow-square-out" style={{ fontSize: 11 }} />
                  Clique para ver o tier
                </div>
              )}
            </div>

            {/* Arrow */}
            <div style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: `7px solid ${isDiamante ? '#1A1422' : '#1C1814'}`,
            }} />
          </div>
        );
      })()}

      <svg
        viewBox={`0 0 ${totalW} ${height + 56}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
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
                  <stop offset="60%" stopColor={s.accent} stopOpacity="0.92" />
                  <stop offset="100%" stopColor={s.accent} stopOpacity="0.72" />
                </linearGradient>
                <filter id={`glow-${d.tierId}`} x="-60%" y="-30%" width="220%" height="160%">
                  <feGaussianBlur stdDeviation={d.tierId === 'diamante' ? 6 : 4} result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </React.Fragment>
            );
          })}
          {/* Diamante prismatic gradient for halo */}
          <linearGradient id="diamante-prism-halo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCE4F0" />
            <stop offset="33%" stopColor="#DCEAFE" />
            <stop offset="66%" stopColor="#E1F4FA" />
            <stop offset="100%" stopColor="#F0E4FC" />
          </linearGradient>
          <linearGradient id="shine-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          {/* Clip path para o sweep do Diamante — recalculado por render */}
          {hovered !== null && data[hovered]?.tierId === 'diamante' && (() => {
            const di = hovered;
            const bH = Math.max((data[di].value / max) * (height - 24), 2);
            const bX = di * 80 + 16;
            const bY = height - bH;
            return (
              <clipPath id="clip-diamante-sweep">
                <rect x={bX} y={bY} width={48} height={bH} rx={6} />
              </clipPath>
            );
          })()}
        </defs>

        <line x1="0" x2={totalW} y1={height + 1} y2={height + 1} stroke="#E8E2D6" strokeWidth="1" />

        {data.map((d, i) => {
          const barH = Math.max((d.value / max) * (height - 24), 2);
          const x = i * 80 + 16;
          const y = height - barH;
          const isDiamante = d.tierId === 'diamante';
          const isEsmeralda = d.tierId === 'esmeralda';
          const isRubi = d.tierId === 'rubi';
          const isHovered = hovered === i;
          const dimmed = hovered !== null && !isHovered;
          const tStyle = TIER_STYLES[d.tierId] || TIER_STYLES.cf;
          const liftY = isDiamante ? -8 : (isEsmeralda || isRubi) ? -6 : -5;

          return (
            <g key={d.tierId + i}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onBarClick?.(d.tierId)}
            >
              {/* ---- SPECIAL HOVER HALOS ---- */}
              {isHovered && isDiamante && (
                <>
                  {/* === RADIANT AURA — 4 camadas === */}
                  {/* Camada 1 – aura exterior muito difusa, prismática, animada */}
                  <rect x={x - 52} y={y - 32} width={152} height={barH + 64} rx={32}
                    fill="url(#diamante-prism-halo)" opacity={0.18}
                    style={{ filter: 'blur(38px)', animation: 'diamante-aura 3.5s ease-in-out infinite, prism-bar 4s ease-in-out infinite' }} />
                  {/* Camada 2 – aura média */}
                  <rect x={x - 28} y={y - 16} width={104} height={barH + 32} rx={22}
                    fill="url(#diamante-prism-halo)" opacity={0.24}
                    style={{ filter: 'blur(22px)', animation: 'diamante-aura-mid 3.5s ease-in-out infinite 0.8s, prism-bar 4s ease-in-out infinite 1s' }} />
                  {/* Camada 3 – halo interno */}
                  <rect x={x - 12} y={y - 6} width={72} height={barH + 12} rx={14}
                    fill="#C8D8FF" opacity={0.3}
                    style={{ filter: 'blur(10px)', animation: 'diamante-aura 2.5s ease-in-out infinite 0.4s' }} />
                  {/* Camada 4 – borda brilhante imediata */}
                  <rect x={x - 4} y={y - 2} width={56} height={barH + 4} rx={9}
                    fill="white" opacity={0.14}
                    style={{ filter: 'blur(4px)' }} />
                </>
              )}
              {isHovered && isEsmeralda && (
                <>
                  <rect x={x - 14} y={y - 6} width={76} height={barH + 12} rx={14}
                    fill="#1F8A5B" opacity={0.18}
                    style={{ filter: 'blur(16px)' }} />
                  <rect x={x - 5} y={y - 2} width={58} height={barH + 4} rx={9}
                    fill="#2DA070" opacity={0.28}
                    style={{ filter: 'blur(5px)' }} />
                </>
              )}
              {isHovered && isRubi && (
                <>
                  <rect x={x - 14} y={y - 6} width={76} height={barH + 12} rx={14}
                    fill="#C32E47" opacity={0.2}
                    style={{ filter: 'blur(16px)' }} />
                  <rect x={x - 5} y={y - 2} width={58} height={barH + 4} rx={9}
                    fill="#DC4565" opacity={0.3}
                    style={{ filter: 'blur(5px)' }} />
                </>
              )}
              {/* Default halo for other tiers */}
              {isHovered && !isDiamante && !isEsmeralda && !isRubi && (
                <rect x={x - 6} y={y - 2} width={60} height={barH + 2} rx={10}
                  fill={tStyle.accent} opacity={0.18}
                  style={{ filter: 'blur(6px)' }} />
              )}

              {/* ---- BAR (with lift) ---- */}
              <g style={{
                transform: isHovered ? `translateY(${liftY}px)` : 'translateY(0px)',
                transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}>
                <rect
                  x={x} y={y} width={48} height={barH}
                  fill={isHovered ? `url(#bar-hover-${d.tierId})` : `url(#bar-${d.tierId})`}
                  rx="6"
                  opacity={dimmed ? 0.3 : 1}
                  style={{
                    filter: isHovered
                      ? isDiamante ? 'url(#glow-diamante)'
                      : `url(#glow-${d.tierId})`
                      : isDiamante ? 'drop-shadow(0 0 6px rgba(107,125,217,0.6))' : 'none',
                    transition: 'opacity 200ms',
                    ...(isHovered && isDiamante && { animation: 'prism-bar 3s ease-in-out infinite' }),
                  }}
                />
                {/* === CAMADAS PRISMÁTICAS — barra reluzente === */}
                {isHovered && isDiamante && (
                  <>
                    {/* Rosa — cicla primeiro */}
                    <rect x={x} y={y} width={48} height={barH} rx={6}
                      fill="#FCE4F0" opacity={0}
                      clipPath="url(#clip-diamante-sweep)"
                      style={{ animation: 'prism-layer-a 2.7s ease-in-out infinite 0s', pointerEvents: 'none' }} />
                    {/* Azul — defasado */}
                    <rect x={x} y={y} width={48} height={barH} rx={6}
                      fill="#AABFFF" opacity={0}
                      clipPath="url(#clip-diamante-sweep)"
                      style={{ animation: 'prism-layer-b 2.7s ease-in-out infinite 0.9s', pointerEvents: 'none' }} />
                    {/* Menta — terceiro */}
                    <rect x={x} y={y} width={48} height={barH} rx={6}
                      fill="#C4F4E5" opacity={0}
                      clipPath="url(#clip-diamante-sweep)"
                      style={{ animation: 'prism-layer-c 2.7s ease-in-out infinite 1.8s', pointerEvents: 'none' }} />
                  </>
                )}

                {/* Shine sweep — topo */}
                {isHovered && (
                  <rect x={x} y={y} width={48} height={barH * 0.45} rx={6}
                    fill="url(#shine-grad)" opacity={isDiamante ? 0.4 : isEsmeralda || isRubi ? 0.28 : 0.22}
                    style={{ pointerEvents: 'none' }} />
                )}
                {/* Diamante — raio de luz varrendo a barra */}
                {isHovered && isDiamante && (
                  <rect
                    x={x - 18} y={y} width={18} height={barH}
                    fill="white"
                    clipPath="url(#clip-diamante-sweep)"
                    style={{
                      animation: 'diamante-sweep 2s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {/* Segundo raio — defasado */}
                {isHovered && isDiamante && (
                  <rect
                    x={x - 18} y={y} width={10} height={barH}
                    fill="white"
                    clipPath="url(#clip-diamante-sweep)"
                    style={{
                      animation: 'diamante-sweep 2s ease-in-out infinite 1s',
                      pointerEvents: 'none',
                      opacity: 0.5,
                    }}
                  />
                )}
                {/* Esmeralda gem shimmer overlay */}
                {isHovered && isEsmeralda && (
                  <rect x={x} y={y} width={48} height={barH} rx={6}
                    fill="white" opacity={0}
                    style={{ animation: 'gem-pulse 1.6s ease-in-out infinite', pointerEvents: 'none' }} />
                )}
                {/* Rubi pulse overlay */}
                {isHovered && isRubi && (
                  <rect x={x} y={y} width={48} height={barH} rx={6}
                    fill="white" opacity={0}
                    style={{ animation: 'gem-pulse 1.3s ease-in-out infinite 0.3s', pointerEvents: 'none' }} />
                )}
                {/* Diamante sparkles */}
                {isHovered && isDiamante && [
                  [x - 11, y - 5, 1.8, '0s'],
                  [x + 57, y + barH * 0.2, 1.5, '0.5s'],
                  [x + 24, y - 13, 2.2, '0.9s'],
                  [x - 3, y + barH * 0.55, 1.4, '0.25s'],
                  [x + 51, y + barH * 0.7, 1.6, '0.7s'],
                  [x + 10, y - 8, 1.2, '1.1s'],
                ].map(([cx, cy, r, delay], si) => (
                  <circle key={si} cx={cx as number} cy={cy as number} r={r as number}
                    fill="white"
                    style={{
                      animation: `tw 2s ease-in-out infinite ${delay}`,
                      filter: 'drop-shadow(0 0 3px rgba(200,220,255,0.95))',
                    }} />
                ))}

                <text x={x + 24} y={y - 7} textAnchor="middle"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: isHovered ? 11 : 10,
                    fill: isHovered ? tStyle.accent : '#3D362E',
                    fontWeight: 700,
                    opacity: dimmed ? 0.2 : 1,
                    transition: 'opacity 200ms',
                  }}>
                  {d.valueLabel}
                </text>
              </g>

              {/* Bottom labels */}
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
                <rect x={x} y={height + 2} width={48} height={2} rx={1}
                  fill={tStyle.accent} opacity={0.7} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TierBarChart;
