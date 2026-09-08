import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart, { ExtraStat } from '../../components/loja/RankingChart';
import { RankingItem } from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName, listLojasInDimension } from '../../analytics/lojaMetrics';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { ReceitaCategoriaRow } from '../../types/loja';
import PageTitle from '../../components/ui/PageTitle';
import { fmtBRLshort, fmtBRL, fmtPct } from '../../utils/formatters';

/**
 * Estatísticas extras (painel de detalhe em tela cheia) de uma categoria/subcategoria/marca — não
 * dá pra listar os produtos que mais venderam ali (o xlsx de Receita por Categoria não tem coluna
 * de produto, e a Curva ABC não tem coluna de categoria — nenhum arquivo cruza as duas), então o
 * detalhe usa o que já está calculado e sendo descartado: receita do ciclo anterior, participação
 * no total e posição no ranking.
 */
function makeReceitaCategoriaExtraStats(list: ReceitaCategoriaRow[]) {
  return (item: RankingItem): ExtraStat[] | null => {
    const idx = list.findIndex(r => r.nome === item.label);
    if (idx < 0) return null;
    const row = list[idx];
    return [
      { label: 'Receita ciclo anterior', value: fmtBRLshort(row.receitaAnterior) },
      { label: 'Variação vs. ano ant.', value: fmtPct(row.variacaoPct) },
      { label: 'Participação no total', value: row.participacaoPct.toFixed(1).replace('.', ',') + '%' },
      { label: 'Posição no ranking', value: `${idx + 1}º de ${list.length}` },
    ];
  };
}

const LojaCategoriasScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [lojaFiltro, setLojaFiltro] = useState<string>('');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver as categorias.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
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

  // A linha "BOTIK" de Receita_por_Cat_Sub_Mar.xlsx é sempre rede toda — mas Loja_cuidados_faciais_iaf.xlsx
  // traz exatamente essa mesma receita (bateu no cruzamento: R$ 11.617,02 nos dois arquivos) já aberta por
  // loja/consultor, então dá pra detalhar essa linha do mix sem precisar de outro arquivo.
  const botikLinha = hasXlsx ? receitaCategoria!.linha.find(r => r.nome.trim().toUpperCase() === 'BOTIK') : null;
  const cuidadosFaciais = dataset.cuidadosFaciais;
  const botikPorLoja = cuidadosFaciais ? [...cuidadosFaciais.pdv].sort((a, b) => b.receitaBotik - a.receitaBotik) : [];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Mix de categoria e linha de produto"
          hint="Como o GMV se distribui entre categorias, subcategorias, linhas e marcas de produto."
        />
        <select
          value={lojaFiltro}
          onChange={e => setLojaFiltro(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--loja-border, #E8E2D6)', background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)', cursor: 'pointer' }}
        >
          <option value="">Todas as lojas</option>
          {lojas.map(l => (
            <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nome}</option>
          ))}
        </select>
      </div>
      <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 12, margin: '4px 0 24px' }}>
        O filtro de loja se aplica ao ranking "gestão estratégica" (abaixo); a receita por categoria/subcategoria/marca do xlsx é sempre rede toda.
      </p>

      {hasXlsx ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
            <ChartCard glow
              title="Receita por categoria"
              hint="Receita de cada categoria de produto no ciclo atual, comparada com o mesmo ciclo do ano anterior (Receita_por_Cat_Sub_Mar.xlsx). Em tela cheia, clique numa categoria para ver receita do ciclo anterior, participação no total e posição no ranking."
              subtitle="Ciclo atual, com variação vs. ano anterior (Receita_por_Cat_Sub_Mar)"
            >
              <RankingChart items={xlsxItems} getExtraStats={makeReceitaCategoriaExtraStats(receitaCategoria!.categoria)} />
            </ChartCard>
            <ChartCard glow
              title="Maiores variações"
              hint="Categorias com a maior mudança percentual (para cima ou para baixo) na receita, comparando com o ano anterior."
              subtitle="Positivas e negativas vs. ano anterior"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {maioresVariacoes.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: c.variacaoPct >= 0 ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-danger, #B83A3A)' }}>
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
                <ChartCard glow
                  title="Top subcategorias"
                  hint="As subcategorias (recorte mais fino que categoria) com maior receita no ciclo. Em tela cheia, clique numa subcategoria para ver receita do ciclo anterior, participação no total e posição no ranking."
                  subtitle="Por receita no ciclo"
                >
                  <RankingChart medals={false} items={receitaCategoria!.subcategoria.slice(0, 8).map(r => ({
                    label: r.nome, value: r.receitaAtual, valueLabel: fmtBRLshort(r.receitaAtual), meta: fmtPct(r.variacaoPct),
                  }))} getExtraStats={makeReceitaCategoriaExtraStats(receitaCategoria!.subcategoria)} />
                </ChartCard>
              )}
              {receitaCategoria!.marca.length > 0 && (
                <ChartCard glow
                  title="Top marcas"
                  hint="As marcas de produto com maior receita no ciclo."
                  subtitle="Por receita no ciclo"
                >
                  <RankingChart medals={false} items={receitaCategoria!.marca.slice(0, 8).map(r => ({
                    label: r.nome, value: r.receitaAtual, valueLabel: fmtBRLshort(r.receitaAtual), meta: fmtPct(r.variacaoPct),
                  }))} />
                </ChartCard>
              )}
            </div>
          )}
          {botikLinha && botikPorLoja.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <ChartCard glow
                title={`Linha "BOTIK" — de onde vem a receita`}
                hint="Botik é uma linha/marca de produto. Esse total bate exatamente com o arquivo Loja_cuidados_faciais_iaf.xlsx, que traz a mesma receita já aberta por loja — por isso dá pra detalhar essa linha do mix aqui."
                subtitle={`${fmtBRL(botikLinha.receitaAtual)} no ciclo (${fmtPct(botikLinha.variacaoPct)} vs. ano ant.) — detalhado por loja via Loja_cuidados_faciais_iaf.xlsx`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {botikPorLoja.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>{resolveLojaNome(r.pdvCodigo, r.nome)}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)' }}>
                        {fmtBRLshort(r.receitaBotik)} <span style={{ color: 'var(--loja-text-muted, #9B9287)' }}>({botikLinha.receitaAtual > 0 ? ((r.receitaBotik / botikLinha.receitaAtual) * 100).toFixed(0) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          )}
        </>
      ) : (
        <div style={{ background: 'var(--loja-warning-bg, #FBF3D0)', border: '1px solid var(--loja-warning-border, #E8C547)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: 'var(--loja-warning-text, #5C4500)' }}>
          Arquivo Receita_por_Cat_Sub_Mar.xlsx não importado — mostrando visão sem comparativo anual, a partir do CSV de gestão estratégica por loja.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard glow
          title="Ranking de categorias (gestão estratégica)"
          hint="GMV — Gross Merchandise Value. Ranking de categorias pelo CSV de gestão estratégica (granularidade por loja, diferente do xlsx acima que é sempre rede toda)."
          subtitle="Por GMV, com % de desconto sobre a receita — granularidade por loja"
        >
          <RankingChart items={items} />
        </ChartCard>

        <ChartCard glow
          title="Anomalias"
          hint="Categorias onde o desconto total ultrapassa a receita líquida — normalmente indica erro de lançamento ou promoção muito agressiva."
          subtitle="Desconto acima da receita líquida"
        >
          {anomalias.length === 0 ? (
            <div style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-check-circle" style={{ color: 'var(--loja-success, #2E7D5B)', fontSize: 18 }} />
              Nenhuma anomalia de desconto encontrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {anomalias.map((a, i) => (
                <div key={i} style={{ background: 'var(--loja-danger-bg, #FBE5E9)', border: '1px solid var(--loja-danger-border, #F0A8B3)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--loja-danger-text-strong, #5C0F1A)' }}>{a.key}</div>
                  <div style={{ fontSize: 12, color: 'var(--loja-danger-text, #8A1426)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
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
