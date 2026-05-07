import React from 'react';
import KpiCard from '../components/ui/KpiCard';
import TierStatCard from '../components/TierStatCard';
import ChartCard from '../components/charts/ChartCard';
import TierBarChart from '../components/charts/TierBarChart';
import TierPieChart from '../components/charts/TierPieChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import { useFinancialMetrics, useTierMetrics } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { fmtBRLshort, fmtBRL, fmtPct } from '../utils/formatters';
import { TIER_DEFINITIONS, TIER_STYLES } from '../design-system/tierStyles';
import Button from '../components/ui/Button';

interface TiersScreenProps {
  onTierClick: (tierId: string) => void;
  onNavigate: (route: string) => void;
}

const TiersScreen: React.FC<TiersScreenProps> = ({ onTierClick, onNavigate }) => {
  const financial = useFinancialMetrics();
  const tierMetrics = useTierMetrics();
  const { fileName, rowCount } = useOrderStore();

  if (!financial || tierMetrics.every(t => t.orderCount === 0)) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-chart-bar" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          Importe uma planilha de pedidos para visualizar a análise por tier.
        </p>
        <Button
          variant="primary"
          icon={<i className="ph ph-upload-simple" style={{ fontSize: 16 }} />}
          onClick={() => onNavigate('import')}
        >
          Importar planilha
        </Button>
      </div>
    );
  }

  const grandTotal = financial.grossRevenue;
  const tierBarData = TIER_DEFINITIONS
    .filter(t => (financial.ordersByTier[t.id] ?? 0) > 0)
    .map(t => ({
      tierId: t.id,
      label: t.name.replace(' GB', '').replace('Consumidor Final', 'C. Final'),
      value: financial.revenueByTier[t.id] ?? 0,
      valueLabel: fmtBRLshort(financial.revenueByTier[t.id] ?? 0),
      count: `${financial.ordersByTier[t.id] ?? 0} pedidos`,
    }));

  const tierPieData = TIER_DEFINITIONS
    .filter(t => (financial.revenueByTier[t.id] ?? 0) > 0)
    .map(t => ({
      tierId: t.id,
      value: financial.revenueByTier[t.id] ?? 0,
      label: t.name,
    }));

  // Build cycle trend series by tier
  const cycles = Object.keys(financial.revenueByCycle).sort();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Resumo executivo
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Visão geral por tier
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: '#6B6258', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName} · {rowCount.toLocaleString('pt-BR')} pedidos
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="Receita bruta"
          value={fmtBRLshort(financial.grossRevenue)}
        />
        <KpiCard
          eyebrow="Total de pedidos"
          value={financial.totalOrders.toLocaleString('pt-BR')}
        />
        <KpiCard
          eyebrow="Ticket médio"
          value={fmtBRLshort(financial.avgTicket)}
        />
        <KpiCard
          eyebrow="Receita líquida"
          value={fmtBRLshort(financial.netRevenue)}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 28 }}>
        <ChartCard title="Receita por tier" subtitle="Comparativo de receita por grupo">
          {tierBarData.length > 0 ? (
            <TierBarChart data={tierBarData} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287' }}>
              Sem dados
            </div>
          )}
        </ChartCard>
        <ChartCard title="Distribuição" subtitle={`Total ${fmtBRLshort(grandTotal)}`}>
          {tierPieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <TierPieChart data={tierPieData} size={180} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, flex: 1 }}>
                {tierPieData.map(t => {
                  const pct = grandTotal > 0 ? (t.value / grandTotal) * 100 : 0;
                  const style = TIER_STYLES[t.tierId];
                  return (
                    <div key={t.tierId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: style?.accent ?? '#6B6258' }} />
                      <span style={{ flex: 1, color: '#3D362E' }}>{t.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287' }}>Sem dados</div>
          )}
        </ChartCard>
      </div>

      {/* Revenue by cycle trend */}
      {cycles.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <ChartCard title="Receita por ciclo" subtitle="Evolução da receita ao longo dos ciclos">
            <TrendLineChart
              series={[{
                tierId: 'ouro',
                label: 'Receita total',
                color: '#C9A227',
                points: cycles.map(c => financial.revenueByCycle[c] ?? 0),
              }]}
              labels={cycles}
            />
          </ChartCard>
        </div>
      )}

      {/* Tier stat cards */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginTop: 36, marginBottom: 12 }}>
        Tiers
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {tierMetrics
          .filter(t => t.orderCount > 0)
          .map(t => (
            <TierStatCard
              key={t.tierId}
              tier={t.tierId}
              count={t.resellerCount}
              value={fmtBRLshort(t.totalRevenue)}
              onClick={() => onTierClick(t.tierId)}
            />
          ))}
      </div>
    </div>
  );
};

export default TiersScreen;
