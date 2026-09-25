import React, { useMemo, useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { useFinancialMetrics } from '../../hooks/useAnalytics';
import { fmtBRL, fmtPct, fmtNumber } from '../../utils/formatters';
import { ReceitaPeriodoRow, VDReceitaCategoriaRow } from '../../types/vdCorporate';
import { pillBtn } from './pillBtn';
import CycleHistoryPanel from './CycleHistoryPanel';
import DataQualityPanel from './DataQualityPanel';
import GlossarioPanel from './GlossarioPanel';
import PdvDetailModal from './PdvDetailModal';
import { exportToCSV } from '../../services/exportService';

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

function VarBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600,
      color: positive ? 'var(--vd-success, #2E7D5B)' : 'var(--vd-danger, #B83A3A)',
    }}>
      {fmtPct(pct)}
    </span>
  );
}

const CATEGORIA_TABS = [
  { id: 'categoria', label: 'Categoria' },
  { id: 'subcategoria', label: 'Subcategoria' },
  { id: 'linha', label: 'Linha' },
  { id: 'marca', label: 'Marca' },
] as const;

const VDReceitaScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const financial = useFinancialMetrics();
  const [periodoTab, setPeriodoTab] = useState<'dia' | 'mes'>('dia');
  const [catTab, setCatTab] = useState<typeof CATEGORIA_TABS[number]['id']>('categoria');
  const [openPdv, setOpenPdv] = useState<string | null>(null);

  const pdvRows = dataset?.receitaCanalVDPdv ?? [];
  const totalRow = pdvRows.find(r => r.un.trim().toUpperCase() === 'TOTAL');
  const unRows = pdvRows.filter(r => r.un.trim().toUpperCase() !== 'TOTAL');

  const reconciliacao = useMemo(() => {
    if (!financial || !totalRow) return null;
    const ordersTotal = financial.grossRevenue;
    const biTotal = totalRow.total.receitaAtual;
    const diffPct = biTotal > 0 ? ((ordersTotal - biTotal) / biTotal) * 100 : 0;
    return { ordersTotal, biTotal, diffPct };
  }, [financial, totalRow]);

  if (!dataset || pdvRows.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-chart-bar" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de receita corporativa</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe os relatórios de Receita por PDV/UN/Período para ver esta tela.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const periodoRows: ReceitaPeriodoRow[] = dataset.receitaPeriodo?.[periodoTab] ?? [];
  const catRows: VDReceitaCategoriaRow[] = dataset.receitaCategoria?.[catTab] ?? [];

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 28px' }}>Receita &amp; Metas</h1>

      {totalRow && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            eyebrow="Receita atual (VD+OMNI)"
            value={fmtBRL(totalRow.total.receitaAtual)}
            delta={fmtPct(((totalRow.total.receitaAtual - totalRow.total.receitaAnterior) / (totalRow.total.receitaAnterior || 1)) * 100)}
            deltaDirection={totalRow.total.receitaAtual >= totalRow.total.receitaAnterior ? 'up' : 'down'}
            meta="vs. ciclo anterior"
            hint="Coluna 'RECEITA ATUAL (R$)' do bloco TOTAL, linha TOTAL de ReceitaCanalVD_Performance_por_PDV.xlsx — soma VD + Omni Envio ER de todos os PDVs. A variação compara com a coluna 'RECEITA ANTERIOR (R$)' do mesmo bloco."
          />
          <KpiCard
            eyebrow="Meta PEF"
            value={fmtBRL(totalRow.total.metaPef)}
            delta={totalRow.total.realizadoPct !== null ? fmtPct(totalRow.total.realizadoPct - 100) : undefined}
            deltaDirection={(totalRow.total.realizadoPct ?? 0) >= 100 ? 'up' : 'down'}
            meta={totalRow.total.realizadoPct !== null ? `da meta · ${totalRow.total.realizadoPct.toFixed(2).replace('.', ',')}% realizado` : undefined}
            hint="Coluna 'META PEF (R$)' do bloco TOTAL, linha TOTAL. A variação é quanto falta (ou sobra) para a meta, e o % realizado vem direto da coluna 'REALIZADO (%)' do arquivo (já é fração do Excel, não recalculamos)."
          />
          <KpiCard
            eyebrow="Gap acordado"
            // Sinal de menos tipográfico (U+2212): com o hífen comum o navegador quebrava a linha logo após o "-".
            value={fmtBRL(totalRow.total.gapAcordadoValor).replace(/^-/, '\u2212')}
            hint="Coluna 'GAP ACORDADO (R$)' do bloco TOTAL, linha TOTAL — diferença já calculada pelo próprio relatório entre receita atual e meta PEF acordada, não recalculada por nós."
          />
          <KpiCard
            eyebrow="Canal Omni Envio ER"
            value={fmtBRL(totalRow.omni.receitaAtual)}
            hint="Coluna 'RECEITA ATUAL (R$)' do bloco OMNI ENVIO ER (não do VD), linha TOTAL — receita do canal de entrega remota, somada à parte para não misturar com o VD tradicional."
          />
        </div>
      )}

      {reconciliacao && (
        <ChartCard
          title="Reconciliação"
          subtitle="Soma de pedidos elegíveis (Order[], FVC incluído) vs. receita oficial do BI corporativo"
          hint="Compara os dois datasets independentes que alimentam o Modo VD — se a diferença for grande, algo mudou na regra de elegibilidade ou no corte de datas entre os dois lotes."
        >
          <div style={{ display: 'flex', gap: 32, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pedidos (Order[])</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRL(reconciliacao.ordersTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BI corporativo</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRL(reconciliacao.biTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferença</div>
              <VarBadge pct={reconciliacao.diffPct} />
            </div>
          </div>
        </ChartCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <DataQualityPanel />
        <CycleHistoryPanel />
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Performance por PDV"
          subtitle="Blocos VD / Omni Envio ER / Total"
          hint="Uma linha por PDV do arquivo ReceitaCanalVD_Performance_por_PDV.xlsx (aba 'PERFORMANCE POR PDV'). Cada linha traz 3 blocos de colunas repetidos (VD, Omni Envio ER, Total), cada um com receita anterior/atual/meta PEF/gap — lidos pela posição do bloco, não pelo nome sozinho, porque o nome das colunas se repete nos 3 blocos. Clique num #PDV para abrir o PDV 360."
          action={
            <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={() => exportToCSV(
              unRows.map(r => ({
                UN: r.un, PDV: r.pdvCodigo, Cidade: r.cidade,
                'VD Atual': r.vd.receitaAtual, 'Omni Atual': r.omni.receitaAtual, 'Total Atual': r.total.receitaAtual,
                'Meta PEF': r.total.metaPef, '% Realizado': r.total.realizadoPct ?? '',
              })),
              `datalens-receita-pdv-${new Date().toISOString().slice(0, 10)}`
            )}>
              CSV
            </Button>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>UN / PDV</th>
                  <th style={th}>Cidade</th>
                  <th style={{ ...th, textAlign: 'right' }}>VD atual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Omni atual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Total atual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Meta PEF</th>
                  <th style={{ ...th, textAlign: 'right' }}>% realizado</th>
                </tr>
              </thead>
              <tbody>
                {unRows.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>
                      {r.un}{' '}
                      {r.pdvCodigo && (
                        <span
                          onClick={() => setOpenPdv(r.pdvCodigo)}
                          title="Ver PDV 360"
                          style={{ color: 'var(--vd-accent, #B26A3C)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                        >
                          #{r.pdvCodigo}
                        </span>
                      )}
                    </td>
                    <td style={td}>{r.cidade}</td>
                    <td style={tdNum}>{fmtBRL(r.vd.receitaAtual)}</td>
                    <td style={tdNum}>{fmtBRL(r.omni.receitaAtual)}</td>
                    <td style={tdNum}>{fmtBRL(r.total.receitaAtual)}</td>
                    <td style={tdNum}>{fmtBRL(r.total.metaPef)}</td>
                    <td style={tdNum}>{r.total.realizadoPct !== null ? `${r.total.realizadoPct.toFixed(1).replace('.', ',')}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {dataset.receitaCanalVDUn && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Meta por UN"
            subtitle="Composição Venda Direta x Omni Envio ER, por unidade de negócio"
            hint="ReceitaCanalVD_por_UN.xlsx (aba 'META POR UN') traz um bloco Meta/Realizado/Anterior por UN, seguido de um sub-bloco 'Composição Receita:' com a mesma UN quebrada em Venda Direta x Omni Envio ER — a tabela usa só a linha de totais de cada UN; a composição de cada uma fica disponível mas não é exibida aqui em detalhe."
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>UN</th>
                    <th style={{ ...th, textAlign: 'right' }}>Meta</th>
                    <th style={{ ...th, textAlign: 'right' }}>Realizado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Anterior</th>
                    <th style={{ ...th, textAlign: 'right' }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.receitaCanalVDUn.porUn.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.un}</td>
                      <td style={tdNum}>{fmtBRL(r.meta)}</td>
                      <td style={tdNum}>{fmtBRL(r.realizado)}</td>
                      <td style={tdNum}>{fmtBRL(r.anterior)}</td>
                      <td style={tdNum}><VarBadge pct={r.variacaoPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      {periodoRows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Receita por período"
            subtitle="Ciclo atual vs. anterior"
            hint="Receita_por_Periodo.xlsx, abas 'DIA' e 'MÊS' — receita por dia/mês do ciclo atual comparada ao mesmo período do ciclo anterior. A linha 'TOTAL' do arquivo é omitida da tabela (já aparece nos KPIs do topo)."
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                {(['dia', 'mes'] as const).map(t => (
                  <button key={t} onClick={() => setPeriodoTab(t)} className={`glossy-btn${periodoTab === t ? ' glossy-active' : ''}`} style={pillBtn(periodoTab === t)}>
                    <GlossyContent compact>{t === 'dia' ? 'Dia' : 'Mês'}</GlossyContent>
                  </button>
                ))}
              </div>
            }
          >
            <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{periodoTab === 'dia' ? 'Dia' : 'Mês'}</th>
                    <th style={{ ...th, textAlign: 'right' }}>Anterior</th>
                    <th style={{ ...th, textAlign: 'right' }}>Atual</th>
                    <th style={{ ...th, textAlign: 'right' }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {periodoRows.filter(r => r.label.toUpperCase() !== 'TOTAL').map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.label}</td>
                      <td style={tdNum}>{fmtBRL(r.receitaAnterior)}</td>
                      <td style={tdNum}>{fmtBRL(r.receitaAtual)}</td>
                      <td style={tdNum}><VarBadge pct={r.variacaoPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      {dataset.receitaCategoria && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Receita por categoria de produto"
            hint="Receita_por_Cat_Sub_Mar.xlsx, uma aba por granularidade (Categoria/Subcategoria/Linha/Marca). Cada aba tem cabeçalho em 2 linhas mescladas (grupo 'Ciclo Anterior/Atual/Variação' por cima de 'Receita (R$)'/'Participação (%)') — o parser localiza a coluna certa pelo grupo, não só pelo nome, porque 'Receita (R$)' se repete 3x na linha de baixo."
            action={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORIA_TABS.map(t => (
                  <button key={t.id} onClick={() => setCatTab(t.id)} className={`glossy-btn${catTab === t.id ? ' glossy-active' : ''}`} style={pillBtn(catTab === t.id)}>
                    <GlossyContent compact>{t.label}</GlossyContent>
                  </button>
                ))}
              </div>
            }
          >
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{CATEGORIA_TABS.find(t => t.id === catTab)?.label}</th>
                    <th style={{ ...th, textAlign: 'right' }}>Receita atual</th>
                    <th style={{ ...th, textAlign: 'right' }}>Participação</th>
                    <th style={{ ...th, textAlign: 'right' }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.nome}</td>
                      <td style={tdNum}>{fmtBRL(r.receitaAtual)}</td>
                      <td style={tdNum}>{r.participacaoAtualPct.toFixed(1).replace('.', ',')}%</td>
                      <td style={tdNum}><VarBadge pct={r.variacaoPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      {dataset.receitaCanalUn && dataset.receitaCanalUn.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Receita por canal / UN"
            subtitle="Visão legada — confirma que este franqueado só opera Venda Direta"
            hint="Receita_por_Canal_UN.xlsx — nível 'canal' (Loja/Venda Direta/Omnichannel) com sub-linhas de UN indentadas por prefixo de espaços no próprio nome da célula (ex. '  Venda Direta BOT'). Detectamos o indent lendo esse prefixo, não uma coluna separada."
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Canal / UN</th>
                    <th style={{ ...th, textAlign: 'right' }}>Anterior</th>
                    <th style={{ ...th, textAlign: 'right' }}>Atual</th>
                    <th style={{ ...th, textAlign: 'right' }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.receitaCanalUn.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, paddingLeft: r.indent ? 28 : 12, color: r.indent ? 'var(--vd-text-secondary, #6B6258)' : undefined }}>{r.canal.trim()}</td>
                      <td style={tdNum}>{fmtBRL(r.receitaAnterior)}</td>
                      <td style={tdNum}>{fmtBRL(r.receitaAtual)}</td>
                      <td style={tdNum}><VarBadge pct={r.variacaoPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <GlossarioPanel termos={['pef', 'cp']} />
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: 'var(--vd-text-muted, #9B9287)' }}>
        {fmtNumber(pdvRows.length)} linhas de PDV carregadas.
      </div>

      <PdvDetailModal pdvCodigo={openPdv} onClose={() => setOpenPdv(null)} />
    </div>
  );
};

export default VDReceitaScreen;
