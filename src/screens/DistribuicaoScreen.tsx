import React, { useState, useEffect } from 'react';
import { useFinancialMetrics } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';
import { TIER_DEFINITIONS, TIER_STYLES } from '../design-system/tierStyles';
import { fmtBRLshort, fmtBRL } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import RankingChart from '../components/charts/RankingChart';
import { RankingItem } from '../components/charts/RankingList';
import DailyCycleChart from '../components/charts/DailyCycleChart';
import KpiCard from '../components/ui/KpiCard';
import Button from '../components/ui/Button';
import GlossyContent from '../components/ui/GlossyContent';

interface DistribuicaoScreenProps {
  onNavigate: (route: string) => void;
}

const TIER_IDS_CHART = ['diamante', 'esmeralda', 'rubi', 'ouro', 'platina'];

const DistribuicaoScreen: React.FC<DistribuicaoScreenProps> = ({ onNavigate }) => {
  const financial = useFinancialMetrics();
  const { fileName } = useOrderStore();
  const filterCycle = useFilterStore(s => s.cycle);
  const filterTier = useFilterStore(s => s.tier);
  const setFilter = useFilterStore(s => s.setFilter);

  // Local tier selection for chart visibility (independent of global tier filter)
  const [selectedTiers, setSelectedTiers] = useState<string[]>(TIER_IDS_CHART);

  // Reset local selections when data changes
  useEffect(() => {
    setSelectedTiers(TIER_IDS_CHART);
  }, [financial?.grossRevenue]);

  function toggleTier(tierId: string) {
    setSelectedTiers(prev =>
      prev.includes(tierId) ? prev.filter(t => t !== tierId) : [...prev, tierId]
    );
  }

  if (!financial) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}>
          <i className="ph ph-chart-pie" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe uma planilha de pedidos para visualizar a distribuição.
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

  // Daily stats for info panels
  const days = Object.keys(financial.revenueByDayAndTier)
    .filter(d => d !== '?')
    .sort((a, b) => parseInt(a) - parseInt(b));
  const dailyTotals = days.map(d => ({
    day: d,
    total: Object.values(financial.revenueByDayAndTier[d] ?? {}).reduce((s, v) => s + v, 0),
  }));
  const peakDay = dailyTotals.reduce((best, d) => d.total > best.total ? d : best, { day: '-', total: 0 });
  const avgDaily = days.length > 0 ? grandTotal / days.length : 0;
  const topTierEntry = Object.entries(financial.revenueByTier).sort((a, b) => b[1] - a[1])[0];
  const topTier = TIER_DEFINITIONS.find(t => t.id === topTierEntry?.[0]);
  const topTierStyle = topTier ? TIER_STYLES[topTier.id] : null;

  const availableCycles = Object.keys(financial.revenueByCycle).sort();

  const tierPieData = TIER_DEFINITIONS
    .filter(t => (financial.revenueByTier[t.id] ?? 0) > 0)
    .map(t => ({
      tierId: t.id,
      value: financial.revenueByTier[t.id] ?? 0,
      label: t.name,
    }));

  const filteredTierPieData = tierPieData.filter(t => selectedTiers.includes(t.tierId));
  const filteredPieTotal = filteredTierPieData.reduce((s, t) => s + t.value, 0);

  // Ordenado do tier que mais faturou pro que menos faturou — RankingChart não reordena sozinho
  // (outras telas dependem da ordem original, ex. cronológica), então quem monta um ranking real
  // precisa entregar os itens já na ordem certa.
  const tierRankingItems: RankingItem[] = [...filteredTierPieData].sort((a, b) => b.value - a.value).map(t => {
    const pct = filteredPieTotal > 0 ? (t.value / filteredPieTotal) * 100 : 0;
    return {
      label: t.label,
      value: t.value,
      valueLabel: fmtBRLshort(t.value),
      meta: `${pct.toFixed(1).replace('.', ',')}%`,
      tierId: t.tierId,
    };
  });

  const activeTiersInChart = selectedTiers.filter(id =>
    Object.values(financial.revenueByDayAndTier).some(d => (d[id] ?? 0) > 0)
  );

  const hasActiveFilters = !!filterCycle || selectedTiers.length < TIER_IDS_CHART.length;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
            Análise
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Distribuição
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginTop: 16, padding: '10px 14px',
        background: 'var(--vd-bg, #FAF7F2)', borderRadius: 10, border: '1px solid var(--vd-border, #E8E2D6)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', flexShrink: 0 }}>
          Filtros
        </span>

        {/* Cycle filter */}
        {availableCycles.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>Ciclo:</span>
            <button
              className={`glossy-btn${!filterCycle ? ' glossy-active' : ''}`}
              onClick={() => setFilter('cycle', null)}
              style={{ borderRadius: 6, fontSize: 11 }}
            >
              <GlossyContent compact>Todos</GlossyContent>
            </button>
            {availableCycles.map(cycle => {
              const active = filterCycle?.includes(cycle) ?? false;
              return (
                <button
                  key={cycle}
                  className={`glossy-btn${active ? ' glossy-active' : ''}`}
                  onClick={() => setFilter('cycle', active ? null : cycle)}
                  style={{ borderRadius: 6, fontSize: 11 }}
                >
                  <GlossyContent compact>{cycle}</GlossyContent>
                </button>
              );
            })}
          </div>
        )}

        {/* Tier toggle chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>Tier:</span>
          {tierPieData.map(t => {
            const style = TIER_STYLES[t.tierId];
            const active = selectedTiers.includes(t.tierId);
            return (
              <button
                key={t.tierId}
                className={`glossy-btn${active ? ' glossy-active' : ''}`}
                onClick={() => toggleTier(t.tierId)}
                style={{ borderRadius: 6, fontSize: 11 }}
              >
                <GlossyContent
                  compact
                  icon={<span style={{
                    width: 6, height: 6, borderRadius: 1,
                    background: style?.accent ?? '#C9A227',
                    flexShrink: 0,
                  }} />}
                >
                  {t.label}
                </GlossyContent>
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            className="glossy-btn"
            onClick={() => { setFilter('cycle', null); setSelectedTiers(TIER_IDS_CHART); }}
            style={{ marginLeft: 'auto', borderRadius: 6, fontSize: 11 }}
          >
            <GlossyContent compact>Limpar</GlossyContent>
          </button>
        )}
      </div>

      {/* Info panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
        <KpiCard
          eyebrow="Receita Total"
          value={fmtBRLshort(grandTotal)}
          hint="Soma da receita (Valor Praticado) de todos os pedidos elegíveis, considerando os filtros de ciclo e tier ativos."
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(grandTotal)}</span>}
        />
        <KpiCard
          eyebrow="Dia de Pico"
          value={peakDay.day !== '-' ? `Dia ${peakDay.day}` : '—'}
          hint="Dia do ciclo com a maior receita realizada no período filtrado."
          tooltip={peakDay.day !== '-'
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Receita do dia</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(peakDay.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>vs. média</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-success, #2E7D5B)' }}>
                    +{avgDaily > 0 ? ((peakDay.total / avgDaily - 1) * 100).toFixed(0) : '0'}%
                  </span>
                </div>
              </div>
            : undefined}
        />
        <KpiCard
          eyebrow="Média Diária"
          value={fmtBRLshort(avgDaily)}
          hint="Receita total dividida pelo número de dias com pedidos no ciclo filtrado."
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(avgDaily)}</span>}
        />
        <KpiCard
          eyebrow="Tier Líder"
          value={topTier?.name ?? '—'}
          hint="Tier com maior receita no período filtrado, e sua participação (share) sobre a receita total."
          tooltip={topTier && topTierEntry
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Receita</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(topTierEntry[1])}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>Share</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: topTierStyle?.accent ?? '#C9A227' }}>
                    {grandTotal > 0 ? ((topTierEntry[1] / grandTotal) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                  </span>
                </div>
              </div>
            : undefined}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 14 }}>
        {/* Pie / bar / mais + tela cheia */}
        <ChartCard
          title="Receita por tier"
          subtitle={`Total ${fmtBRLshort(filteredPieTotal)}`}
          hint="Participação de cada tier na receita total do período filtrado. Use os botões acima do gráfico para alternar entre barras, pizza e outras visualizações, ou abra em tela cheia para ver mais detalhes."
        >
          <RankingChart
            items={tierRankingItems}
            mode="vd"
            initialCategory="pie"
            medals={false}
            maxSlices={TIER_IDS_CHART.length}
            emptyMessage="Sem dados"
            accentColor={topTierStyle?.accent}
          />
        </ChartCard>

        {/* Daily cycle chart */}
        <ChartCard
          title="Receita diária por tier"
          subtitle="Evolução da receita pelos dias do ciclo"
          hint="Receita realizada em cada dia do ciclo, aberta por tier. A linha tracejada mostra o faturamento geral do dia."
        >
          <DailyCycleChart
            revenueByDayAndTier={financial.revenueByDayAndTier}
            topResellersByDay={financial.topResellersByDay}
            tierIds={activeTiersInChart}
            showTotal
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 11 }}>
            {activeTiersInChart.filter(id =>
              Object.values(financial.revenueByDayAndTier).some(d => (d[id] ?? 0) > 0)
            ).map(id => {
              const t = TIER_DEFINITIONS.find(x => x.id === id);
              const style = TIER_STYLES[id];
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 2, borderRadius: 1, background: style?.accent }} />
                  <span style={{ color: 'var(--vd-text-strong, #3D362E)', fontWeight: 500 }}>{t?.name}</span>
                </div>
              );
            })}
            {/* Total legend entry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={18} height={2} style={{ overflow: 'visible' }}>
                <line x1={0} y1={1} x2={18} y2={1} stroke="var(--vd-text-strong, #3D362E)" strokeWidth={2.5} strokeDasharray="5 3" />
              </svg>
              <span style={{ color: 'var(--vd-text-strong, #3D362E)', fontWeight: 600 }}>Faturamento Geral</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default DistribuicaoScreen;
