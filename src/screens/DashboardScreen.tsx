import React from 'react';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/charts/ChartCard';
import TierDonutChart from '../components/charts/TierDonutChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import { useFinancialMetrics, useOperationalMetrics, useCommercialMetrics, useInsights } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { fmtBRLshort, fmtMinutes, fmtPct, fmtNumber } from '../utils/formatters';
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

  if (!financial) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-chart-line" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Dashboard vazio</h2>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
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

  const donutStatusData = operational
    ? Object.entries(operational.ordersByStatus).map(([label, value]) => {
        const colorMap: Record<string, string> = {
          'Entregue': 'esmeralda',
          'Cancelado': 'rubi',
          'Separação': 'ouro',
          'Transporte': 'platina',
        };
        return { tierId: colorMap[label] ?? 'cf', value, label };
      })
    : [];

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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Analytics
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Dashboard
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: '#6B6258', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName}
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="Receita bruta"
          value={fmtBRLshort(financial.grossRevenue)}
          delta={sortedCycles.length >= 2 ? `${Math.abs(cycleGrowth).toFixed(1).replace('.', ',')}%` : undefined}
          deltaDirection={cycleGrowth >= 0 ? 'up' : 'down'}
          meta="vs ciclo ant."
        />
        <KpiCard
          eyebrow="Pedidos totais"
          value={fmtNumber(financial.totalOrders)}
        />
        <KpiCard
          eyebrow="Ticket médio"
          value={fmtBRLshort(financial.avgTicket)}
        />
        <KpiCard
          eyebrow="Revendedores ativos"
          value={commercial ? fmtNumber(commercial.activeResellers) : '-'}
        />
      </div>

      {/* SLA Row */}
      {operational && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
          <KpiCard
            eyebrow="SLA médio"
            value={fmtMinutes(operational.avgSLAMinutes)}
          />
          <KpiCard
            eyebrow="SLA mínimo"
            value={fmtMinutes(operational.minSLAMinutes)}
            deltaDirection="up"
          />
          <KpiCard
            eyebrow="SLA máximo"
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
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287' }}>Sem dados de ciclo</div>
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
                  const style = TIER_STYLES[d.tierId];
                  const pct = financial.totalOrders > 0 ? (d.value / financial.totalOrders) * 100 : 0;
                  return (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: style?.accent ?? '#6B6258', flexShrink: 0 }} />
                      <span style={{ flex: 1, color: '#3D362E' }}>{d.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287' }}>Sem dados</div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Supervisors + Modelo Comercial */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Top supervisors */}
        <ChartCard title="Top supervisores" subtitle="Por receita gerada">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topSupervisors.map(([name, value]) => (
              <div key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258', flexShrink: 0 }}>
                    {fmtBRLshort(value)}
                  </span>
                </div>
                <div style={{ height: 4, background: '#F2EEE6', borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    width: `${(value / topSupervisorMax) * 100}%`,
                    background: 'linear-gradient(90deg, #C9A227, #E8C547)',
                    borderRadius: 2,
                    transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }} />
                </div>
              </div>
            ))}
            {topSupervisors.length === 0 && (
              <div style={{ color: '#9B9287', fontSize: 13, padding: '20px 0' }}>Sem dados de supervisor</div>
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
                const color = colorMap[modelo] ?? '#6B6258';
                return (
                  <div key={modelo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{modelo || 'Não informado'}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div style={{ height: 4, background: '#F2EEE6', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </ChartCard>
      </div>

      {/* Insights panel */}
      {insights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <ChartCard title="Insights automáticos" subtitle="Gerados a partir dos dados importados">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {insights.map(insight => {
                const bg = insight.type === 'positive' ? '#E0F2E8' : insight.type === 'negative' ? '#FBE5E9' : '#F2EEE6';
                const color = insight.type === 'positive' ? '#2E7D5B' : insight.type === 'negative' ? '#B83A3A' : '#6B6258';
                return (
                  <div key={insight.id} style={{
                    display: 'flex', gap: 10, padding: '12px 14px',
                    background: bg, borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 18, color, flexShrink: 0 }}>
                      <i className={`ph ${insight.icon}`} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1814', marginBottom: 2 }}>{insight.title}</div>
                      <div style={{ fontSize: 12, color: '#3D362E', lineHeight: 1.5 }}>{insight.description}</div>
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
          <ChartCard title="Distribuição de SLA" subtitle="Tempo entre aprovação e autorização de faturamento">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {operational.slaDistribution.map((bucket, i) => {
                const maxCount = Math.max(...operational.slaDistribution.map(d => d.count), 1);
                const height = (bucket.count / maxCount) * 120;
                const colors = ['#2DA070', '#C9A227', '#E8C547', '#DC4565', '#B83A3A'];
                return (
                  <div key={bucket.bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: '#3D362E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {bucket.count}
                    </div>
                    <div style={{ width: '100%', height, background: colors[i], borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                    <div style={{ fontSize: 10, color: '#6B6258', textAlign: 'center' }}>{bucket.bucket}</div>
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
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 8 }}>
              Taxa de cancelamento
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: commercial.cancellationRate > 10 ? '#B83A3A' : '#2E7D5B' }}>
              {commercial.cancellationRate.toFixed(1).replace('.', ',')}%
            </div>
            <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>
              {commercial.cancellationRate > 10 ? 'Acima do limite recomendado' : 'Dentro do esperado'}
            </div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 8 }}>
              Frequência de recompra
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {commercial.repurchaseFrequency.toFixed(1).replace('.', ',')}
            </div>
            <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>pedidos por revendedor</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 8 }}>
              Receita líquida
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {fmtBRLshort(financial.netRevenue)}
            </div>
            <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>
              {financial.grossRevenue > 0 ? ((financial.netRevenue / financial.grossRevenue) * 100).toFixed(1).replace('.', ',') : '0,0'}% da receita bruta
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
