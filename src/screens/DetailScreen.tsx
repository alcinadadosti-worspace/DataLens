import React from 'react';
import { TIER_STYLES, TIER_DEFINITIONS } from '../design-system/tierStyles';
import { useFilteredOrders, useTierMetrics } from '../hooks/useAnalytics';
import { fmtBRLshort, fmtBRL } from '../utils/formatters';
import { isRevenueEligible } from '../analytics/financialMetrics';
import TierBadge from '../components/ui/TierBadge';

interface DetailScreenProps {
  tierId: string;
  onBack: () => void;
}

const DetailScreen: React.FC<DetailScreenProps> = ({ tierId, onBack }) => {
  const allOrders = useFilteredOrders();
  const tierMetrics = useTierMetrics();
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
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em', color: tierStyle.fg }}>
            {tierDef.name}
          </div>
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
                {topResellers.map(([id, data], i) => (
                  <tr
                    key={id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', color: '#9B9287', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', fontWeight: 500 }}>{data.name}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailScreen;
