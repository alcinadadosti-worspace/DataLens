import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
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
  const pico = buckets.reduce((best, b) => (b.receitaLiquida > (best?.receitaLiquida ?? -1) ? b : best), buckets[0]);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <PageTitle
        eyebrow="Modo Loja"
        title="Padrão de vendas por horário"
        hint="Em que faixas de horário do dia a rede vende mais — útil para dimensionar escala de consultores e definir janelas de promoção."
      />
      <div style={{ marginBottom: 24 }} />

      <ChartCard
        title="Receita líquida por faixa horária"
        subtitle="Soma de todas as lojas e dias do período importado"
        hint="Receita líquida: receita já descontando trocas/devoluções, somada de todas as lojas para cada faixa de horário do dia — mostra em que horário o movimento de vendas é mais forte."
      >
        <RankingChart
          items={buckets.map(b => ({
            label: b.faixaHoraria,
            value: b.receitaLiquida,
            valueLabel: fmtBRLshort(b.receitaLiquida),
            meta: `${fmtNumber(b.qtdBoletos)} bol.`,
          }))}
          medals={false}
        />
      </ChartCard>

      {pico && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Leitura"
            hint="Interpretação automática do horário de pico, para embasar decisões de escala de equipe e janelas de promoção."
            subtitle="Para embasar decisões de escala e promoção"
          >
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
