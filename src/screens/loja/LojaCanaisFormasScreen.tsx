import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingList from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName, listLojasInDimension } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtBRL, fmtPct } from '../../utils/formatters';

const LojaCanaisFormasScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [lojaFiltro, setLojaFiltro] = useState<string>('');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver canais e formas de pagamento.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const lojas = listLojasInDimension(dataset.canal);
  const canais = aggregateByName(dataset.canal, true, lojaFiltro || null);
  const formas = aggregateByName(dataset.forma, true, lojaFiltro || null);

  const toItems = (list: typeof canais) => list.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${r.participacaoPct.toFixed(1).replace('.', ',')}%`,
  }));

  const topCanal = canais[0];
  const topForma = formas[0];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Canais & formas de pagamento
          </h1>
        </div>
        <select
          value={lojaFiltro}
          onChange={e => setLojaFiltro(e.target.value)}
          style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E2D6', background: 'white', color: '#1C1814', cursor: 'pointer' }}
        >
          <option value="">Todas as lojas</option>
          {lojas.map(l => (
            <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nome}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Mix de canais de venda" subtitle="Participação no GMV do grupo">
          <RankingList items={toItems(canais)} />
        </ChartCard>
        <ChartCard title="Mix de formas de pagamento" subtitle="Participação no GMV recebido">
          <RankingList items={toItems(formas)} />
        </ChartCard>
      </div>

      {dataset.receitaCanal && dataset.receitaCanal.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard title="Receita por canal / UN — ciclo atual vs. anterior" subtitle={lojaFiltro ? 'Receita_por_Canal_UN.xlsx — sempre rede toda, esse arquivo não abre por loja' : 'Receita_por_Canal_UN.xlsx (GMV + Omni)'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dataset.receitaCanal.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F2EEE2', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{c.canal}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                    {fmtBRLshort(c.receitaAtual)} <span style={{ color: c.variacaoPct >= 0 ? '#2E7D5B' : '#B83A3A' }}>{fmtPct(c.variacaoPct)}</span>
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {topCanal && topForma && (
        <div style={{ marginTop: 20 }}>
        <ChartCard title="Leitura cruzada" subtitle="Canal vs. forma de pagamento">
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.6, marginTop: 12 }}>
            <i className="ph ph-lightbulb" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
            <span>
              O canal <strong>{topCanal.key}</strong> ({fmtBRL(topCanal.gmv)}) concentra a maior parte do faturamento,
              recebido majoritariamente via <strong>{topForma.key}</strong> ({topForma.participacaoPct.toFixed(1).replace('.', ',')}% do total).
              Compare os dois rankings para identificar se canais de experimentação (make/skin, calçada) têm mix de pagamento
              diferente da loja física — indício de perfil de cliente distinto.
            </span>
          </div>
        </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaCanaisFormasScreen;
