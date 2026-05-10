import React, { useState } from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../design-system/tierStyles';
import { useFilteredOrders, useTierMetrics } from '../hooks/useAnalytics';
import { useFilterStore } from '../store/useFilterStore';
import { fmtBRLshort, fmtBRL } from '../utils/formatters';
import { isRevenueEligible } from '../analytics/financialMetrics';
import TierBadge from '../components/ui/TierBadge';

const TEXT_GRADS: Record<string, string> = {
  bronze:    'linear-gradient(90deg, #6B3815 0%, #C9824D 28%, #F4D3B0 48%, #C9824D 68%, #6B3815 100%)',
  prata:     'linear-gradient(90deg, #3A4249 0%, #8A929B 28%, #D8DDE3 48%, #8A929B 68%, #3A4249 100%)',
  ouro:      'linear-gradient(90deg, #5C3D00 0%, #C9A227 28%, #FFF0A0 48%, #C9A227 68%, #5C3D00 100%)',
  platina:   'linear-gradient(90deg, #1E3340 0%, #6B8A9E 28%, #C5D2DC 48%, #6B8A9E 68%, #1E3340 100%)',
  rubi:      'linear-gradient(90deg, #4A0A14 0%, #C32E47 28%, #FF8099 48%, #C32E47 68%, #4A0A14 100%)',
  esmeralda: 'linear-gradient(90deg, #082A1C 0%, #1F8A5B 28%, #7FD4A8 48%, #1F8A5B 68%, #082A1C 100%)',
  diamante:  'linear-gradient(90deg, #2A3580 0%, #6B7DD9 18%, #FCE4F0 36%, #DCEAFE 50%, #C4F4E5 64%, #6B7DD9 82%, #2A3580 100%)',
  cf:        'linear-gradient(90deg, #1C1814 0%, #6B6258 28%, #C8C0B0 48%, #6B6258 68%, #1C1814 100%)',
};

const DIAMANTE_COLORS = ['#FCE4F0', '#B8CEFF', '#C4F4E5', '#FFF1B5', '#E0B8FF', '#A8F0D8'];
const FLOAT_ANIMS = ['p-float-a', 'p-float-b', 'p-float-c', 'p-float-d'] as const;

function MetallicTierName({ name, tierId, tierStyle, isDiamante }: {
  name: string;
  tierId: string;
  tierStyle: typeof TIER_STYLES[string];
  isDiamante: boolean;
}) {
  const sparkles = [
    { x: '5%',  y: -14, size: 2.8, delay: 0,    dur: 2.1 },
    { x: '18%', y: -8,  size: 2,   delay: 0.7,  dur: 1.8 },
    { x: '35%', y: -16, size: 3.2, delay: 1.2,  dur: 2.4 },
    { x: '52%', y: -10, size: 2.5, delay: 0.4,  dur: 2.0 },
    { x: '70%', y: -13, size: 2.8, delay: 0.9,  dur: 1.9 },
    { x: '88%', y: -8,  size: 2,   delay: 1.5,  dur: 2.2 },
    { x: '12%', y: 48,  size: 2,   delay: 1.1,  dur: 2.3 },
    { x: '45%', y: 50,  size: 2.5, delay: 0.5,  dur: 1.7 },
    { x: '80%', y: 46,  size: 2,   delay: 1.8,  dur: 2.0 },
    ...(isDiamante ? [
      { x: '28%', y: -18, size: 3,   delay: 0.3,  dur: 2.6 },
      { x: '60%', y: -14, size: 2.5, delay: 1.4,  dur: 2.2 },
      { x: '92%', y: -10, size: 3,   delay: 0.6,  dur: 1.9 },
    ] : []),
  ];

  const glimmers = [
    { x: '22%', y: -20, size: 11, delay: 0.5, dur: 2.9 },
    { x: '72%', y: -16, size: 9,  delay: 1.6, dur: 3.2 },
    ...(isDiamante ? [
      { x: '8%',  y: -14, size: 13, delay: 0.2, dur: 2.5 },
      { x: '48%', y: -22, size: 15, delay: 1.0, dur: 2.8 },
      { x: '88%', y: -12, size: 11, delay: 2.1, dur: 3.0 },
    ] : []),
  ];

  const particles = [
    { x: '8%',  y: '35%', anim: 0, delay: 0,    dur: 2.3 },
    { x: '30%', y: '55%', anim: 1, delay: 0.9,  dur: 2.1 },
    { x: '55%', y: '30%', anim: 2, delay: 1.7,  dur: 2.6 },
    { x: '75%', y: '60%', anim: 3, delay: 0.5,  dur: 2.2 },
    { x: '92%', y: '40%', anim: 0, delay: 1.3,  dur: 2.0 },
    ...(isDiamante ? [
      { x: '20%', y: '65%', anim: 1, delay: 2.0, dur: 2.4 },
      { x: '43%', y: '45%', anim: 2, delay: 0.7, dur: 2.7 },
      { x: '65%', y: '70%', anim: 3, delay: 1.5, dur: 2.1 },
    ] : []),
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Metallic text with animated gleam */}
      <span
        className={`metallic-tier-name${isDiamante ? ' diamante' : ''}`}
        style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: tierStyle.fg,
          '--tier-accent': tierStyle.accent,
        } as React.CSSProperties}
      >
        {name}
      </span>

      {/* Sparkles — tiny glowing dots */}
      {sparkles.map((s, i) => {
        const color = isDiamante ? DIAMANTE_COLORS[i % DIAMANTE_COLORS.length] : tierStyle.accent;
        return (
          <span key={`sp-${i}`} style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 ${s.size * 2.5}px ${color}`,
            pointerEvents: 'none',
            animation: `tw ${s.dur}s ease-in-out infinite ${s.delay}s`,
          }} />
        );
      })}

      {/* Glimmers — 4-pointed star cross shapes */}
      {glimmers.map((g, i) => {
        const color = isDiamante ? DIAMANTE_COLORS[i % DIAMANTE_COLORS.length] : tierStyle.accent;
        return (
          <span key={`gl-${i}`} style={{
            position: 'absolute',
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            background: `radial-gradient(circle, white 0%, ${color} 45%, transparent 100%)`,
            clipPath: 'polygon(50% 0%,53% 47%,100% 50%,53% 53%,50% 100%,47% 53%,0% 50%,47% 47%)',
            pointerEvents: 'none',
            animation: `glimmer-flash ${g.dur}s ease-in-out infinite ${g.delay}s`,
          }} />
        );
      })}

      {/* Particles — float upward and dissolve */}
      {particles.map((p, i) => {
        const color = isDiamante ? DIAMANTE_COLORS[i % DIAMANTE_COLORS.length] : tierStyle.accent;
        return (
          <span key={`pt-${i}`} style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: isDiamante ? 3 : 2.5,
            height: isDiamante ? 3 : 2.5,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 4px ${color}`,
            pointerEvents: 'none',
            animation: `${FLOAT_ANIMS[p.anim]} ${p.dur}s ease-out infinite ${p.delay}s`,
          }} />
        );
      })}
    </div>
  );
}

interface DetailScreenProps {
  tierId: string;
  onBack: () => void;
  onNavigate: (route: string) => void;
}

const DetailScreen: React.FC<DetailScreenProps> = ({ tierId, onBack, onNavigate }) => {
  const allOrders = useFilteredOrders();
  const tierMetrics = useTierMetrics();
  const setSearch = useFilterStore(s => s.setSearch);
  const [hoveredReseller, setHoveredReseller] = useState<string | null>(null);
  const tierStyle = TIER_STYLES[tierId];
  const tierDef = TIER_DEFINITIONS.find(t => t.id === tierId);
  const metrics = tierMetrics.find(m => m.tierId === tierId);

  if (!tierStyle || !tierDef) return null;

  const tierOrders = allOrders.filter(o => o.tierId === tierId);
  const eligibleOrders = tierOrders.filter(isRevenueEligible);
  const totalRevenue = eligibleOrders.reduce((s, o) => s + o.ValorPraticado, 0);
  const avgTicket = eligibleOrders.length > 0 ? totalRevenue / eligibleOrders.length : 0;
  const isDiamante = tierId === 'diamante';

  // Top 10 resellers
  const resellerMap: Record<string, { name: string; tier: string; value: number; orders: number }> = {};
  for (const o of eligibleOrders) {
    if (!resellerMap[o.Pessoa]) resellerMap[o.Pessoa] = { name: o.NomePessoa, tier: o.tierId, value: 0, orders: 0 };
    resellerMap[o.Pessoa].value += o.ValorPraticado;
    resellerMap[o.Pessoa].orders++;
  }
  const topResellers = Object.entries(resellerMap)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10);

  // Orders by status
  const byStatus: Record<string, number> = {};
  for (const o of tierOrders) {
    byStatus[o.SituacaoComercial] = (byStatus[o.SituacaoComercial] ?? 0) + 1;
  }

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Back link */}
      <div
        onClick={onBack}
        style={{ fontSize: 13, color: '#6B6258', marginBottom: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <i className="ph ph-arrow-left" /> Voltar para visão geral
      </div>

      {/* Tier header card */}
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.15)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, ${tierStyle.glow}`,
        borderRadius: 20,
        padding: '24px 32px',
        position: 'relative', overflow: 'hidden', isolation: 'isolate',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
          background: tierStyle.metalGrad || tierStyle.grad,
          backgroundSize: isDiamante ? '300% 300%' : '100% 100%',
          animation: isDiamante ? 'amb-prism 12s ease-in-out infinite' : 'none',
          boxShadow: `2px 0 12px ${tierStyle.ringGlow}`,
        }} />
        {isDiamante && <div className="diamante-shimmer-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingLeft: 20, flexWrap: 'wrap' }}>
          <MetallicTierName name={tierDef.name} tierId={tierId} tierStyle={tierStyle} isDiamante={isDiamante} />
          <div style={{ fontSize: 13, color: '#6B6258' }}>
            {metrics?.resellerCount ?? 0} revendedores · {tierOrders.length} pedidos
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginTop: 16, paddingLeft: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>Receita total</div>
            <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fmtBRLshort(totalRevenue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>Ticket médio</div>
            <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fmtBRL(Math.round(avgTicket))}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>Pedidos ativos</div>
            <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: '#2E7D5B' }}>
              {eligibleOrders.length.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
        {Object.entries(byStatus).map(([status, count]) => {
          const color = status === 'Cancelado' ? '#B83A3A' : status === 'Entregue' ? '#2E7D5B' : '#6B6258';
          const bg = status === 'Cancelado' ? '#FBE5E9' : status === 'Entregue' ? '#E0F2E8' : '#F2EEE6';
          return (
            <div key={status} style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 4 }}>
                {status}
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
                {count.toLocaleString('pt-BR')}
              </div>
              <div style={{ display: 'inline-block', fontSize: 11, background: bg, color, padding: '2px 8px', borderRadius: 999, marginTop: 6 }}>
                {tierOrders.length > 0 ? ((count / tierOrders.length) * 100).toFixed(1).replace('.', ',') : '0,0'}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Top resellers table */}
      {topResellers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 12 }}>
            Top revendedores
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['#', 'Revendedor', 'Tier', 'Pedidos', 'Receita'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Receita' ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#6B6258', padding: '12px 14px',
                      background: '#F2EEE6', borderBottom: '1px solid #E8E2D6',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topResellers.map(([id, data], i) => {
                  const isHov = hoveredReseller === id;
                  return (
                    <tr
                      key={id}
                      style={{ cursor: 'pointer', background: isHov ? '#FAF7F2' : '' }}
                      onMouseEnter={() => setHoveredReseller(id)}
                      onMouseLeave={() => setHoveredReseller(null)}
                      onClick={() => {
                        setSearch(data.name);
                        onNavigate('table');
                      }}
                    >
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', color: '#9B9287', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontWeight: 600,
                            color: isHov ? tierStyle.accent : '#1C1814',
                            textDecoration: isHov ? 'underline' : 'none',
                            textDecorationColor: `${tierStyle.accent}66`,
                            transition: 'color 150ms',
                          }}>
                            {data.name}
                          </span>
                          <i className="ph ph-arrow-square-out" style={{
                            fontSize: 13,
                            color: tierStyle.accent,
                            opacity: isHov ? 1 : 0,
                            transform: isHov ? 'translateX(0)' : 'translateX(-4px)',
                            transition: 'opacity 150ms, transform 150ms',
                          }} />
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6' }}>
                        <TierBadge tier={data.tier} size="sm" />
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', color: '#6B6258', fontVariantNumeric: 'tabular-nums' }}>
                        {data.orders}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {fmtBRL(Math.round(data.value))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailScreen;
