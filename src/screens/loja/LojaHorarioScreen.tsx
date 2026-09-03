import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { hourlyDistribution } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtNumber } from '../../utils/formatters';

const LojaHorarioScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver o padrão por horário.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!dataset.vendaPorHora || dataset.vendaPorHora.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          O arquivo <strong>relatorioVendaPorHora</strong> não foi importado — distribuição por horário indisponível.
        </p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar arquivo</Button>
      </div>
    );
  }

  const buckets = hourlyDistribution(dataset.vendaPorHora);
  const max = Math.max(...buckets.map(b => b.receitaLiquida), 1);
  const pico = buckets.reduce((best, b) => (b.receitaLiquida > (best?.receitaLiquida ?? -1) ? b : best), buckets[0]);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
        Modo Loja
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>
        Padrão de vendas por horário
      </h1>

      <ChartCard title="Receita líquida por faixa horária" subtitle="Soma de todas as lojas e dias do período importado">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {buckets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 64, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#6B6258', flexShrink: 0 }}>
                {b.faixaHoraria}
              </div>
              <div style={{ flex: 1, height: 20, borderRadius: 6, background: '#F2EEE6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.max((b.receitaLiquida / max) * 100, 1.5)}%`, borderRadius: 6,
                  background: b === pico ? '#B26A3C' : '#D8D0C0',
                }} />
              </div>
              <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                {fmtBRLshort(b.receitaLiquida)}
              </div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 11, color: '#9B9287', flexShrink: 0 }}>
                {fmtNumber(b.qtdBoletos)} bol.
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {pico && (
        <div style={{ marginTop: 20 }}>
          <ChartCard title="Leitura" subtitle="Para embasar decisões de escala e promoção">
            <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.6 }}>
              <i className="ph ph-lightbulb" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
              <span>
                A faixa <strong>{pico.faixaHoraria}</strong> concentra o pico de receita líquida
                ({pico.participacaoPct.toFixed(1).replace('.', ',')}% do total), com {fmtNumber(pico.qtdBoletos)} boletos.
                Use esse padrão para dimensionar escala de consultores e definir janelas de promoção.
              </span>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaHorarioScreen;
