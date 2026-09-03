import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingList from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName, listLojasInDimension } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtPct } from '../../utils/formatters';

const LojaCategoriasScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [lojaFiltro, setLojaFiltro] = useState<string>('');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver as categorias.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const lojas = listLojasInDimension(dataset.gestao);
  const categorias = aggregateByName(dataset.gestao, true, lojaFiltro || null);
  const anomalias = categorias.filter(c => c.descontoPct > 100);
  const receitaCategoria = dataset.receitaCategoria;
  const hasXlsx = !!receitaCategoria && receitaCategoria.categoria.length > 0;

  const items = categorias.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${r.descontoPct.toFixed(0)}% desc.`,
  }));

  const xlsxItems = hasXlsx ? receitaCategoria!.categoria.map(r => ({
    label: r.nome,
    value: r.receitaAtual,
    valueLabel: fmtBRLshort(r.receitaAtual),
    meta: `${fmtPct(r.variacaoPct)} vs. ano ant.`,
  })) : [];

  const maioresVariacoes = hasXlsx
    ? [...receitaCategoria!.categoria].sort((a, b) => Math.abs(b.variacaoPct) - Math.abs(a.variacaoPct)).slice(0, 8)
    : [];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Mix de categoria e linha de produto
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
      <p style={{ color: '#6B6258', fontSize: 12, margin: '4px 0 24px' }}>
        O filtro de loja se aplica ao ranking "gestão estratégica" (abaixo); a receita por categoria/subcategoria/marca do xlsx é sempre rede toda.
      </p>

      {hasXlsx ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
            <ChartCard title="Receita por categoria" subtitle="Ciclo atual, com variação vs. ano anterior (Receita_por_Cat_Sub_Mar)">
              <RankingList items={xlsxItems} />
            </ChartCard>
            <ChartCard title="Maiores variações" subtitle="Positivas e negativas vs. ano anterior">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {maioresVariacoes.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F2EEE2', paddingBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: c.variacaoPct >= 0 ? '#2E7D5B' : '#B83A3A' }}>
                      {fmtPct(c.variacaoPct)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
          {(receitaCategoria!.subcategoria.length > 0 || receitaCategoria!.marca.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
              {receitaCategoria!.subcategoria.length > 0 && (
                <ChartCard title="Top subcategorias" subtitle="Por receita no ciclo">
                  <RankingList medals={false} items={receitaCategoria!.subcategoria.slice(0, 8).map(r => ({
                    label: r.nome, value: r.receitaAtual, valueLabel: fmtBRLshort(r.receitaAtual), meta: fmtPct(r.variacaoPct),
                  }))} />
                </ChartCard>
              )}
              {receitaCategoria!.marca.length > 0 && (
                <ChartCard title="Top marcas" subtitle="Por receita no ciclo">
                  <RankingList medals={false} items={receitaCategoria!.marca.slice(0, 8).map(r => ({
                    label: r.nome, value: r.receitaAtual, valueLabel: fmtBRLshort(r.receitaAtual), meta: fmtPct(r.variacaoPct),
                  }))} />
                </ChartCard>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ background: '#FBF3D0', border: '1px solid #E8C547', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#5C4500' }}>
          Arquivo Receita_por_Cat_Sub_Mar.xlsx não importado — mostrando visão sem comparativo anual, a partir do CSV de gestão estratégica por loja.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard title="Ranking de categorias (gestão estratégica)" subtitle="Por GMV, com % de desconto sobre a receita — granularidade por loja">
          <RankingList items={items} />
        </ChartCard>

        <ChartCard title="Anomalias" subtitle="Desconto acima da receita líquida">
          {anomalias.length === 0 ? (
            <div style={{ color: '#6B6258', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-check-circle" style={{ color: '#2E7D5B', fontSize: 18 }} />
              Nenhuma anomalia de desconto encontrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {anomalias.map((a, i) => (
                <div key={i} style={{ background: '#FBE5E9', border: '1px solid #F0A8B3', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#5C0F1A' }}>{a.key}</div>
                  <div style={{ fontSize: 12, color: '#8A1426', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    Desconto {a.descontoPct.toFixed(0)}% da receita líquida
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaCategoriasScreen;
