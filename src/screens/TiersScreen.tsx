import React, { useMemo } from 'react';
import KpiCard from '../components/ui/KpiCard';
import TierStatCard from '../components/TierStatCard';
import ChartCard from '../components/charts/ChartCard';
import RankingChart, { ExtraStat } from '../components/charts/RankingChart';
import { RankingItem, BreakdownRow } from '../components/charts/RankingList';
import TrendLineChart from '../components/charts/TrendLineChart';
import { useFinancialMetrics, useTierMetrics, useFilteredOrders } from '../hooks/useAnalytics';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { useOrderStore } from '../store/useOrderStore';
import { fmtBRLshort, fmtBRL, fmtPct } from '../utils/formatters';
import { TIER_DEFINITIONS } from '../design-system/tierStyles';
import { getSupervisorColor } from '../design-system/supervisorColors';
import Button from '../components/ui/Button';

interface TiersScreenProps {
  onTierClick: (tierId: string) => void;
  onNavigate: (route: string) => void;
}

const TiersScreen: React.FC<TiersScreenProps> = ({ onTierClick, onNavigate }) => {
  const financial = useFinancialMetrics();
  const tierMetrics = useTierMetrics();
  const allOrders = useFilteredOrders();
  const { fileName, rowCount } = useOrderStore();

  // Receita por supervisor — agregado localmente (não vem pronto de useFinancialMetrics, que só
  // expõe o total por supervisor sem quebra por revendedor) pra alimentar o ranking e, em tela
  // cheia, o top-3 de revendedores de cada supervisor. Memoizado por `allOrders` — sem isso, esse
  // loop (mais o sub-objeto por revendedor) refazia em toda re-renderização da tela. Fica antes do
  // guard de "sem dados" abaixo pra manter a ordem de hooks estável entre renders.
  const supervisorAgg = useMemo(() => {
    const agg: Record<string, { orderCount: number; eligibleOrderCount: number; revenue: number; resellers: Record<string, { name: string; value: number }> }> = {};
    for (const o of allOrders) {
      const key = o.ResponsavelEstrutura || 'Sem supervisor';
      if (!agg[key]) agg[key] = { orderCount: 0, eligibleOrderCount: 0, revenue: 0, resellers: {} };
      agg[key].orderCount++;
      if (!isRevenueEligible(o)) continue;
      agg[key].eligibleOrderCount++;
      agg[key].revenue += o.ValorPraticado;
      if (o.Pessoa) {
        if (!agg[key].resellers[o.Pessoa]) agg[key].resellers[o.Pessoa] = { name: o.NomePessoa, value: 0 };
        agg[key].resellers[o.Pessoa].value += o.ValorPraticado;
      }
    }
    return agg;
  }, [allOrders]);

  const supervisorRankingItems: RankingItem[] = useMemo(() => Object.entries(supervisorAgg)
    .filter(([, s]) => s.revenue > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 12)
    .map(([name, s]) => ({
      label: name,
      value: s.revenue,
      valueLabel: fmtBRLshort(s.revenue),
      meta: `${s.orderCount} pedido${s.orderCount === 1 ? '' : 's'}`,
      color: getSupervisorColor(name)?.accent,
    })), [supervisorAgg]);

  if (!financial || tierMetrics.every(t => t.orderCount === 0)) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}>
          <i className="ph ph-chart-bar" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
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

  // Dados por tier pro painel "Receita por tier" — ganha o alternador completo de estilos de
  // gráfico e o modo tela cheia do RankingChart.
  const tiersWithRevenue = TIER_DEFINITIONS
    .filter(t => (financial.revenueByTier[t.id] ?? 0) > 0)
    .sort((a, b) => (financial.revenueByTier[b.id] ?? 0) - (financial.revenueByTier[a.id] ?? 0));
  const tierRankingItems: RankingItem[] = tiersWithRevenue.map(t => ({
    label: t.name,
    value: financial.revenueByTier[t.id] ?? 0,
    valueLabel: fmtBRLshort(financial.revenueByTier[t.id] ?? 0),
    meta: `${financial.ordersByTier[t.id] ?? 0} pedidos`,
    tierId: t.id,
  }));

  function tierIdFromLabel(label: string): string | undefined {
    return tiersWithRevenue.find(t => t.name === label)?.id;
  }

  // Tela cheia: clicar num tier mostra o top-3 de revendedores dele (mesmo dado que já aparecia no
  // tooltip do gráfico de barras antigo), como % da receita do tier.
  function getTierBreakdown(item: RankingItem): BreakdownRow[] | null {
    const tierId = tierIdFromLabel(item.label);
    if (!tierId) return null;
    const sellers = financial!.topResellersByTier[tierId] ?? [];
    if (sellers.length === 0) return null;
    const total = financial!.revenueByTier[tierId] ?? 0;
    return sellers.map(s => ({
      label: s.name,
      value: s.value,
      valueLabel: fmtBRLshort(s.value),
      pct: total > 0 ? (s.value / total) * 100 : 0,
    }));
  }

  function getTierExtraStats(item: RankingItem): ExtraStat[] | null {
    const tierId = tierIdFromLabel(item.label);
    const metrics = tierId ? tierMetrics.find(m => m.tierId === tierId) : undefined;
    if (!metrics) return null;
    return [
      { label: 'Revendedores', value: metrics.resellerCount.toLocaleString('pt-BR') },
      { label: 'Ticket médio', value: fmtBRL(Math.round(metrics.avgTicket)) },
    ];
  }

  function getSupervisorBreakdown(item: RankingItem): BreakdownRow[] | null {
    const s = supervisorAgg[item.label];
    if (!s) return null;
    const sellers = Object.values(s.resellers).sort((a, b) => b.value - a.value).slice(0, 3);
    if (sellers.length === 0) return null;
    return sellers.map(seller => ({
      label: seller.name,
      value: seller.value,
      valueLabel: fmtBRLshort(seller.value),
      pct: s.revenue > 0 ? (seller.value / s.revenue) * 100 : 0,
    }));
  }

  function getSupervisorExtraStats(item: RankingItem): ExtraStat[] | null {
    const s = supervisorAgg[item.label];
    if (!s) return null;
    const resellerCount = Object.keys(s.resellers).length;
    const avgTicket = s.eligibleOrderCount > 0 ? s.revenue / s.eligibleOrderCount : 0;
    return [
      { label: 'Revendedores', value: resellerCount.toLocaleString('pt-BR') },
      { label: 'Ticket médio', value: fmtBRL(Math.round(avgTicket)) },
    ];
  }

  // Build cycle trend series by tier
  const cycles = Object.keys(financial.revenueByCycle).sort();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
            Resumo executivo
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Visão geral por tier
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName} · {rowCount.toLocaleString('pt-BR')} pedidos
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="Valor Praticado"
          value={fmtBRLshort(financial.grossRevenue)}
          hint="Soma da receita (Valor Praticado) de todos os pedidos elegíveis no período filtrado."
          tooltip={
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
              {fmtBRL(financial.grossRevenue)}
            </span>
          }
        />
        <KpiCard
          eyebrow="Total de pedidos"
          value={financial.totalOrders.toLocaleString('pt-BR')}
          delta={((financial.finalizados / financial.totalOrders) * 100).toFixed(1).replace('.', ',') + '% fin.'}
          deltaDirection="up"
          hint="Total de pedidos importados, com a % de pedidos finalizados sobre o total."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Finalizados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {financial.finalizados.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Cancelados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-danger, #B83A3A)' }}>
                  {financial.cancelados.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          }
        />
        <KpiCard
          eyebrow="RPA"
          value={fmtBRLshort(financial.activeResellers > 0 ? financial.grossRevenue / financial.activeResellers : 0)}
          hint="RPA — Receita Por Ativo: faturamento total dividido pelo número de revendedores ativos no período."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Clientes ativos</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {financial.activeResellers.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Faturamento</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {fmtBRLshort(financial.grossRevenue)}
                </span>
              </div>
            </div>
          }
        />
        <KpiCard
          eyebrow="Ticket Médio"
          value={fmtBRLshort(financial.avgTicket)}
          hint="Receita total dividida pelo número de pedidos elegíveis (não cancelados)."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Valor exato</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(financial.avgTicket)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Base</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{financial.finalizados.toLocaleString('pt-BR')} pedidos</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 28 }}>
        <ChartCard title="Receita por tier" subtitle="Comparativo de receita por grupo" hint="Comparativo de receita total entre os tiers. Clique numa barra/fatia para abrir o detalhe com os principais revendedores.">
          <RankingChart
            items={tierRankingItems}
            mode="vd"
            maxSlices={8}
            emptyMessage="Sem dados"
            getBreakdown={getTierBreakdown}
            breakdownLabel="Top revendedores do tier"
            getExtraStats={getTierExtraStats}
          />
        </ChartCard>
        <ChartCard title="Receita por supervisor" subtitle="Ranking dos supervisores que mais venderam" hint="Ranking de supervisores/estruturas por receita total gerada. Clique num item para ver os principais revendedores dessa estrutura.">
          <RankingChart
            items={supervisorRankingItems}
            mode="vd"
            maxSlices={8}
            emptyMessage="Sem dados"
            getBreakdown={getSupervisorBreakdown}
            breakdownLabel="Top revendedores do supervisor"
            getExtraStats={getSupervisorExtraStats}
          />
        </ChartCard>
      </div>

      {/* Revenue by cycle trend */}
      {cycles.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <ChartCard title="Receita por ciclo" subtitle="Evolução da receita ao longo dos ciclos" hint="Receita total (Valor Praticado) somada por ciclo de faturamento.">
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
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginTop: 36, marginBottom: 12 }}>
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
