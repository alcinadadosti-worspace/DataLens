import React, { useMemo, useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import RankingChart from '../../components/charts/RankingChart';
import { RankingItem } from '../../components/charts/RankingList';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtBRL, fmtNumber, fmtPct } from '../../utils/formatters';
import { pillBtn } from './pillBtn';
import PdvDetailModal from './PdvDetailModal';
import { exportToCSV } from '../../services/exportService';
import { PerformancePdvSupervisorRow, VDReceitaCategoriaMixRow } from '../../types/vdCorporate';

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };
const pdvLink: React.CSSProperties = { color: 'var(--vd-accent, #B26A3C)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 };

const fmtPctBR = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

// Uma cor por macrocategoria do relatório de mix (mesma ordem do arquivo); "OUTROS" fica neutro.
const CATEGORIA_CORES: Record<string, string> = {
  PERFUMARIA: '#B26A3C',
  GIFTS: '#C9A227',
  'CUIDADOS DA PELE': '#5B8C6E',
  CABELOS: '#7A5C99',
  MAQUIAGEM: '#C0577A',
  OUTROS: '#B8AFA2',
};
const corCategoria = (c: string) => CATEGORIA_CORES[c.toUpperCase()] ?? '#8C8377';

function VarBadge({ pct }: { pct: number }) {
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: pct >= 0 ? 'var(--vd-success, #2E7D5B)' : 'var(--vd-danger, #B83A3A)' }}>
      {fmtPct(pct)}
    </span>
  );
}

/** Barra 100% empilhada com a participação de cada categoria na receita da linha. */
function MixBar({ row }: { row: VDReceitaCategoriaMixRow }) {
  const total = row.categorias.reduce((s, c) => s + c.participacaoPct, 0) || 1;
  return (
    <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--vd-bg-subtle, #F2EEE2)' }}>
      {row.categorias.filter(c => c.participacaoPct > 0).map(c => (
        <div
          key={c.categoria}
          title={`${c.categoria}: ${fmtPctBR(c.participacaoPct)} · ${fmtBRL(c.receita)}`}
          style={{ width: `${(c.participacaoPct / total) * 100}%`, background: corCategoria(c.categoria) }}
        />
      ))}
    </div>
  );
}

/** Nome de exibição de uma linha da aba SUPERVISOR: "13707 -" = pedidos de estrutura sem supervisor; nomes repetidos ganham "(2)", "(3)". */
function nomesSupervisor(rows: PerformancePdvSupervisorRow[]): string[] {
  const vistos = new Map<string, number>();
  return rows.map(r => {
    const semSupervisor = r.nome.match(/^(\d+)\s*-\s*$/);
    const base = semSupervisor ? `Sem supervisor · PDV ${semSupervisor[1]}` : r.nome;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
}

const VDPedidosMixScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const [openPdv, setOpenPdv] = useState<string | null>(null);
  const [perfTab, setPerfTab] = useState<'pdv' | 'supervisor'>('pdv');

  const arvore = dataset?.arvorePedidos ?? null;
  const performance = dataset?.performancePdvSupervisor ?? null;
  const distribuicao = dataset?.distribuicaoReceita ?? null;
  const mix = dataset?.receitaCategoriaMix ?? null;
  const unGmv = dataset?.receitaUnGmv ?? [];
  const receitaCiclo = dataset?.vdReceitaCiclo?.[0] ?? distribuicao?.cp[0] ?? null;

  const perfRows = useMemo(() => {
    const rows = performance?.[perfTab] ?? [];
    const semTotal = rows.filter(r => r.nome.toUpperCase() !== 'TOTAL');
    const nomes = perfTab === 'supervisor' ? nomesSupervisor(semTotal) : semTotal.map(r => r.nome);
    return semTotal
      .map((r, i) => ({
        ...r,
        exibicao: nomes[i],
        // Pedido médio calculado por nós (receita ÷ pedidos): o do arquivo, fora da linha TOTAL, divide
        // pela soma das faixas, que é maior que a quantidade de pedidos (ver hint da tabela).
        pedidoMedio: r.qtdPedidos > 0 ? r.receita / r.qtdPedidos : 0,
        acimaDeMilPct: (() => {
          const soma = r.faixas.reduce((s, f) => s + f.quantidade, 0);
          const acima = r.faixas.find(f => /maior|acima/i.test(f.faixa));
          return soma > 0 && acima ? (acima.quantidade / soma) * 100 : null;
        })(),
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [performance, perfTab]);

  const hasAnything = !!arvore || !!performance || !!distribuicao || !!mix || unGmv.length > 0;
  if (!dataset || !hasAnything) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-receipt" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de pedidos da Extranet</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe os relatórios VendaDireta (Árvore de Pedidos, Performance PDV/Supervisor, Distribuição da Receita) para ver esta tela.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const faixas = arvore?.faixas ?? [];
  const maxFaixa = Math.max(1, ...faixas.flatMap(f => [f.anterior, f.atual]));
  const tipoReceita = dataset.reportContexts.arvorePedidos?.tipoReceita ?? dataset.reportContexts.distribuicaoReceita?.tipoReceita ?? 'Receita GMV';

  // Leitura: a receita cresce pela quantidade de pedidos, pelo valor de cada pedido, ou pelos dois.
  let leitura: string | null = null;
  if (arvore?.totalPedidos && arvore.pedidoMedio && receitaCiclo) {
    const vp = arvore.totalPedidos.variacaoPct;
    const vm = arvore.pedidoMedio.variacaoPct;
    const vr = receitaCiclo.variacaoPct;
    const sobe = vr >= 0;
    const motor = Math.abs(vm) > Math.abs(vp) ? 'pelo valor de cada pedido' : 'pela quantidade de pedidos';
    leitura = `A receita ${sobe ? 'cresceu' : 'caiu'} ${fmtPct(vr).replace(/^[+-]/, '')} sobre o mesmo ciclo do ano passado, puxada mais ${motor}: `
      + `os pedidos variaram ${fmtPct(vp)} e o pedido médio, ${fmtPct(vm)} (de ${fmtBRL(arvore.pedidoMedio.anterior)} para ${fmtBRL(arvore.pedidoMedio.atual)}).`;
    const maiorAlta = [...faixas].sort((a, b) => (b.atual - b.anterior) - (a.atual - a.anterior))[0];
    const maiorQueda = [...faixas].sort((a, b) => (a.atual - a.anterior) - (b.atual - b.anterior))[0];
    if (maiorAlta && maiorQueda && maiorAlta.atual > maiorAlta.anterior && maiorQueda.atual < maiorQueda.anterior) {
      leitura += ` A faixa que mais ganhou pedidos foi "${maiorAlta.nome}" (+${fmtNumber(maiorAlta.atual - maiorAlta.anterior)}); a que mais perdeu, "${maiorQueda.nome}" (${fmtNumber(maiorQueda.atual - maiorQueda.anterior)}).`;
    }
  }

  const unTotal = unGmv.reduce((s, r) => s + r.receita, 0);
  const unItems: RankingItem[] = unGmv.map(r => ({
    id: r.un, label: r.un, value: r.receita, valueLabel: fmtBRL(r.receita),
    meta: unTotal > 0 ? fmtPctBR((r.receita / unTotal) * 100) : undefined,
  }));

  const mixRows = mix ? [...mix.cp.map(r => ({ ...r, nome: `CP ${r.nome}` })), ...mix.pdv] : [];
  const categoriasLegenda = mixRows[0]?.categorias.map(c => c.categoria) ?? [];

  function exportPerformance() {
    exportToCSV(
      perfRows.map(r => ({
        [perfTab === 'pdv' ? 'PDV' : 'Supervisor']: r.exibicao,
        Receita: r.receita, Pedidos: r.qtdPedidos, 'Pedido médio (receita ÷ pedidos)': Math.round(r.pedidoMedio * 100) / 100,
        ...Object.fromEntries(r.faixas.map(f => [f.faixa, f.quantidade])),
      })),
      `datalens-vd-performance-${perfTab}-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Pedidos &amp; Mix</h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        Quantos pedidos, de que tamanho, de quais marcas e categorias — {tipoReceita}, ciclo atual comparado ao mesmo ciclo do ano anterior.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {receitaCiclo && (
          <KpiCard
            eyebrow="Receita GMV"
            value={fmtBRL(receitaCiclo.atual)}
            delta={fmtPct(receitaCiclo.variacaoPct)}
            deltaDirection={receitaCiclo.variacaoPct >= 0 ? 'up' : 'down'}
            meta={`vs. ${fmtBRL(receitaCiclo.anterior)}`}
            hint="VendaDireta_Receita_por_Ciclo.xlsx (ou a linha do CP em VendaDireta_Distribuicao_da_Receita.xlsx) — receita GMV do canal VD. É uma base diferente da 'Receita Bruta' da tela Receita & Metas, por isso os valores não são iguais."
          />
        )}
        {arvore?.totalPedidos && (
          <KpiCard
            eyebrow="Pedidos"
            value={fmtNumber(arvore.totalPedidos.atual)}
            delta={fmtPct(arvore.totalPedidos.variacaoPct)}
            deltaDirection={arvore.totalPedidos.variacaoPct >= 0 ? 'up' : 'down'}
            meta={`vs. ${fmtNumber(arvore.totalPedidos.anterior)}`}
            hint="Linha TOTAL da aba PEDIDOS de VendaDireta_Arvore_De_Pedidos.xlsx — pedidos de revendedoras no ciclo."
          />
        )}
        {arvore?.pedidoMedio && (
          <KpiCard
            eyebrow="Pedido médio"
            value={fmtBRL(arvore.pedidoMedio.atual)}
            delta={fmtPct(arvore.pedidoMedio.variacaoPct)}
            deltaDirection={arvore.pedidoMedio.variacaoPct >= 0 ? 'up' : 'down'}
            meta={`vs. ${fmtBRL(arvore.pedidoMedio.anterior)}`}
            hint="Linha 'Pedido Médio' da Árvore de Pedidos — receita GMV ÷ pedidos. É o mesmo indicador chamado de 'ticket médio' nas telas que leem o ConsultaPedidos."
          />
        )}
        {arvore?.volumeItens && (
          <KpiCard
            eyebrow="Itens por pedido"
            value={arvore.volumeItens.atual.toFixed(2).replace('.', ',')}
            delta={fmtPct(arvore.volumeItens.variacaoPct)}
            deltaDirection={arvore.volumeItens.variacaoPct >= 0 ? 'up' : 'down'}
            meta={`vs. ${arvore.volumeItens.anterior.toFixed(2).replace('.', ',')}`}
            hint="Linha 'Volume de itens' da Árvore de Pedidos — média de itens por pedido."
          />
        )}
      </div>

      {leitura && (
        <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px', fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
          <i className="ph ph-lightbulb" style={{ color: 'var(--vd-accent, #C9A227)', marginRight: 8 }} />
          {leitura}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: faixas.length > 0 && unItems.length > 0 ? '1.3fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
        {faixas.length > 0 && (
          <ChartCard
            title="Pedidos por faixa de valor"
            subtitle="Quantidade de pedidos em cada faixa · ano anterior × atual"
            hint="Aba PEDIDOS de VendaDireta_Arvore_De_Pedidos.xlsx. As faixas somam o total de pedidos do ciclo. A barra clara é o mesmo ciclo do ano anterior; a escura, o ciclo atual."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faixas.map(f => (
                <div key={f.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{f.nome}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmtNumber(f.anterior)} → {fmtNumber(f.atual)} <VarBadge pct={f.variacaoPct} />
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--vd-bg-subtle, #F2EEE2)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ width: `${(f.anterior / maxFaixa) * 100}%`, height: '100%', background: 'var(--vd-border-strong, #D8D0C0)' }} />
                  </div>
                  <div style={{ height: 6, background: 'var(--vd-bg-subtle, #F2EEE2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(f.atual / maxFaixa) * 100}%`, height: '100%', background: 'var(--vd-accent, #C9A227)' }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {unItems.length > 0 && (
          <ChartCard
            title="Receita GMV por marca (UN)"
            subtitle="Ciclo atual"
            hint="VendaDireta_Receita_Por_UN.xlsx — só o ciclo atual. A variação contra o ano anterior por UN está em Receita & Metas ('Meta por UN'), em Receita Bruta."
          >
            <RankingChart items={unItems} mode="vd" medals={false} emptyMessage="Sem dados" />
          </ChartCard>
        )}
      </div>

      {performance && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Performance por PDV e por supervisor"
            subtitle="Receita GMV, pedidos e pedido médio"
            hint="VendaDireta_Performance_PDV_Supervisor.xlsx, abas PDV e SUPERVISOR. O pedido médio é calculado por nós (receita ÷ pedidos): nas linhas por PDV e por supervisor o arquivo traz um 'PEDIDO MÉDIO' e um 'ITENS POR PEDIDO' que dividem pela soma das colunas de faixa de valor — e essa soma é maior que a quantidade de pedidos (6.480 contra 3.817 no Ciclo 14), provavelmente porque o pedido é contado uma vez por marca. Por isso a coluna '> R$ 1.000' mostra a proporção dentro dessas faixas, não dos pedidos. Supervisores com o mesmo nome em duas estruturas aparecem numerados; '13707 -' são pedidos sem supervisor na estrutura."
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['pdv', 'supervisor'] as const).map(t => (
                    <button key={t} onClick={() => setPerfTab(t)} className={`glossy-btn${perfTab === t ? ' glossy-active' : ''}`} style={pillBtn(perfTab === t)}>
                      <GlossyContent compact>{t === 'pdv' ? 'Por PDV' : 'Por supervisor'}</GlossyContent>
                    </button>
                  ))}
                </div>
                <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportPerformance}>
                  CSV
                </Button>
              </div>
            }
          >
            <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{perfTab === 'pdv' ? 'PDV' : 'Supervisor'}</th>
                    {perfTab === 'pdv' && distribuicao && <th style={{ ...th, textAlign: 'right' }}>Ano anterior</th>}
                    <th style={{ ...th, textAlign: 'right' }}>Receita</th>
                    {perfTab === 'pdv' && distribuicao && <th style={{ ...th, textAlign: 'right' }}>Variação</th>}
                    <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Pedido médio</th>
                    <th style={{ ...th, textAlign: 'right' }}>&gt; R$ 1.000</th>
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map((r, i) => {
                    const dist = perfTab === 'pdv' ? distribuicao?.pdv.find(d => d.nome === r.nome) : undefined;
                    return (
                      <tr key={i}>
                        <td style={td}>
                          {perfTab === 'pdv' ? <span onClick={() => setOpenPdv(r.nome)} title="Ver PDV 360" style={pdvLink}>{r.nome}</span> : r.exibicao}
                        </td>
                        {perfTab === 'pdv' && distribuicao && <td style={tdNum}>{dist ? fmtBRL(dist.anterior) : '—'}</td>}
                        <td style={tdNum}>{fmtBRL(r.receita)}</td>
                        {perfTab === 'pdv' && distribuicao && <td style={tdNum}>{dist ? <VarBadge pct={dist.variacaoPct} /> : '—'}</td>}
                        <td style={tdNum}>{fmtNumber(r.qtdPedidos)}</td>
                        <td style={tdNum}>{fmtBRL(r.pedidoMedio)}</td>
                        <td style={tdNum}>{r.acimaDeMilPct !== null ? fmtPctBR(r.acimaDeMilPct) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      {mixRows.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Mix de categorias"
            subtitle="Participação de cada macrocategoria na receita · CP e por PDV"
            hint="VendaDireta_Distribuicao_da_receita_por_categoria.xlsx — 6 macrocategorias (a última, OUTROS, junta o resto), só o ciclo atual. Atenção: o arquivo declara 'Receita GMV', mas o total do CP (R$ 4,90 mi no Ciclo 14) é maior que a receita GMV dos outros relatórios (R$ 4,82 mi) — use para comparar a composição, não o valor absoluto. A quebra fina por categoria, subcategoria, linha e marca está em Receita & Metas."
          >
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
              {categoriasLegenda.map(c => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: corCategoria(c) }} />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mixRows.map(r => (
                <div key={r.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>
                      {r.nome.startsWith('CP') ? r.nome : <span onClick={() => setOpenPdv(r.nome)} title="Ver PDV 360" style={pdvLink}>PDV {r.nome}</span>}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-text-secondary, #6B6258)' }}>
                      {r.categorias.slice().sort((a, b) => b.participacaoPct - a.participacaoPct).slice(0, 2).map(c => `${c.categoria.charAt(0) + c.categoria.slice(1).toLowerCase()} ${fmtPctBR(c.participacaoPct)}`).join(' · ')}
                    </span>
                  </div>
                  <MixBar row={r} />
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      <PdvDetailModal pdvCodigo={openPdv} onClose={() => setOpenPdv(null)} />
    </div>
  );
};

export default VDPedidosMixScreen;
