import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import SimpleLineChart from '../../components/loja/SimpleLineChart';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { dailySeries, dayOfWeekAverages } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtBRL } from '../../utils/formatters';

const LojaPeriodoScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver a série temporal.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const daily = dailySeries(dataset.data);
  const points = daily.map(d => ({
    label: d.date ? `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}` : d.dateLabel,
    value: d.gmv,
  }));

  const dow = dayOfWeekAverages(daily);
  const dowMax = Math.max(...dow.map(d => d.avgGmv), 1);

  const bestDay = daily.length > 0 ? daily.reduce((a, b) => (b.gmv > a.gmv ? b : a)) : null;
  const bestDow = dow.reduce((a, b) => (b.avgGmv > a.avgGmv ? b : a), dow[0]);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
        Modo Loja
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>
        Série temporal
      </h1>

      <ChartCard title="GMV por dia" subtitle="Somado entre as 6 lojas do grupo">
        <SimpleLineChart points={points} color="#B26A3C" formatValue={fmtBRLshort} />
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard title="Média por dia da semana" subtitle="Comportamento sazonal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dow.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, fontSize: 12, color: d.label === 'Domingo' ? '#5B9BD5' : '#6B6258', fontWeight: d.label === 'Domingo' ? 600 : 400 }}>{d.label}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F2EEE6', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.max((d.avgGmv / dowMax) * 100, 1.5)}%`,
                    background: d.label === 'Domingo' ? '#A9CCE8' : d.label === bestDow?.label ? '#B26A3C' : '#D8D0C0', borderRadius: 4,
                  }} />
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#1C1814', fontWeight: 600 }}>
                  {fmtBRLshort(d.avgGmv)}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Leitura do período" subtitle="Destaques do ciclo">
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
