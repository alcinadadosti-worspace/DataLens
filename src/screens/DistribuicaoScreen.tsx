import React from 'react';
import { useFinancialMetrics } from '../hooks/useAnalytics';
import { useOrderStore } from '../store/useOrderStore';
import { TIER_DEFINITIONS, TIER_STYLES } from '../design-system/tierStyles';
import { fmtBRLshort } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import TierPieChart from '../components/charts/TierPieChart';
import DailyCycleChart from '../components/charts/DailyCycleChart';
import Button from '../components/ui/Button';

interface DistribuicaoScreenProps {
  onNavigate: (route: string) => void;
}

const TIER_IDS_CHART = ['diamante', 'esmeralda', 'rubi', 'ouro', 'platina'];

const DistribuicaoScreen: React.FC<DistribuicaoScreenProps> = ({ onNavigate }) => {
  const financial = useFinancialMetrics();
  const { fileName } = useOrderStore();

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

  const tierPieData = TIER_DEFINITIONS
    .filter(t => (financial.revenueByTier[t.id] ?? 0) > 0)
    .map(t => ({
      tierId: t.id,
      value: financial.revenueByTier[t.id] ?? 0,
      label: t.name,
    }));

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 28 }}>
        {/* Pie */}
        <ChartCard title="Receita por tier" subtitle={`Total ${fmtBRLshort(grandTotal)}`}>
          {tierPieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <TierPieChart data={tierPieData} size={180} hoverReveal />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, flex: 1 }}>
                {tierPieData.map(t => {
                  const pct = grandTotal > 0 ? (t.value / grandTotal) * 100 : 0;
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
            tierIds={TIER_IDS_CHART}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 11 }}>
            {TIER_IDS_CHART.filter(id =>
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
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default DistribuicaoScreen;
