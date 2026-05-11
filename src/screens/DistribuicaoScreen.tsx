import React, { useState, useEffect } from 'react';
import { useFinancialMetrics } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';
import { TIER_DEFINITIONS, TIER_STYLES } from '../design-system/tierStyles';
import { fmtBRLshort, fmtBRL } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import TierPieChart from '../components/charts/TierPieChart';
import DailyCycleChart from '../components/charts/DailyCycleChart';
import KpiCard from '../components/ui/KpiCard';
import Button from '../components/ui/Button';

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
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-chart-pie" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
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

  const activeTiersInChart = selectedTiers.filter(id =>
    Object.values(financial.revenueByDayAndTier).some(d => (d[id] ?? 0) > 0)
  );

  const hasActiveFilters = filterCycle !== null || selectedTiers.length < TIER_IDS_CHART.length;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Análise
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Distribuição
          </h1>
        </div>
        {fileName && (
          <div style={{ fontSize: 12, color: '#6B6258', fontFamily: 'JetBrains Mono, monospace' }}>
            {fileName}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginTop: 16, padding: '10px 14px',
        background: '#FAF7F2', borderRadius: 10, border: '1px solid #E8E2D6',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B6258', flexShrink: 0 }}>
          Filtros
        </span>

        {/* Cycle filter */}
        {availableCycles.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#9B9287' }}>Ciclo:</span>
            <button
              onClick={() => setFilter('cycle', null)}
              style={{
                padding: '3px 10px', borderRadius: 6, border: '1px solid',
                fontSize: 11, cursor: 'pointer', fontWeight: filterCycle === null ? 700 : 400,
                borderColor: filterCycle === null ? '#C9A227' : '#D8D0C0',
                background: filterCycle === null ? '#FFF8E6' : 'white',
                color: filterCycle === null ? '#C9A227' : '#3D362E',
              }}
            >Todos</button>
            {availableCycles.map(cycle => (
              <button
                key={cycle}
                onClick={() => setFilter('cycle', filterCycle === cycle ? null : cycle)}
                style={{
                  padding: '3px 10px', borderRadius: 6, border: '1px solid',
                  fontSize: 11, cursor: 'pointer', fontWeight: filterCycle === cycle ? 700 : 400,
                  borderColor: filterCycle === cycle ? '#C9A227' : '#D8D0C0',
                  background: filterCycle === cycle ? '#FFF8E6' : 'white',
                  color: filterCycle === cycle ? '#C9A227' : '#3D362E',
                }}
              >{cycle}</button>
            ))}
          </div>
        )}

        {/* Tier toggle chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#9B9287' }}>Tier:</span>
          {tierPieData.map(t => {
            const style = TIER_STYLES[t.tierId];
            const active = selectedTiers.includes(t.tierId);
            return (
              <button
                key={t.tierId}
                onClick={() => toggleTier(t.tierId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 6, border: '1px solid',
                  fontSize: 11, cursor: 'pointer',
                  borderColor: active ? (style?.accent ?? '#C9A227') : '#D8D0C0',
                  background: active ? `${style?.accent ?? '#C9A227'}18` : 'white',
                  color: active ? (style?.accent ?? '#C9A227') : '#9B9287',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 150ms',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: active ? (style?.accent ?? '#C9A227') : '#D8D0C0',
                  flexShrink: 0,
                }} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            onClick={() => { setFilter('cycle', null); setSelectedTiers(TIER_IDS_CHART); }}
            style={{
              marginLeft: 'auto', padding: '3px 10px', borderRadius: 6,
              border: '1px solid #D8D0C0', fontSize: 11, cursor: 'pointer',
              background: 'white', color: '#6B6258',
            }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Info panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
        <KpiCard
          eyebrow="Receita Total"
          value={fmtBRLshort(grandTotal)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(grandTotal)}</span>}
        />
        <KpiCard
          eyebrow="Dia de Pico"
          value={peakDay.day !== '-' ? `Dia ${peakDay.day}` : '—'}
          tooltip={peakDay.day !== '-'
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: '#9B9287' }}>Receita do dia</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(peakDay.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: '#9B9287' }}>vs. média</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2E7D5B' }}>
                    +{avgDaily > 0 ? ((peakDay.total / avgDaily - 1) * 100).toFixed(0) : '0'}%
                  </span>
                </div>
              </div>
            : undefined}
        />
        <KpiCard
          eyebrow="Média Diária"
          value={fmtBRLshort(avgDaily)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(avgDaily)}</span>}
        />
        <KpiCard
          eyebrow="Tier Líder"
          value={topTier?.name ?? '—'}
          tooltip={topTier && topTierEntry
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: '#9B9287' }}>Receita</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(topTierEntry[1])}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                  <span style={{ color: '#9B9287' }}>Share</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: topTierStyle?.accent ?? '#C9A227' }}>
                    {grandTotal > 0 ? ((topTierEntry[1] / grandTotal) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                  </span>
                </div>
              </div>
            : undefined}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 14 }}>
        {/* Pie */}
        <ChartCard title="Receita por tier" subtitle={`Total ${fmtBRLshort(filteredPieTotal)}`}>
          {filteredTierPieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <TierPieChart data={filteredTierPieData} size={180} hoverReveal />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, flex: 1 }}>
                {filteredTierPieData.map(t => {
                  const pct = filteredPieTotal > 0 ? (t.value / filteredPieTotal) * 100 : 0;
                  const style = TIER_STYLES[t.tierId];
                  return (
                    <div key={t.tierId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                        background: style?.accent ?? '#6B6258',
                        boxShadow: t.tierId === 'diamante' ? '0 0 4px rgba(107,125,217,0.6)' : 'none',
                      }} />
                      <span style={{ flex: 1, color: '#3D362E' }}>{t.label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                        {pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #F2EEE6', fontSize: 10, color: '#9B9287' }}>
                  Passe o cursor para revelar os valores
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9287' }}>
              Sem dados
            </div>
          )}
        </ChartCard>

        {/* Daily cycle chart */}
        <ChartCard title="Receita diária por tier" subtitle="Evolução da receita pelos dias do ciclo">
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
                  <span style={{ color: '#3D362E', fontWeight: 500 }}>{t?.name}</span>
                </div>
              );
            })}
            {/* Total legend entry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={18} height={2} style={{ overflow: 'visible' }}>
                <line x1={0} y1={1} x2={18} y2={1} stroke="#3D362E" strokeWidth={2.5} strokeDasharray="5 3" />
              </svg>
              <span style={{ color: '#3D362E', fontWeight: 600 }}>Faturamento Geral</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default DistribuicaoScreen;
