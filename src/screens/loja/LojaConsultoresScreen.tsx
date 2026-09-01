import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingList from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtNumber } from '../../utils/formatters';

type View = 'consultor' | 'operador';

const LojaConsultoresScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [view, setView] = useState<View>('consultor');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver os consultores.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const rows = view === 'consultor' ? dataset.consultor : dataset.operador;
  const agg = aggregateByName(rows);

  const top = agg.slice(0, 5);
  const bottom = agg.slice(-5).reverse();

  const toItems = (list: typeof agg) => list.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${fmtNumber(r.qtdBoletos)} boletos`,
  }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Desempenho individual
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6, background: '#F2EEE2', borderRadius: 10, padding: 4 }}>
          {(['consultor', 'operador'] as View[]).map(v => (
            <button
              key={v}
              className={`glossy-btn${view === v ? ' glossy-active' : ''}`}
              onClick={() => setView(v)}
              style={{ borderRadius: 8, fontSize: 13 }}
            >
              <GlossyContent compact>{v === 'consultor' ? 'Consultor' : 'Operador'}</GlossyContent>
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: '#6B6258', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
        Consultor e Operador refletem a mesma pessoa em papéis diferentes do sistema — as visões são quase idênticas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Top performers" subtitle="Maior GMV no ciclo">
          <RankingList items={toItems(top)} />
        </ChartCard>
        <ChartCard title="Atenção" subtitle="Menor GMV no ciclo">
          <RankingList items={toItems(bottom)} medals={false} />
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaConsultoresScreen;
