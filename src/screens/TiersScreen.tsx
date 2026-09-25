import React, { useMemo } from 'react';
import KpiCard from '../components/ui/KpiCard';
import TierStatCard from '../components/TierStatCard';
import ChartCard from '../components/charts/ChartCard';
import RankingChart, { ExtraStat } from '../components/charts/RankingChart';
import { RankingItem, BreakdownRow } from '../components/charts/RankingList';
import TrendLineChart from '../components/charts/TrendLineChart';
import { useFinancialMetrics, useTierMetrics, useFilteredOrders, useOfficialRPA } from '../hooks/useAnalytics';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { useOrderStore } from '../store/useOrderStore';
import { isFVCOrder } from '../analytics/fvc';
import { fmtBRLshort, fmtBRL, fmtPct } from '../utils/formatters';
import { TIER_DEFINITIONS } from '../design-system/tierStyles';
import { getSupervisorColor } from '../design-system/supervisorColors';
import Button from '../components/ui/Button';

interface TiersScreenProps {
  onTierClick: (tierId: string) => void;
  onNavigate: (route: string) => void;
}

const TiersScreen: React.FC<TiersScreenProps> = ({ onTierClick, onNavigate }) => {
  // A Visão geral inteira (cards e gráficos) é sem FVC. A participação das FVCs e o faturamento total
  // ficam na tela FVC; aqui elas só aparecem como "fora" nos tooltips e na observação.
  const financial = useFinancialMetrics({ excludeFVC: true });
  const tierMetrics = useTierMetrics({ excludeFVC: true });
  const allOrders = useFilteredOrders({ excludeFVC: true });
  const ordersWithFVC = useFilteredOrders();
  const { fileName, rowCount } = useOrderStore();
  const officialRPA = useOfficialRPA();

  // Pedidos FVC do canal VD que a Visão geral deixa de fora (os OMNI já são contados à parte).
  // Revendedores são contados distintos: quem compra dentro e fora das FVCs entra uma vez só no "com FVC".
  const fvcOut = useMemo(() => {
    let orders = 0, eligible = 0, revenue = 0;
    const fvcResellers = new Set<string>();
    const allVDResellers = new Set<string>();
    for (const o of ordersWithFVC) {
      if (/omni/i.test(o.ModeloComercial)) continue;
      const eligibleOrder = isRevenueEligible(o);
      if (eligibleOrder && o.Pessoa) allVDResellers.add(o.Pessoa);
      if (!isFVCOrder(o)) continue;
      orders++;
      if (!eligibleOrder) continue;
      eligible++;
      revenue += o.ValorPraticado;
      if (o.Pessoa) fvcResellers.add(o.Pessoa);
    }
    return { orders, eligible, revenue, resellers: fvcResellers.size, resellersWithFVC: allVDResellers.size };
  }, [ordersWithFVC]);

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

  // Os cards do topo são só do canal VD (Online + Presencial), como os relatórios do BI. Os pedidos
  // OMNI são de Consumidor Final: ficam fora da receita, dos pedidos, do ticket e dos revendedores
  // ativos do RPA, e aparecem à parte nos tooltips.
  const channel = useMemo(() => {
    let vdOrders = 0, vdEligible = 0, vdRevenue = 0, omniOrders = 0, omniEligible = 0, omniRevenue = 0, omniConsumidorFinal = 0;
    const vdResellers = new Set<string>();
    for (const o of allOrders) {
      const eligible = isRevenueEligible(o);
      if (/omni/i.test(o.ModeloComercial)) {
        omniOrders++;
        if (o.tierId === 'cf') omniConsumidorFinal++;
        if (eligible) { omniEligible++; omniRevenue += o.ValorPraticado; }
        continue;
      }
      vdOrders++;
      if (!eligible) continue;
      vdEligible++;
      vdRevenue += o.ValorPraticado;
      if (o.Pessoa) vdResellers.add(o.Pessoa);
    }
    return { vdOrders, vdEligible, vdRevenue, omniOrders, omniEligible, omniRevenue, omniConsumidorFinal, activeVDResellers: vdResellers.size };
  }, [allOrders]);

  if ((!financial || tierMetrics.every(t => t.orderCount === 0)) && fvcOut.orders > 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}>
          <i className="ph ph-chart-pie-slice" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Só há pedidos FVC neste recorte</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          A Visão geral não inclui as estruturas FVC. Veja esses {fvcOut.orders.toLocaleString('pt-BR')} pedidos na tela FVC.
        </p>
        <Button variant="primary" icon={<i className="ph ph-chart-pie-slice" style={{ fontSize: 16 }} />} onClick={() => onNavigate('fvc')}>
          Abrir tela FVC
        </Button>
      </div>
    );
  }

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
    label: t.id === 'cf' ? `${t.name}*` : t.name,
    value: financial.revenueByTier[t.id] ?? 0,
    valueLabel: fmtBRLshort(financial.revenueByTier[t.id] ?? 0),
    meta: `${financial.ordersByTier[t.id] ?? 0} pedidos`,
    tierId: t.id,
  }));

  function tierIdFromLabel(label: string): string | undefined {
    return tiersWithRevenue.find(t => t.name === label.replace(/\*$/, ''))?.id;
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
      // Consumidor Final* são os pedidos OMNI: quem compra não é revendedor.
      { label: tierId === 'cf' ? 'Consumidores finais (OMNI)' : 'Revendedores', value: metrics.resellerCount.toLocaleString('pt-BR') },
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

  const { vdOrders, vdEligible, vdRevenue, omniOrders, omniEligible, omniRevenue, omniConsumidorFinal, activeVDResellers } = channel;
  const vdTicket = vdEligible > 0 ? vdRevenue / vdEligible : 0;
  const ticketWithFVC = vdEligible + fvcOut.eligible > 0 ? (vdRevenue + fvcOut.revenue) / (vdEligible + fvcOut.eligible) : 0;
  const ticketFVC = fvcOut.eligible > 0 ? fvcOut.revenue / fvcOut.eligible : 0;
  const rpa = activeVDResellers > 0 ? vdRevenue / activeVDResellers : 0;
  const rpaWithFVC = fvcOut.resellersWithFVC > 0 ? (vdRevenue + fvcOut.revenue) / fvcOut.resellersWithFVC : 0;
  const rpaFVC = fvcOut.resellers > 0 ? fvcOut.revenue / fvcOut.resellers : 0;

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
          eyebrow="Receita VD*"
          value={fmtBRLshort(vdRevenue)}
          footnote="Sem as estruturas FVC (ver tela FVC)"
          hint="Receita (Valor Praticado) dos pedidos VD (Online + Presencial) não cancelados no período filtrado, sem os pedidos das estruturas FVC. A participação das FVCs e o faturamento total ficam na tela FVC. Os pedidos OMNI (Consumidor Final) também ficam de fora."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Pedidos VD sem FVC</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(vdRevenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>FVC (fora)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(fvcOut.revenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>OMNI (fora)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(omniRevenue)}</span>
              </div>
            </div>
          }
        />
        <KpiCard
          eyebrow="Total de pedidos*"
          value={vdOrders.toLocaleString('pt-BR')}
          delta={vdOrders > 0 ? ((vdEligible / vdOrders) * 100).toFixed(1).replace('.', ',') + '% fin.' : undefined}
          deltaDirection="up"
          hint="Pedidos do canal VD (Online + Presencial) no período, sem as estruturas FVC, com a % de pedidos finalizados (não cancelados) sobre o total. Os pedidos FVC e os OMNI (Consumidor Final) ficam de fora e aparecem à parte no detalhe."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Finalizados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {vdEligible.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Cancelados</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-danger, #B83A3A)' }}>
                  {(vdOrders - vdEligible).toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Pedidos FVC (fora)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {fvcOut.orders.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Pedidos OMNI (fora)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {omniOrders.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          }
        />
        <KpiCard
          eyebrow="RPA*"
          value={fmtBRLshort(rpa)}
          hint="RPA — Receita Por Ativo, como no Monitoramento do BI: receita do canal VD (Online + Presencial) dividida pelo número de revendedores com pedido VD no período, sem as estruturas FVC. No detalhe, o mesmo cálculo com as FVCs (revendedores contados uma vez só, mesmo quem compra dentro e fora delas) e só das FVCs. Os pedidos OMNI (Consumidor Final) ficam fora."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {([
                ['Sem FVC (este card)', rpa, activeVDResellers],
                ['Com FVC', rpaWithFVC, fvcOut.resellersWithFVC],
                ['Só FVC', rpaFVC, fvcOut.resellers],
              ] as const).map(([label, value, resellers]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                    {fmtBRL(value)} <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>· {resellers.toLocaleString('pt-BR')} rev.</span>
                  </span>
                </div>
              ))}
              {officialRPA !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Oficial do BI (com FVC)</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(officialRPA)}</span>
                </div>
              )}
            </div>
          }
        />
        <KpiCard
          eyebrow="Ticket Médio*"
          value={fmtBRLshort(vdTicket)}
          hint="Receita do canal VD (Online + Presencial) dividida pelo número de pedidos VD não cancelados, sem as estruturas FVC. No detalhe, o mesmo ticket com os pedidos FVC incluídos e o ticket só das FVCs; o dos pedidos OMNI (Consumidor Final) aparece à parte."
          tooltip={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Sem FVC (este card)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(vdTicket)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Com FVC</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(ticketWithFVC)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Só FVC</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(ticketFVC)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Base</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {vdEligible.toLocaleString('pt-BR')} pedidos + {fvcOut.eligible.toLocaleString('pt-BR')} FVC
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Ticket OMNI (fora)</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(omniEligible > 0 ? omniRevenue / omniEligible : 0)}</span>
              </div>
            </div>
          }
        />
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 12 }}>
        <strong style={{ fontWeight: 600 }}>* Observação:</strong> receita, pedidos, RPA e ticket médio consideram só o canal
        VD (pedidos Online e Presencial feitos por revendedores) e não incluem as estruturas FVC, assim como os gráficos
        desta tela.{' '}
        {fvcOut.orders > 0 && (
          <>
            Os {fvcOut.orders.toLocaleString('pt-BR')} pedidos FVC ({fmtBRL(fvcOut.revenue)}) têm tela própria em "FVC", com a
            participação deles e o faturamento total.{' '}
          </>
        )}
        {omniOrders > 0 ? (
          <>
            Também ficam de fora {omniOrders.toLocaleString('pt-BR')} pedido{omniOrders === 1 ? '' : 's'} do canal OMNI
            (Modelo - OMNIChannel), no valor de {fmtBRL(omniRevenue)}
            {omniConsumidorFinal === omniOrders
              ? ', todos de Consumidor Final'
              : `, ${omniConsumidorFinal.toLocaleString('pt-BR')} deles de Consumidor Final`}
            : o cliente que compra direto, sem ser revendedor, e por isso não conta como revendedor ativo no RPA.
            Esses pedidos aparecem à parte no detalhe de cada card e como "Consumidor Final*" em Receita por tier.
          </>
        ) : (
          'Não há pedidos do canal OMNI (Consumidor Final) no recorte atual.'
        )}
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
            breakdownLabel="Top compradores do tier"
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
