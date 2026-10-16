import React, { useMemo, useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtNumber } from '../../utils/formatters';
import { pillBtn } from './pillBtn';
import { exportToCSV } from '../../services/exportService';
import GlossarioPanel from './GlossarioPanel';

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

const fmtPctBR = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ margin: '8px 0 14px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>{title}</h2>
      <div style={{ fontSize: 13, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

type ColocGroup = 'campanha' | 'categoria' | 'pdv';

const VDSellInScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const [pdvFilter, setPdvFilter] = useState<string | null>(null);
  const [colocGroup, setColocGroup] = useState<ColocGroup>('campanha');

  const meta = dataset?.sellInMeta?.[0];
  const detalhe = dataset?.sellInDetalheSku ?? [];
  const pdvs = Array.from(new Set(detalhe.map(d => d.pdvCodigo))).sort();
  const filtered = pdvFilter ? detalhe.filter(d => d.pdvCodigo === pdvFilter) : detalhe;

  const visaoGeral = dataset?.pedidosVisaoGeral?.[0] ?? null;
  const giroVD = dataset?.pedidosGiro?.find(g => g.canal.toUpperCase() === 'VD') ?? null;
  const giroGeral = dataset?.pedidosGiro?.find(g => g.canal.toUpperCase() === 'GERAL') ?? null;
  const colocacao = useMemo(() => dataset?.pedidosColocacao ?? [], [dataset]);
  const aderencia = dataset?.aderencia ?? null;
  // Só os PDVs da Venda Direta: o arquivo de aderência traz também as lojas (ver hint do card).
  const pdvsVD = new Set([
    ...(dataset?.receitaCanalVDPdv ?? []).map(r => r.pdvCodigo),
    ...colocacao.map(r => r.pdv),
    ...detalhe.map(r => r.pdvCodigo),
  ].filter((p): p is string => !!p));
  const aderenciaPdvs = (aderencia?.pdv ?? []).filter(r => pdvsVD.has(r.nome));

  const colocacaoAgrupada = useMemo(() => {
    const map = new Map<string, { key: string; skus: number; sugestao: number; colocado: number; faturado: number }>();
    for (const r of colocacao) {
      const key = (colocGroup === 'pdv' ? r.pdv : colocGroup === 'categoria' ? r.categoria : r.campanha) || '—';
      const g = map.get(key) ?? { key, skus: 0, sugestao: 0, colocado: 0, faturado: 0 };
      g.skus += 1;
      g.sugestao += r.volumeSugestao;
      g.colocado += r.volumeColocado;
      g.faturado += r.volumeFaturado;
      map.set(key, g);
    }
    return [...map.values()]
      .map(g => ({
        ...g,
        colocacaoPct: g.sugestao > 0 ? (g.colocado / g.sugestao) * 100 : null,
        atendimentoPct: g.colocado > 0 ? (g.faturado / g.colocado) * 100 : null,
      }))
      .sort((a, b) => b.sugestao - a.sugestao);
  }, [colocacao, colocGroup]);

  const skusNaoColocados = useMemo(() => colocacao
    .filter(r => r.volumeSugestao - r.volumeColocado > 0)
    .sort((a, b) => (b.volumeSugestao - b.volumeColocado) - (a.volumeSugestao - a.volumeColocado))
    .slice(0, 10), [colocacao]);

  if (!meta && detalhe.length === 0 && !visaoGeral && colocacao.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-package" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de Sell-In</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Sell-In é a reposição de estoque do franqueado junto à indústria — domínio que não existe
          nos pedidos ao consumidor final. Importe os arquivos de Gestão de Pedidos / Meta Sell-In.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const atingimentoGeral = meta && meta.sugestaoComercial > 0 ? (meta.pedidoRealizado / meta.sugestaoComercial) * 100 : 0;
  const skusAbaixoMeta = detalhe.filter(d => d.atingimentoMetaPct < 100).length;

  function exportDetalhe() {
    exportToCSV(
      filtered.map(r => ({
        PDV: r.pdvCodigo, 'Código SKU': r.skuCodigo, 'Descrição SKU': r.skuDescricao, Marca: r.marca,
        'Sugestão Comercial': r.sugestaoComercial, 'Pedido Realizado': r.pedidoRealizado, '% Atingimento': r.atingimentoMetaPct,
      })),
      `datalens-sellin-detalhamento-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Sell-In &amp; Reposição</h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        Reposição de estoque do franqueado junto à indústria — não confundir com vendas ao consumidor final (Sell-Out).
      </p>

      {(visaoGeral || giroVD) && (
        <>
          <SectionTitle
            title="Gestão de pedidos do ciclo"
            sub="Do que o sistema sugeriu pedir até o que de fato vendeu — em unidades, todos os SKUs das campanhas do ciclo (não só os da meta de Sell-In, mais abaixo)."
          />
          {visaoGeral && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <KpiCard
                eyebrow="Sugestão de pedido"
                value={fmtNumber(visaoGeral.metaSugestao)}
                footnote="unidades"
                hint="Coluna 'META SUGESTÃO DE PEDIDOS' de GestaoPedidos_Visao_Geral_por_Ciclo.csv — o quanto o sistema sugeriu o franqueado pedir neste ciclo. É maior que a 'Sugestão comercial' da meta de Sell-In, mais abaixo, porque cobre todos os SKUs das campanhas (o arquivo de meta Sell-In só traz os SKUs com meta)."
              />
              <KpiCard
                eyebrow="Pedido realizado"
                value={fmtNumber(visaoGeral.pedidoRealizado)}
                footnote={visaoGeral.metaSugestao > 0 ? `${fmtPctBR((visaoGeral.pedidoRealizado / visaoGeral.metaSugestao) * 100)} da sugestão` : 'unidades'}
                hint="Coluna 'PEDIDO REALIZADO' — o que o franqueado de fato pediu (o histórico por SKU chama de 'volume colocado'). O % é calculado por nós: pedido ÷ sugestão."
              />
              <KpiCard
                eyebrow="Pedido faturado"
                value={fmtNumber(visaoGeral.pedidoFaturado)}
                footnote={visaoGeral.pedidoRealizado > 0 ? `${fmtPctBR((visaoGeral.pedidoFaturado / visaoGeral.pedidoRealizado) * 100)} do pedido` : 'unidades'}
                hint="Coluna 'PEDIDO FATURADO' — o que a indústria faturou (entregou) do que foi pedido. O % é o atendimento: faturado ÷ pedido."
              />
              <KpiCard
                eyebrow="Venda real · giro"
                value={fmtNumber(visaoGeral.vendaReal)}
                footnote={`giro de ${fmtPctBR(visaoGeral.giroPct)}`}
                hint="Colunas 'VENDA REAL' e 'GIRO' — quanto do que foi faturado já foi vendido às revendedoras. Giro = venda real ÷ pedido faturado (vem pronto do arquivo e confere com a conta)."
              />
            </div>
          )}
          {giroVD && (
            <div style={{ fontSize: 13, color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 20 }}>
              Giro do canal VD: <strong style={{ color: 'var(--vd-ink, #1C1814)' }}>{fmtPctBR(giroVD.giroPct)}</strong>
              {' '}({fmtNumber(giroVD.volumeFaturado)} vendidas de {fmtNumber(giroVD.volumePedido)} faturadas)
              {giroGeral && (
                <> · rede inteira, com as lojas: <strong style={{ color: 'var(--vd-ink, #1C1814)' }}>{fmtPctBR(giroGeral.giroPct)}</strong></>
              )}
              <span title="GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo.csv. Atenção: neste arquivo 'VOLUME PEDIDO' é o volume faturado e 'VOLUME FATURADO' é a venda real da Visão geral — os nomes das colunas mudam de um arquivo para o outro, os números são os mesmos." style={{ marginLeft: 6, cursor: 'help' }}>
                <i className="ph ph-info" />
              </span>
            </div>
          )}
        </>
      )}

      {colocacao.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Colocação do pedido"
            subtitle="Sugestão × pedido × faturado, por campanha, categoria ou PDV"
            hint="GestaoPedidos_Historico_Colocacao_Pedido.csv — uma linha por PDV × SKU das campanhas do ciclo. Colocação = pedido ÷ sugestão (passa de 100% quando o franqueado pede mais que o sugerido, comum em amostras e suporte à venda). Atendimento = faturado ÷ pedido. A soma das linhas bate com a Visão geral acima."
            action={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['campanha', 'categoria', 'pdv'] as const).map(g => (
                  <button key={g} onClick={() => setColocGroup(g)} className={`glossy-btn${colocGroup === g ? ' glossy-active' : ''}`} style={pillBtn(colocGroup === g)}>
                    <GlossyContent compact>{{ campanha: 'Campanha', categoria: 'Categoria', pdv: 'PDV' }[g]}</GlossyContent>
                  </button>
                ))}
              </div>
            }
          >
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{{ campanha: 'Campanha', categoria: 'Categoria', pdv: 'PDV' }[colocGroup]}</th>
                    <th style={{ ...th, textAlign: 'right' }}>SKUs</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sugestão</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedido</th>
                    <th style={{ ...th, textAlign: 'right' }}>Faturado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Colocação</th>
                    <th style={{ ...th, textAlign: 'right' }}>Atendimento</th>
                  </tr>
                </thead>
                <tbody>
                  {colocacaoAgrupada.map(r => (
                    <tr key={r.key}>
                      <td style={td}>{colocGroup === 'pdv' ? `PDV ${r.key}` : r.key}</td>
                      <td style={tdNum}>{fmtNumber(r.skus)}</td>
                      <td style={tdNum}>{fmtNumber(r.sugestao)}</td>
                      <td style={tdNum}>{fmtNumber(r.colocado)}</td>
                      <td style={tdNum}>{fmtNumber(r.faturado)}</td>
                      <td style={{ ...tdNum, color: r.colocacaoPct !== null && r.colocacaoPct < 90 ? 'var(--vd-danger, #B83A3A)' : undefined, fontWeight: 600 }}>
                        {r.colocacaoPct !== null ? fmtPctBR(r.colocacaoPct) : '—'}
                      </td>
                      <td style={tdNum}>{r.atendimentoPct !== null ? fmtPctBR(r.atendimentoPct) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {skusNaoColocados.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  Maiores faltas de pedido (sugestão − pedido), por SKU e PDV
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {skusNaoColocados.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, borderBottom: '1px solid var(--vd-border, #E8E2D6)', paddingBottom: 5 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${r.produto} · ${r.campanha}`}>
                        <span style={{ color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', marginRight: 6 }}>PDV {r.pdv}</span>
                        {r.produto}
                        <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}> · {r.campanha}</span>
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                        {fmtNumber(r.volumeColocado)} de {fmtNumber(r.volumeSugestao)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {aderencia && (aderenciaPdvs.length > 0 || aderencia.semanal.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Aderência do pedido por curva"
            subtitle="Quanto do pedido sugerido para cada curva de produtos (A, B, C, E) foi seguido"
            hint="GestaoPedidos_Aderência_por_Categoria.xlsx + GestaoPedidos_Histórico_de_Aderência.xlsx. Curva A são os produtos que mais vendem; E, os de menor giro. Atenção: a Extranet ignora o filtro de canal nesses dois arquivos — eles trazem os mesmos números do Modo Loja, com todos os PDVs do CP. Por isso a tabela mostra só os PDVs da Venda Direta; a linha 'CP' e a evolução semanal/mensal misturam lojas e VD."
          >
            <div style={{ display: 'grid', gridTemplateColumns: aderencia.semanal.length > 0 ? '1.3fr 1fr' : '1fr', gap: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', alignSelf: 'start' }}>
                <thead>
                  <tr>
                    <th style={th}>PDV</th>
                    {(['A', 'B', 'C', 'E'] as const).map(c => <th key={c} style={{ ...th, textAlign: 'right' }}>Curva {c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...aderenciaPdvs, ...aderencia.cp.map(r => ({ ...r, nome: `CP ${r.nome} (lojas + VD)` }))].map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, color: r.nome.startsWith('CP') ? 'var(--vd-text-secondary, #6B6258)' : undefined }}>{r.nome.startsWith('CP') ? r.nome : `PDV ${r.nome}`}</td>
                      {[r.curvaA, r.curvaB, r.curvaC, r.curvaE].map((v, k) => (
                        <td key={k} style={{ ...tdNum, color: v !== null && v < 80 ? 'var(--vd-danger, #B83A3A)' : undefined }}>{v !== null ? fmtPctBR(v) : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {aderencia.semanal.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vd-text-muted, #9B9287)', marginBottom: 8 }}>
                    Evolução (CP inteiro)
                  </div>
                  {[...aderencia.semanal, ...aderencia.mensal, ...aderencia.anual].map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, marginBottom: 6 }}>
                      <span style={{ width: 84, flexShrink: 0 }}>{p.periodo}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--vd-bg-subtle, #F2EEE2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, p.aderenciaPct)}%`, height: '100%', background: 'var(--vd-accent, #C9A227)' }} />
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', width: 52, textAlign: 'right' }}>{fmtPctBR(p.aderenciaPct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      {(meta || detalhe.length > 0) && (visaoGeral || colocacao.length > 0) && (
        <SectionTitle title="Meta de Sell-In por SKU" sub="Os SKUs com meta de compra junto à indústria no ciclo." />
      )}


      {meta && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            eyebrow="Sugestão comercial"
            value={fmtNumber(meta.sugestaoComercial)}
            meta="unidades"
            hint="Coluna 'SUGESTÃO COMERCIAL' de GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv — 1 linha só, total da rede (soma os 2 PDVs), vinda pronta do sistema de origem."
          />
          <KpiCard
            eyebrow="Pedido realizado"
            value={fmtNumber(meta.pedidoRealizado)}
            meta="unidades"
            hint="Coluna 'PEDIDO REALIZADO' do mesmo arquivo e mesma linha — quanto o franqueado de fato pediu à indústria neste ciclo."
          />
          <KpiCard
            eyebrow="Atingimento da meta"
            value={`${atingimentoGeral.toFixed(1).replace('.', ',')}%`}
            delta={skusAbaixoMeta > 0 ? `${skusAbaixoMeta} SKU(s) abaixo de 100%` : 'Todos os SKUs na meta'}
            deltaDirection={skusAbaixoMeta > 0 ? 'down' : 'up'}
            hint="Calculado por nós (Pedido Realizado ÷ Sugestão Comercial × 100), não vem pronto do arquivo total — o arquivo de detalhamento por SKU já traz esse % pronto por linha, usado no delta."
          />
        </div>
      )}

      {detalhe.length > 0 && (
        <ChartCard
          title="Detalhamento por SKU"
          subtitle={`${filtered.length} de ${detalhe.length} linhas`}
          hint="GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv — grão Ciclo × PDV × SKU (8 SKUs × 2 PDVs = 16 linhas neste lote). A coluna 'SKU' vem como texto único '<código> - <nome>'; nós separamos o código do nome antes de exibir. '% Atingimento' é lido direto da coluna do arquivo, não recalculado."
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setPdvFilter(null)} className={`glossy-btn${pdvFilter === null ? ' glossy-active' : ''}`} style={pillBtn(pdvFilter === null)}>
                  <GlossyContent compact>Todos</GlossyContent>
                </button>
                {pdvs.map(pdv => (
                  <button key={pdv} onClick={() => setPdvFilter(pdv)} className={`glossy-btn${pdvFilter === pdv ? ' glossy-active' : ''}`} style={pillBtn(pdvFilter === pdv)}>
                    <GlossyContent compact>PDV {pdv}</GlossyContent>
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportDetalhe}>
                CSV
              </Button>
            </div>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>PDV</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Marca</th>
                  <th style={{ ...th, textAlign: 'right' }}>Sugestão</th>
                  <th style={{ ...th, textAlign: 'right' }}>Realizado</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.pdvCodigo}</td>
                    <td style={{ ...td, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.skuDescricao}>
                      <span style={{ color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginRight: 6 }}>{r.skuCodigo}</span>
                      {r.skuDescricao}
                    </td>
                    <td style={td}>{r.marca}</td>
                    <td style={tdNum}>{fmtNumber(r.sugestaoComercial)}</td>
                    <td style={tdNum}>{fmtNumber(r.pedidoRealizado)}</td>
                    <td style={{ ...tdNum, color: r.atingimentoMetaPct < 100 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-success, #2E7D5B)', fontWeight: 600 }}>
                      {r.atingimentoMetaPct.toFixed(1).replace('.', ',')}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
      {(visaoGeral || aderencia) && (
        <div style={{ marginTop: 20 }}>
          <GlossarioPanel termos={['giro', 'aderencia']} />
        </div>
      )}
    </div>
  );
};

export default VDSellInScreen;
