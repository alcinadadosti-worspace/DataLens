import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import SimpleLineChart from '../../components/loja/SimpleLineChart';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import { useLojaStore } from '../../store/useLojaStore';
import { dailySeries, dayOfWeekAverages } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtBRL } from '../../utils/formatters';

const LojaPeriodoScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver a série temporal.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const daily = dailySeries(dataset.data);
  const points = daily.map(d => ({
    label: d.date ? `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}` : d.dateLabel,
    value: d.gmv,
  }));

  const dow = dayOfWeekAverages(daily);

  const bestDay = daily.length > 0 ? daily.reduce((a, b) => (b.gmv > a.gmv ? b : a)) : null;
  const bestDow = dow.reduce((a, b) => (b.avgGmv > a.avgGmv ? b : a), dow[0]);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <PageTitle
        eyebrow="Modo Loja"
        title="Série temporal"
        hint="Evolução do GMV (Gross Merchandise Value — valor total vendido) dia a dia no ciclo, e o padrão de sazonalidade por dia da semana."
      />
      <div style={{ marginBottom: 24 }} />

      <ChartCard
        title="GMV por dia"
        hint="GMV — Gross Merchandise Value: valor total vendido em cada dia do ciclo, somando todas as lojas."
        subtitle="Somado entre as 6 lojas do grupo"
      >
        <SimpleLineChart points={points} color="#B26A3C" formatValue={fmtBRLshort} />
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard
          title="Média por dia da semana"
          hint="GMV médio de cada dia da semana (segunda, terça...) ao longo do ciclo — mostra em que dias o movimento costuma ser mais forte."
          subtitle="Comportamento sazonal"
        >
          <RankingChart
            medals={false}
            items={dow.map(d => ({
              label: d.label,
              value: d.avgGmv,
              valueLabel: fmtBRLshort(d.avgGmv),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Leitura do período"
          hint="Destaques automáticos do ciclo: o melhor dia individual e o dia da semana com maior média de GMV."
          subtitle="Destaques do ciclo"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {bestDay && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.5 }}>
                <i className="ph ph-star" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                <span>
                  O melhor dia do ciclo foi <strong>{bestDay.dateLabel}</strong>, com {fmtBRL(bestDay.gmv)} em GMV.
                </span>
              </div>
            )}
            {bestDow && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.5 }}>
                <i className="ph ph-calendar-check" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>{bestDow.label}</strong> é o dia da semana com maior média de GMV, indicando o pico de fluxo do grupo.
                </span>
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaPeriodoScreen;
