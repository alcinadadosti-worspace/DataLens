import React, { useMemo, useState } from 'react';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/charts/ChartCard';
import TierDonutChart from '../components/charts/TierDonutChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import { useFinancialMetrics, useOperationalMetrics, useCommercialMetrics, useInsights } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';
import { fmtBRLshort, fmtBRL, fmtMinutes, fmtNumber } from '../utils/formatters';
import { TIER_DEFINITIONS, TIER_STYLES } from '../design-system/tierStyles';
import Button from '../components/ui/Button';
import { cycleSortKey } from '../utils/dateUtils';

interface DashboardScreenProps {
  onNavigate: (route: string) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const financial = useFinancialMetrics();
  const operational = useOperationalMetrics();
  const commercial = useCommercialMetrics();
  const insights = useInsights();
  const { fileName } = useOrderStore();
  const setFilter = useFilterStore(s => s.setFilter);
  const [hoveredSup, setHoveredSup] = useState<string | null>(null);

  // Card "Dia de Pico" — memoizado por revenueByDayAndTier/grossRevenue; antes recalculava a cada
  // render do Dashboard, inclusive quando só `hoveredSup` (hover de outro card, sem relação nenhuma
  // com esse cálculo) mudava.
  const peakDayInfo = useMemo(() => {
    if (!financial) return null;
    const days = Object.keys(financial.revenueByDayAndTier)
      .filter(d => d !== '?')
      .sort((a, b) => parseInt(a) - parseInt(b));
    const peak = days.reduce<{ day: string; total: number }>(
      (best, d) => {
        const total = Object.values(financial.revenueByDayAndTier[d] ?? {}).reduce((s, v) => s + v, 0);
        return total > best.total ? { day: d, total } : best;
      },
      { day: '-', total: 0 }
    );
    const avgDaily = days.length > 0 ? financial.grossRevenue / days.length : 0;
    const aboveAvg = avgDaily > 0 ? ((peak.total / avgDaily - 1) * 100) : 0;
    const topTierOnPeak = peak.day !== '-'
      ? Object.entries(financial.revenueByDayAndTier[peak.day] ?? {}).sort((a, b) => b[1] - a[1])[0]
      : null;
    const topTierDef = topTierOnPeak ? TIER_DEFINITIONS.find(t => t.id === topTierOnPeak[0]) : null;
    const topTierStyle = topTierOnPeak ? TIER_STYLES[topTierOnPeak[0]] : null;
    return { peak, aboveAvg, topTierDef, topTierStyle };
  }, [financial]);

  if (!financial) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}>
          <i className="ph ph-chart-line" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Dashboard vazio</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe uma planilha de pedidos para visualizar o dashboard.
        </p>
        <Button variant="primary" icon={<i className="ph ph-upload-simple" style={{ fontSize: 16 }} />} onClick={() => onNavigate('import')}>
          Importar planilha
        </Button>
      </div>
    );
  }

  const sortedCycles = Object.keys(financial.revenueByCycle).sort((a, b) =>
    cycleSortKey(a).localeCompare(cycleSortKey(b))
  );

  // Situação real dos pedidos (Entregue/Separação/Transporte/Cancelado) em vez de só o binário
  // finalizado/cancelado — operational.ordersByStatus já vinha calculado com essa granularidade
  // mas não era usado em nenhuma tela; o donut colapsava Separação e Transporte dentro de
  // "Finalizados", escondendo quanto do total ainda está em trânsito/separação.
  const STATUS_COLORS: Record<string, string> = {
    'Entregue': 'var(--vd-success, #2E7D5B)',
    'Transporte': 'var(--vd-accent, #C9A227)',
    'Separação': 'var(--vd-text-secondary, #6B6258)',
    'Cancelado': 'var(--vd-danger, #B83A3A)',
  };
  const donutStatusData = Object.entries(operational?.ordersByStatus ?? {})
    .map(([status, value]) => ({
      tierId: `status-${status}`, // sem correspondência em TIER_STYLES de propósito — força usar `color`
      value,
      label: status,
      color: STATUS_COLORS[status] ?? 'var(--vd-text-muted, #9B9287)',
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const topSupervisors = Object.entries(financial.revenueBySupervisor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topSupervisorMax = topSupervisors[0]?.[1] ?? 1;

  const cycleGrowth = sortedCycles.length >= 2
    ? (() => {
        const last = financial.revenueByCycle[sortedCycles[sortedCycles.length - 1]] ?? 0;
        const prev = financial.revenueByCycle[sortedCycles[sortedCycles.length - 2]] ?? 0;
        return prev > 0 ? ((last - prev) / prev) * 100 : 0;
      })()
    : 0;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
            Analytics
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Dashboard
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName}
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="Valor Praticado"
          value={fmtBRLshort(financial.grossRevenue)}
          delta={sortedCycles.length >= 2 ? `${Math.abs(cycleGrowth).toFixed(1).replace('.', ',')}%` : undefined}
          deltaDirection={cycleGrowth >= 0 ? 'up' : 'down'}
          meta="vs ciclo ant."
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(financial.grossRevenue)}</span>}
        />
        <KpiCard
          eyebrow="Pedidos"
          value={fmtNumber(financial.totalOrders)}
          delta={financial.totalOrders > 0 ? `${((financial.finalizados / financial.totalOrders) * 100).toFixed(1).replace('.', ',')}% fin.` : undefined}
          deltaDirection="up"
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Finalizados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{financial.finalizados.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Cancelados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#C04040' }}>{financial.cancelados.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          }
        />
        <KpiCard
          eyebrow="Ticket Médio"
          value={fmtBRLshort(financial.avgTicket)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(financial.avgTicket)}</span>}
        />
        <KpiCard
          eyebrow="Revendedores ativos"
          value={commercial ? fmtNumber(commercial.activeResellers) : '-'}
          tooltip={commercial ? (() => {
            const top3 = Object.entries(commercial.resellersByTier)
              .sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {top3.map(([tierId, count]) => {
                  const td = TIER_DEFINITIONS.find(t => t.id === tierId);
                  const ts = TIER_STYLES[tierId];
                  return (
                    <div key={tierId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: ts?.accent ?? 'var(--vd-text-secondary, #6B6258)', flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--vd-text-muted, #9B9287)' }}>{td?.name ?? tierId}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            );
          })() : undefined}
        />
      </div>

      {/* SLA Row */}
      {operational && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
          <KpiCard
            eyebrow="ANS médio"
            value={fmtMinutes(operational.avgSLAMinutes)}
          />
          <KpiCard
            eyebrow="ANS mínimo"
            value={fmtMinutes(operational.minSLAMinutes)}
            deltaDirection="up"
          />
          <KpiCard
            eyebrow="ANS máximo"
            value={fmtMinutes(operational.maxSLAMinutes)}
            deltaDirection={operational.maxSLAMinutes > 1440 ? 'down' : 'up'}
          />
          <KpiCard
            eyebrow="Pedidos atrasados"
            value={fmtNumber(operational.delayedOrders)}
            deltaDirection={operational.delayedOrders > 0 ? 'down' : 'up'}
          />
        </div>
      )}

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Revenue by cycle */}
        <ChartCard title="Receita por ciclo" subtitle="Evolução da receita total">
          {sortedCycles.length > 0 ? (
            <TrendLineChart
              series={[{
                tierId: 'ouro',
                color: '#C9A227',
                points: sortedCycles.map(c => financial.revenueByCycle[c] ?? 0),
              }]}
              labels={sortedCycles}
            />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-text-muted, #9B9287)' }}>Sem dados de ciclo</div>
          )}
        </ChartCard>

        {/* Status donut */}
        <ChartCard title="Status dos pedidos" subtitle={`${financial.totalOrders.toLocaleString('pt-BR')} total`}>
          {donutStatusData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TierDonutChart
                data={donutStatusData}
                size={160}
                centerLabel="Total"
                centerValue={fmtNumber(financial.totalOrders)}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donutStatusData.map(d => {
                  const pct = financial.totalOrders > 0 ? (d.value / financial.totalOrders) * 100 : 0;
                  return (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--vd-text-strong, #3D362E)' }}>{d.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-text-secondary, #6B6258)' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-text-muted, #9B9287)' }}>Sem dados</div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Supervisors + Modelo Comercial + Meio de Captação */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Top supervisors */}
        <ChartCard title="Top supervisores" subtitle="Por receita gerada · clique para filtrar pedidos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topSupervisors.map(([name, value], idx) => {
              const isHov = hoveredSup === name;
              const pct = (value / topSupervisorMax) * 100;
              return (
                <div
                  key={name}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredSup(name)}
                  onMouseLeave={() => setHoveredSup(null)}
                  onClick={() => {
                    setFilter('supervisor', name);
                    onNavigate('table');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {/* Rank badge */}
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: idx === 0 ? 'linear-gradient(135deg, var(--vd-warning-border, #E8C547), #C9A227)' :
                                    idx === 1 ? 'linear-gradient(135deg, var(--vd-border-strong, #D8D0C0), var(--vd-text-muted, #9B9287))' :
                                    idx === 2 ? 'linear-gradient(135deg, #E8B68A, #C9824D)' : 'var(--vd-bg-track, #F2EEE6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700,
                        color: idx < 3 ? 'var(--vd-surface, #FFFFFF)' : 'var(--vd-text-secondary, #6B6258)',
                        boxShadow: idx === 0 ? '0 1px 4px rgba(201,162,39,0.4)' : 'none',
                      }}>{idx + 1}</span>
                      <span style={{
                        fontWeight: isHov ? 600 : 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: isHov ? '#C9A227' : 'var(--vd-ink, #1C1814)',
                        textDecoration: isHov ? 'underline' : 'none',
                        textDecorationColor: '#C9A22766',
                        transition: 'color 150ms',
                      }}>{name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: isHov ? '#C9A227' : 'var(--vd-text-secondary, #6B6258)', transition: 'color 150ms' }}>
                        {fmtBRLshort(value)}
                      </span>
                      <i className="ph ph-arrow-right" style={{
                        fontSize: 12, color: '#C9A227',
                        opacity: isHov ? 1 : 0,
                        transform: isHov ? 'translateX(0)' : 'translateX(-4px)',
                        transition: 'opacity 150ms, transform 150ms',
                      }} />
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--vd-bg-track, #F2EEE6)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isHov
                        ? 'linear-gradient(90deg, #C9A227, var(--vd-warning-border, #E8C547), #FFF3B0)'
                        : 'linear-gradient(90deg, #C9A227, var(--vd-warning-border, #E8C547))',
                      borderRadius: 2,
                      transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms',
                      boxShadow: isHov ? '0 0 6px rgba(201,162,39,0.5)' : 'none',
                    }} />
                  </div>
                </div>
              );
            })}
            {topSupervisors.length === 0 && (
              <div style={{ color: 'var(--vd-text-muted, #9B9287)', fontSize: 13, padding: '20px 0' }}>Sem dados de supervisor</div>
            )}
          </div>
        </ChartCard>

        {/* Modelo Comercial */}
        <ChartCard title="Modelo comercial" subtitle="Distribuição de receita por canal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(financial.revenueByModeloComercial)
              .sort((a, b) => b[1] - a[1])
              .map(([modelo, value]) => {
                const total = financial.grossRevenue;
                const pct = total > 0 ? (value / total) * 100 : 0;
                const colorMap: Record<string, string> = {
                  'Online': '#6B7DD9',
                  'OMNIChannel': '#2DA070',
                  'Presencial': '#C9A227',
                };
                const color = colorMap[modelo] ?? 'var(--vd-text-secondary, #6B6258)';
                return (
                  <div key={modelo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{modelo || 'Não informado'}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--vd-bg-track, #F2EEE6)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </ChartCard>

        {/* Meio de Captação — financial.revenueByMeioCaptacao já vinha calculado (por APP
            Revendedor, VD+, Portal, VDI...) mas não aparecia em nenhuma tela do Modo VD. */}
        <ChartCard title="Meio de captação" subtitle="Distribuição de receita por canal de pedido">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(financial.revenueByMeioCaptacao)
              .sort((a, b) => b[1] - a[1])
              .map(([meio, value]) => {
                const total = financial.grossRevenue;
                const pct = total > 0 ? (value / total) * 100 : 0;
                const colorMap: Record<string, string> = {
                  'APP Revendedor': '#6B7DD9',
                  'VD+': '#C9A227',
                  'Portal Revendedores': '#2DA070',
                  'VDI': '#B26A3C',
                  'Pedido Omnichannel': '#8A5CB8',
                };
                const color = colorMap[meio] ?? 'var(--vd-text-secondary, #6B6258)';
                return (
                  <div key={meio}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{meio || 'Não informado'}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--vd-bg-track, #F2EEE6)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            {Object.keys(financial.revenueByMeioCaptacao).length === 0 && (
              <div style={{ color: 'var(--vd-text-muted, #9B9287)', fontSize: 13, padding: '20px 0' }}>Sem dados</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Insights panel */}
      {insights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <ChartCard title="Insights automáticos" subtitle="Gerados a partir dos dados importados">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {insights.map(insight => {
                const bg = insight.type === 'positive' ? 'var(--vd-success-bg, #E0F2E8)' : insight.type === 'negative' ? 'var(--vd-danger-bg, #FBE5E9)' : 'var(--vd-bg-track, #F2EEE6)';
                const color = insight.type === 'positive' ? 'var(--vd-success, #2E7D5B)' : insight.type === 'negative' ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-text-secondary, #6B6258)';
                return (
                  <div key={insight.id} style={{
                    display: 'flex', gap: 10, padding: '12px 14px',
                    background: bg, borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 18, color, flexShrink: 0 }}>
                      <i className={`ph ${insight.icon}`} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vd-ink, #1C1814)', marginBottom: 2 }}>{insight.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--vd-text-strong, #3D362E)', lineHeight: 1.5 }}>{insight.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      )}

      {/* SLA distribution */}
      {operational && operational.slaDistribution.some(d => d.count > 0) && (
        <div style={{ marginTop: 14 }}>
          <ChartCard title="Distribuição de ANS" subtitle="Tempo entre aprovação e autorização de faturamento">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {operational.slaDistribution.map((bucket, i) => {
                const maxCount = Math.max(...operational.slaDistribution.map(d => d.count), 1);
                const height = (bucket.count / maxCount) * 120;
                const colors = ['#2DA070', '#C9A227', 'var(--vd-warning-border, #E8C547)', '#DC4565', 'var(--vd-danger, #B83A3A)'];
                return (
                  <div key={bucket.bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--vd-text-strong, #3D362E)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {bucket.count}
                    </div>
                    <div style={{ width: '100%', height, background: colors[i], borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                    <div style={{ fontSize: 10, color: 'var(--vd-text-secondary, #6B6258)', textAlign: 'center' }}>{bucket.bucket}</div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Cancellation rate */}
      {commercial && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
          <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 8 }}>
              Taxa de cancelamento
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: commercial.cancellationRate > 10 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-success, #2E7D5B)' }}>
              {commercial.cancellationRate.toFixed(1).replace('.', ',')}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 4 }}>
              {commercial.cancellationRate > 10 ? 'Acima do limite recomendado' : 'Dentro do esperado'}
            </div>
          </div>
          <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 8 }}>
              Frequência de recompra
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {commercial.repurchaseFrequency.toFixed(1).replace('.', ',')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 4 }}>pedidos por revendedor</div>
          </div>
          {peakDayInfo && (
            <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 8 }}>
                Dia de Pico
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {peakDayInfo.peak.day !== '-' ? `Dia ${peakDayInfo.peak.day}` : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-ink, #1C1814)', fontWeight: 600 }}>
                  {peakDayInfo.peak.total > 0 ? fmtBRLshort(peakDayInfo.peak.total) : '—'}
                </span>
                {peakDayInfo.aboveAvg > 0 && (
                  <span style={{ color: 'var(--vd-success, #2E7D5B)' }}>
                    +{peakDayInfo.aboveAvg.toFixed(0)}% acima da média diária
                  </span>
                )}
                {peakDayInfo.topTierDef && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: peakDayInfo.topTierStyle?.accent, flexShrink: 0 }} />
                    <span>Liderado por {peakDayInfo.topTierDef.name}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
