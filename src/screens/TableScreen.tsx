import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import Button from '../components/ui/Button';
import TierBadge from '../components/ui/TierBadge';
import FilterBuilder from '../components/filters/FilterBuilder';
import { useFilteredOrders } from '../hooks/useAnalytics';
import { useExport } from '../hooks/useExport';
import { fmtBRL, fmtBRLshort, fmtNumber } from '../utils/formatters';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { TIER_STYLES, TIER_DEFINITIONS } from '../design-system/tierStyles';
import { Order } from '../types/order';

const columnHelper = createColumnHelper<Order>();

interface TableScreenProps {
  selectedReseller?: { id: string; name: string } | null;
  onClearReseller?: () => void;
}

// ─── Reseller performance panel ──────────────────────────────────────────────

function ResellerPanel({ orders, reseller, tierAccent, onClear }: {
  orders: Order[];
  reseller: { id: string; name: string };
  tierAccent: string;
  onClear: () => void;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const eligible = orders.filter(isRevenueEligible);
  const cancelled = orders.filter(o => !isRevenueEligible(o));
  const totalRevenue = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
  const avgTicket = eligible.length > 0 ? totalRevenue / eligible.length : 0;

  // Revenue by day of cycle
  const revenueByDay: Record<string, number> = {};
  for (const o of eligible) {
    const d = o.DiaDoCiclo || '?';
    if (d !== '?') revenueByDay[d] = (revenueByDay[d] ?? 0) + o.ValorPraticado;
  }
  const days = Object.keys(revenueByDay).sort((a, b) => parseInt(a) - parseInt(b));
  const maxDay = Math.max(...Object.values(revenueByDay), 1);

  // Tier of reseller
  const tierId = orders[0]?.tierId ?? 'cf';
  const tierDef = TIER_DEFINITIONS.find(t => t.id === tierId);

  const kpis = [
    { label: 'Receita total', value: fmtBRLshort(totalRevenue), sub: fmtBRL(totalRevenue), color: tierAccent },
    { label: 'Finalizados', value: eligible.length.toLocaleString('pt-BR'), sub: `${orders.length > 0 ? ((eligible.length / orders.length) * 100).toFixed(0) : 0}% dos pedidos`, color: '#2E7D5B' },
    { label: 'Cancelados', value: cancelled.length.toLocaleString('pt-BR'), sub: `${orders.length > 0 ? ((cancelled.length / orders.length) * 100).toFixed(0) : 0}% dos pedidos`, color: cancelled.length > 0 ? '#B83A3A' : '#9B9287' },
    { label: 'Ticket médio', value: fmtBRLshort(avgTicket), sub: fmtBRL(avgTicket), color: '#6B6258' },
  ];

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${tierAccent}44`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 14,
      boxShadow: `0 2px 12px ${tierAccent}18`,
    }}>
      {/* Top accent bar */}
      <div style={{ height: 3, background: tierAccent }} />

      {/* Header */}
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F2EEE6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${tierAccent}18`, border: `1px solid ${tierAccent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ph ph-user" style={{ fontSize: 16, color: tierAccent }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1814', letterSpacing: '-0.01em' }}>
              {reseller.name}
            </div>
            <div style={{ fontSize: 11, color: '#9B9287', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: tierAccent, flexShrink: 0 }} />
              {tierDef?.name ?? tierId} · {orders.length} pedidos no período filtrado
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            border: '1px solid #E8E2D6', background: '#FAF7F2',
            fontSize: 12, color: '#6B6258', cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <i className="ph ph-x" style={{ fontSize: 12 }} />
          Limpar seleção
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{
            padding: '14px 18px',
            borderRight: i < kpis.length - 1 ? '1px solid #F2EEE6' : 'none',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2, fontFamily: i === 0 || i === 3 ? 'JetBrains Mono, monospace' : undefined }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {days.length > 1 && (
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #F2EEE6' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 10 }}>
            Receita por dia do ciclo
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72, position: 'relative' }}>
            {days.map(d => {
              const v = revenueByDay[d] ?? 0;
              const h = Math.max((v / maxDay) * 52, 3);
              const isHov = hoveredDay === d;
              return (
                <div
                  key={d}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', cursor: 'default' }}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Tooltip */}
                  {isHov && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1C1814',
                      color: '#FAF7F2',
                      borderRadius: 8,
                      padding: '6px 10px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 20,
                      fontSize: 11,
                      boxShadow: '0 4px 16px rgba(28,24,20,0.3)',
                    }}>
                      <div style={{ fontSize: 9, color: '#9B9287', marginBottom: 2, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Dia {d}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tierAccent }}>
                        {fmtBRL(v)}
                      </div>
                      {/* Arrow */}
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #1C1814',
                      }} />
                    </div>
                  )}
                  <div style={{
                    width: '100%', height: h,
                    background: tierAccent,
                    borderRadius: '3px 3px 0 0',
                    opacity: isHov ? 1 : 0.7,
                    minHeight: 3,
                    transform: isHov ? 'scaleY(1.04)' : 'scaleY(1)',
                    transformOrigin: 'bottom',
                    transition: 'opacity 120ms, transform 120ms',
                    boxShadow: isHov ? `0 0 8px ${tierAccent}88` : 'none',
                  }} />
                  {days.length <= 31 && (
                    <div style={{ fontSize: 11, color: isHov ? tierAccent : '#9B9287', lineHeight: 1, fontWeight: isHov ? 700 : 400, transition: 'color 120ms' }}>{d}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Orders analytics panel ──────────────────────────────────────────────────

function OrdersAnalyticsPanel({ orders }: { orders: Order[] }) {
  const [collapsed, setCollapsed] = useState(false);

  const metrics = useMemo(() => {
    const eligible = orders.filter(isRevenueEligible);
    const cancelled = orders.filter(o => !isRevenueEligible(o));
    const grossRevenue = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
    const activeResellers = new Set(eligible.map(o => o.Pessoa).filter(Boolean)).size;
    const rpa = activeResellers > 0 ? grossRevenue / activeResellers : 0;
    const avgTicket = eligible.length > 0 ? grossRevenue / eligible.length : 0;
    const cancellationRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

    // Revenue by tier
    const revenueByTier: Record<string, number> = {};
    const ordersByTier: Record<string, number> = {};
    for (const o of eligible) {
      const t = o.tierId || 'cf';
      revenueByTier[t] = (revenueByTier[t] ?? 0) + o.ValorPraticado;
      ordersByTier[t] = (ordersByTier[t] ?? 0) + 1;
    }

    // Revenue by modelo comercial
    const revenueByModelo: Record<string, number> = {};
    for (const o of eligible) {
      const m = o.ModeloComercial || 'Não informado';
      revenueByModelo[m] = (revenueByModelo[m] ?? 0) + o.ValorPraticado;
    }

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    for (const o of eligible) {
      const d = o.DiaDoCiclo || '?';
      if (d !== '?') revenueByDay[d] = (revenueByDay[d] ?? 0) + o.ValorPraticado;
    }

    // Revenue by supervisor (top 5)
    const revenueBySup: Record<string, number> = {};
    for (const o of eligible) {
      const s = o.ResponsavelEstrutura || 'Sem supervisor';
      revenueBySup[s] = (revenueBySup[s] ?? 0) + o.ValorPraticado;
    }

    return {
      grossRevenue, activeResellers, rpa, avgTicket,
      finalizados: eligible.length, cancelados: cancelled.length,
      cancellationRate, revenueByTier, ordersByTier,
      revenueByModelo, revenueByDay, revenueBySup,
      total: orders.length,
    };
  }, [orders]);

  if (orders.length === 0) return null;

  const tierEntries = TIER_DEFINITIONS
    .filter(t => (metrics.revenueByTier[t.id] ?? 0) > 0)
    .map(t => ({ id: t.id, name: t.name, value: metrics.revenueByTier[t.id] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const maxTierValue = tierEntries[0]?.value ?? 1;

  const modeloEntries = Object.entries(metrics.revenueByModelo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxModeloValue = modeloEntries[0]?.[1] ?? 1;

  const supEntries = Object.entries(metrics.revenueBySup)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxSupValue = supEntries[0]?.[1] ?? 1;

  const dayEntries = Object.entries(metrics.revenueByDay)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const maxDayValue = Math.max(...dayEntries.map(([, v]) => v), 1);

  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const finalizadosPct = metrics.total > 0 ? (metrics.finalizados / metrics.total) * 100 : 0;
  const canceladosPct = metrics.total > 0 ? (metrics.cancelados / metrics.total) * 100 : 0;

  const modeloColors: Record<string, string> = {
    'Online': '#6B7DD9', 'OMNIChannel': '#2DA070', 'Presencial': '#C9A227',
  };

  return (
    <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid #F2EEE6',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph ph-chart-bar" style={{ fontSize: 16, color: '#C9A227' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1814' }}>Resumo financeiro</span>
          <span style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtNumber(metrics.total)} pedidos
          </span>
        </div>
        <i className={`ph ph-caret-${collapsed ? 'down' : 'up'}`} style={{ fontSize: 14, color: '#9B9287' }} />
      </div>

      {!collapsed && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: '1px solid #F2EEE6' }}>
            {[
              { label: 'Faturamento', value: fmtBRLshort(metrics.grossRevenue), sub: fmtBRL(metrics.grossRevenue), color: '#1C1814' },
              { label: 'Finalizados', value: fmtNumber(metrics.finalizados), sub: `${finalizadosPct.toFixed(1).replace('.', ',')}% do total`, color: '#2E7D5B' },
              { label: 'Cancelados', value: fmtNumber(metrics.cancelados), sub: `${canceladosPct.toFixed(1).replace('.', ',')}% do total`, color: metrics.cancelados > 0 ? '#B83A3A' : '#9B9287' },
              { label: 'Taxa Cancelamento', value: `${metrics.cancellationRate.toFixed(1).replace('.', ',')}%`, sub: metrics.cancellationRate > 10 ? 'Acima do limite' : 'Dentro do esperado', color: metrics.cancellationRate > 10 ? '#B83A3A' : '#2E7D5B' },
              { label: 'Ticket Médio', value: fmtBRLshort(metrics.avgTicket), sub: fmtBRL(metrics.avgTicket), color: '#1C1814' },
              { label: 'RPA', value: fmtBRLshort(metrics.rpa), sub: `${fmtNumber(metrics.activeResellers)} rev. ativos`, color: '#1C1814' },
            ].map((k, i) => (
              <div key={k.label} style={{ padding: '14px 16px', borderRight: i < 5 ? '1px solid #F2EEE6' : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 4 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 10, color: '#9B9287', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F2EEE6' }}>

            {/* Receita por segmentação */}
            <div style={{ padding: '14px 18px', borderRight: '1px solid #F2EEE6' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 12 }}>
                Receita por Segmentação
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tierEntries.map(t => {
                  const pct = (t.value / maxTierValue) * 100;
                  const style = TIER_STYLES[t.id];
                  return (
                    <div key={t.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: 500, color: '#1C1814' }}>{t.name}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6258' }}>{fmtBRLshort(t.value)}</span>
                      </div>
                      <div style={{ height: 5, background: '#F2EEE6', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: style?.accent ?? '#C9A227', borderRadius: 3, transition: 'width 400ms' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div style={{ padding: '14px 18px', borderRight: '1px solid #F2EEE6' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 12 }}>
                Status dos pedidos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Mini donut */}
                <svg viewBox="0 0 80 80" style={{ width: 80, height: 80, flexShrink: 0 }}>
                  {(() => {
                    const total = metrics.finalizados + metrics.cancelados;
                    if (total === 0) return null;
                    const r = 32, inner = 20, cx = 40, cy = 40;
                    const segments = [
                      { value: metrics.finalizados, color: '#2DA070' },
                      { value: metrics.cancelados, color: '#DC4565' },
                    ].filter(s => s.value > 0);
                    let angle = -Math.PI / 2;
                    return segments.map((seg, i) => {
                      const sweep = (seg.value / total) * Math.PI * 2;
                      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
                      const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
                      const ix1 = cx + inner * Math.cos(angle + sweep), iy1 = cy + inner * Math.sin(angle + sweep);
                      const ix2 = cx + inner * Math.cos(angle), iy2 = cy + inner * Math.sin(angle);
                      const large = sweep > Math.PI ? 1 : 0;
                      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2} Z`;
                      angle += sweep;
                      return <path key={i} d={d} fill={seg.color} />;
                    });
                  })()}
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {[
                    { label: 'Finalizados', value: metrics.finalizados, pct: finalizadosPct, color: '#2DA070' },
                    { label: 'Cancelados', value: metrics.cancelados, pct: canceladosPct, color: '#DC4565' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                          <span style={{ color: '#1C1814', fontWeight: 500 }}>{s.label}</span>
                        </div>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6258' }}>
                          {fmtNumber(s.value)}
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#F2EEE6', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 2, transition: 'width 400ms' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modelo comercial + Top supervisores */}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 12 }}>
                Modelo Comercial
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {modeloEntries.map(([modelo, value]) => {
                  const pct = (value / maxModeloValue) * 100;
                  const color = modeloColors[modelo] ?? '#6B6258';
                  return (
                    <div key={modelo}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: 500, color: '#1C1814' }}>{modelo}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6258' }}>{fmtBRLshort(value)}</span>
                      </div>
                      <div style={{ height: 5, background: '#F2EEE6', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 400ms' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {supEntries.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 8 }}>
                    Top Supervisores
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {supEntries.map(([name, value], i) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: i === 0 ? 'linear-gradient(135deg,#E8C547,#C9A227)' : '#F2EEE6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: i === 0 ? 'white' : '#6B6258',
                        }}>{i + 1}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1C1814' }}>{name}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6258', flexShrink: 0 }}>{fmtBRLshort(value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Daily revenue chart */}
          {dayEntries.length > 1 && (
            <div style={{ padding: '14px 18px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 10 }}>
                Faturamento por dia do ciclo
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, position: 'relative' }}>
                {dayEntries.map(([d, v]) => {
                  const h = Math.max((v / maxDayValue) * 68, 3);
                  const isHov = hoveredDay === d;
                  return (
                    <div
                      key={d}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', cursor: 'default' }}
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {isHov && (
                        <div style={{
                          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#1C1814', color: '#FAF7F2',
                          borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap',
                          pointerEvents: 'none', zIndex: 20, fontSize: 11,
                          boxShadow: '0 4px 16px rgba(28,24,20,0.3)',
                        }}>
                          <div style={{ fontSize: 9, color: '#9B9287', marginBottom: 2, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dia {d}</div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#C9A227' }}>{fmtBRL(v)}</div>
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1C1814' }} />
                        </div>
                      )}
                      <div style={{
                        width: '100%', height: h, minHeight: 3,
                        background: isHov ? '#C9A227' : '#E8C547',
                        borderRadius: '3px 3px 0 0',
                        opacity: isHov ? 1 : 0.75,
                        transition: 'background 120ms, opacity 120ms',
                        boxShadow: isHov ? '0 0 6px rgba(201,162,39,0.6)' : 'none',
                      }} />
                      {dayEntries.length <= 31 && (
                        <div style={{ fontSize: 9, color: isHov ? '#C9A227' : '#9B9287', lineHeight: 1, fontWeight: isHov ? 700 : 400, transition: 'color 120ms' }}>{d}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main table screen ────────────────────────────────────────────────────────

const TableScreen: React.FC<TableScreenProps> = ({ selectedReseller, onClearReseller }) => {
  const globalOrders = useFilteredOrders();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Local reseller filter — applied on top of global filters, doesn't touch the store
  const orders = useMemo(() => {
    if (!selectedReseller) return globalOrders;
    return globalOrders.filter(o => o.Pessoa === selectedReseller.id);
  }, [globalOrders, selectedReseller]);

  const { exportCSV, exportXLSX } = useExport(orders);

  // Tier accent color for the panel
  const resellerTierAccent = useMemo(() => {
    if (!selectedReseller) return '#C9A227';
    const tierId = orders[0]?.tierId ?? 'ouro';
    return TIER_STYLES[tierId]?.accent ?? '#C9A227';
  }, [selectedReseller, orders]);

  const columns = useMemo(() => [
    columnHelper.accessor('CodigoPedido', {
      header: 'Pedido',
      cell: info => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('NomePessoa', {
      header: 'Revendedor',
      cell: info => <span style={{ fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('tierId', {
      header: 'Tier',
      cell: info => <TierBadge tier={info.getValue()} size="sm" />,
    }),
    columnHelper.accessor('CicloMarketing', {
      header: 'Ciclo',
      cell: info => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('ResponsavelEstrutura', {
      header: 'Supervisor',
      cell: info => <span style={{ color: '#3D362E', fontSize: 13 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('CidadeEntregaRetirada', {
      header: 'Cidade',
      cell: info => <span style={{ color: '#3D362E', fontSize: 13 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('UFEntregaRetirada', {
      header: 'UF',
      cell: info => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258' }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('ValorPraticado', {
      header: 'Valor Praticado',
      cell: info => (
        <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', display: 'block' }}>
          {fmtBRL(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('SituacaoComercial', {
      header: 'Situação',
      cell: info => {
        const v = info.getValue();
        const color = v === 'Cancelado' ? '#B83A3A' : v === 'Entregue' ? '#2E7D5B' : '#6B6258';
        return (
          <span style={{
            fontSize: 12, fontWeight: 500, color,
            background: v === 'Cancelado' ? '#FBE5E9' : v === 'Entregue' ? '#E0F2E8' : '#F2EEE6',
            padding: '2px 8px', borderRadius: 999,
          }}>
            {v}
          </span>
        );
      },
    }),
    columnHelper.accessor('ModeloComercial', {
      header: 'Modelo',
      cell: info => <span style={{ fontSize: 12, color: '#6B6258' }}>{info.getValue()}</span>,
    }),
  ], []);

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalPages = table.getPageCount();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Tabela completa
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Pedidos
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary" size="sm"
            icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />}
            onClick={exportCSV}
          >
            Exportar CSV
          </Button>
          <Button
            variant="secondary" size="sm"
            icon={<i className="ph ph-file-xls" style={{ fontSize: 14 }} />}
            onClick={exportXLSX}
          >
            Exportar XLSX
          </Button>
        </div>
      </div>

      {/* Reseller performance panel */}
      {selectedReseller && onClearReseller && (
        <ResellerPanel
          orders={orders}
          reseller={selectedReseller}
          tierAccent={resellerTierAccent}
          onClear={onClearReseller}
        />
      )}

      {/* Filter builder — only shown when no reseller is locked in */}
      {!selectedReseller && (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 10 }}>
            Filtros
          </div>
          <FilterBuilder />
        </div>
      )}

      {/* Analytics summary panel */}
      <OrdersAnalyticsPanel orders={orders} />

      {/* Table */}
      {orders.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 48, textAlign: 'center', color: '#6B6258' }}>
          <i className="ph ph-table" style={{ fontSize: 32, display: 'block', marginBottom: 12 }} />
          Nenhum pedido encontrado com os filtros aplicados.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          textAlign: 'left',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: header.column.getIsSorted() ? '#1C1814' : '#6B6258',
                          padding: '12px 14px',
                          background: '#F2EEE6',
                          borderBottom: '1px solid #E8E2D6',
                          position: 'sticky', top: 0,
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6' }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid #E8E2D6',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: '#6B6258',
          }}>
            <span>
              {orders.length.toLocaleString('pt-BR')} pedidos ·{' '}
              mostrando {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, orders.length)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                ← Anterior
              </Button>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {pageIndex + 1} / {totalPages}
              </span>
              <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Próxima →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableScreen;
