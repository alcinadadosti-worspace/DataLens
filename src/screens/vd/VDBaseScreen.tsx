import React, { useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import RankingChart from '../../components/charts/RankingChart';
import { RankingItem } from '../../components/charts/RankingList';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtNumber, fmtBRL } from '../../utils/formatters';
import { pillBtn } from './pillBtn';
import { exportToCSV } from '../../services/exportService';
import GlossarioPanel from './GlossarioPanel';
import PdvDetailModal from './PdvDetailModal';

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };
const pdvLink: React.CSSProperties = { color: 'var(--vd-accent, #B26A3C)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 };

const fmtPctBR = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: 'var(--vd-bg-subtle, #F2EEE2)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>{sub}</div>
    </div>
  );
}

const tdSmall: React.CSSProperties = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid var(--vd-border, #E8E2D6)', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

const VDBaseScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const [monitorTab, setMonitorTab] = useState<'porPdv' | 'porSupervisor'>('porPdv');
  const [openPdv, setOpenPdv] = useState<string | null>(null);

  const evolucao = dataset?.evolucaoBase?.[0];
  const monitoramento = dataset?.monitoramentoBase;
  const penetracao = dataset?.penetracaoBase ?? [];
  const detalhada = dataset?.penetracaoAtivosDetalhada;
  const ativasPorTier = dataset?.ativasPorTier ?? [];
  const segmentacao = dataset?.segmentacaoBase;
  const digitaisPdv = dataset?.ferramentasDigitaisPdv ?? [];
  const digitaisTotal = digitaisPdv.find(r => r.pdv === 'TOTAL') ?? null;
  const digitaisPorPdv = digitaisPdv.filter(r => r.pdv !== 'TOTAL');
  const canaisDigitais = dataset?.ativasCanaisDigitais ?? null;
  const espacoRevendedor = dataset?.ativasEspacoRevendedor ?? null;
  const optOutBase = dataset?.optOutBase ?? null;
  const optOutDetalhe = dataset?.optOutDetalhe ?? null;
  const optOutPdv = dataset?.optOutPdv ?? [];
  const hasDigital = digitaisPdv.length > 0 || !!canaisDigitais || !!espacoRevendedor;
  const hasOptOut = !!optOutBase || optOutPdv.length > 0;

  const hasAnything = evolucao || monitoramento || penetracao.length > 0 || detalhada || ativasPorTier.length > 0 || segmentacao || hasDigital || hasOptOut;

  if (!hasAnything) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-users-three" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de base de revendedores</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe os relatórios VendaDireta (Evolução, Monitoramento, Penetração, Segmentação) para ver esta tela.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const monitorRows = monitoramento?.[monitorTab] ?? [];
  const monitorTotal = monitorRows.find(r => r.chave.trim().toUpperCase() === 'TOTAL');
  const monitorRest = monitorRows.filter(r => r.chave.trim().toUpperCase() !== 'TOTAL').sort((a, b) => b.baseAtiva - a.baseAtiva);

  function exportMonitoramento() {
    exportToCSV(
      monitorRest.map(r => ({
        [monitorTab === 'porPdv' ? 'PDV' : 'Supervisor']: r.chave,
        'Base Total': r.baseTotal, 'Base Ativa': r.baseAtiva, RPA: r.rpa,
        '% Atividade': r.atividadePct, '% Churn': r.churnPct,
        Inicios: r.inicios, Reinicios: r.reinicios, 'I6 Recuperados': r.i6Recuperados, 'Perda da Base': r.perdaBase,
      })),
      `datalens-base-monitoramento-${monitorTab}-${new Date().toISOString().slice(0, 10)}`
    );
  }

  const recenciaItems: RankingItem[] = ativasPorTier.map(r => ({
    id: r.segmentoRecencia,
    label: r.segmentoRecencia,
    value: r.cicloAtual,
    valueLabel: fmtNumber(r.cicloAtual),
    meta: `${r.participacaoAtualPct.toFixed(1).replace('.', ',')}%`,
  }));

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 28px' }}>Base &amp; Segmentação</h1>

      {evolucao && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            eyebrow="Base ativa"
            value={fmtNumber(evolucao.baseAtiva)}
            hint="Coluna 'BASE ATIVA' de VendaDireta_Evolucao_da_base.xlsx (aba EVOLUÇÃO DA BASE, 1 linha só, ciclo atual) — na Extranet, base ativa = base total − inícios − reinícios (confere em todas as linhas do Monitoramento, por PDV e por supervisor, nos Ciclos 13 e 14). Não é o número de quem comprou no ciclo: esse é 'Ativos' (ver Penetração de base e Canais digitais, abaixo)."
          />
          <KpiCard
            eyebrow="Início de ciclo"
            value={fmtNumber(evolucao.inicios)}
            meta="revendedores novos"
            hint="Coluna 'INICIOS' do mesmo arquivo — revendedores que fizeram a primeira compra neste ciclo."
          />
          <KpiCard
            eyebrow="Reinícios"
            value={fmtNumber(evolucao.reinicios)}
            meta="voltaram a comprar"
            hint="Coluna 'REINICIOS' do mesmo arquivo — revendedores que estavam inativos e voltaram a comprar neste ciclo."
          />
          <KpiCard
            eyebrow="Base multimarca"
            value={`${evolucao.baseMultimarcaPct.toFixed(1).replace('.', ',')}%`}
            meta={`${fmtNumber(evolucao.baseMultimarca)} revendedores`}
            hint="Colunas 'BASE MULTIMARCAS' e '% BASE MULTIMARCAS' do mesmo arquivo — revendedores que compraram mais de uma UN (marca) no ciclo."
          />
        </div>
      )}

      {monitoramento && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Monitoramento da base"
            subtitle="RPA, churn, início/reinício — por PDV ou por supervisor"
            hint="VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx, abas 'MONITORAMENTO POR PDV' e 'MONITORAMENTO POR SUPERVISOR' — mesmas colunas nas duas, só muda a chave da linha. RPA = Real por Ativo (coluna 'RPA (REAIS POR ATIVO)'). % Churn = coluna '% CHURN', perda de base no ciclo. A linha 'TOTAL' do arquivo vira os 4 números de resumo acima da tabela."
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setMonitorTab('porPdv')} className={`glossy-btn${monitorTab === 'porPdv' ? ' glossy-active' : ''}`} style={pillBtn(monitorTab === 'porPdv')}>
                    <GlossyContent compact>Por PDV</GlossyContent>
                  </button>
                  <button onClick={() => setMonitorTab('porSupervisor')} className={`glossy-btn${monitorTab === 'porSupervisor' ? ' glossy-active' : ''}`} style={pillBtn(monitorTab === 'porSupervisor')}>
                    <GlossyContent compact>Por supervisor</GlossyContent>
                  </button>
                </div>
                <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportMonitoramento}>
                  CSV
                </Button>
              </div>
            }
          >
            {monitorTotal && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>Base total</div><div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(monitorTotal.baseTotal)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>Base ativa</div><div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(monitorTotal.baseAtiva)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>RPA</div><div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRL(monitorTotal.rpa)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>% Churn</div><div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-danger, #B83A3A)' }}>{monitorTotal.churnPct.toFixed(2).replace('.', ',')}%</div></div>
              </div>
            )}
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{monitorTab === 'porPdv' ? 'PDV' : 'Supervisor'}</th>
                    <th style={{ ...th, textAlign: 'right' }}>Base ativa</th>
                    <th style={{ ...th, textAlign: 'right' }}>RPA</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Atividade</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Churn</th>
                    <th style={{ ...th, textAlign: 'right' }}>Inícios</th>
                    <th style={{ ...th, textAlign: 'right' }}>Reinícios</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorRest.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>
                        {monitorTab === 'porPdv' ? (
                          <span
                            onClick={() => setOpenPdv(r.chave)}
                            title="Ver PDV 360"
                            style={{ color: 'var(--vd-accent, #B26A3C)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                          >
                            {r.chave}
                          </span>
                        ) : r.chave}
                      </td>
                      <td style={tdNum}>{fmtNumber(r.baseAtiva)}</td>
                      <td style={tdNum}>{fmtBRL(r.rpa)}</td>
                      <td style={tdNum}>{r.atividadePct.toFixed(1).replace('.', ',')}%</td>
                      <td style={{ ...tdNum, color: r.churnPct > 3 ? 'var(--vd-danger, #B83A3A)' : undefined }}>{r.churnPct.toFixed(2).replace('.', ',')}%</td>
                      <td style={tdNum}>{fmtNumber(r.inicios)}</td>
                      <td style={tdNum}>{fmtNumber(r.reinicios)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {penetracao.length > 0 && (
          <ChartCard
            title="Penetração de base"
            subtitle="Período anterior vs. atual"
            hint="VendaDireta_penetracao_base.xlsx (aba 'Penetração de base') — formato linha-por-métrica (Base total, Base ativa, Ativos, Multimarca, Monomarca...), diferente do Monitoramento acima que é coluna-por-métrica. Mesmos conceitos, granularidade de comparação anterior×atual em vez de por PDV/supervisor."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Base</th>
                  <th style={{ ...th, textAlign: 'right' }}>Anterior</th>
                  <th style={{ ...th, textAlign: 'right' }}>Atual</th>
                </tr>
              </thead>
              <tbody>
                {penetracao.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.metrica}</td>
                    <td style={tdNum}>{fmtNumber(r.periodoAnterior)}</td>
                    <td style={tdNum}>{fmtNumber(r.periodoAtual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        )}

        {ativasPorTier.length > 0 && (
          <ChartCard
            title="Ativas por segmento de recência"
            subtitle="I1 (inativo há 1 ciclo) a I6 (inativo há 6+ ciclos / churned)"
            hint="VendaDireta_Ativas_por_tier.xlsx (aba 'ATIVAS POR TIER') — apesar do nome do arquivo original, I1-I6 é tempo de inatividade em ciclos consecutivos sem comprar (I1 = 1 ciclo, I6 = 6+ ciclos/churned), não o tier comercial (Bronze/Prata/Ouro...). Confirmado batendo com os totais de 'INATIVOS I1 a I3'/'I4 a I6' do Monitoramento. Use os botões do gráfico pra ver como funil (abra em tela cheia → 'mais' → funil) e visualizar a perda de base ciclo a ciclo."
          >
            <RankingChart items={recenciaItems} mode="vd" medals={false} initialCategory="bar" emptyMessage="Sem dados" />
            <div style={{ height: 14 }} />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Segmento</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ciclo atual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Participação</th>
                </tr>
              </thead>
              <tbody>
                {ativasPorTier.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.segmentoRecencia}</td>
                    <td style={tdNum}>{fmtNumber(r.cicloAtual)}</td>
                    <td style={tdNum}>{r.participacaoAtualPct.toFixed(1).replace('.', ',')}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        )}
      </div>

      {detalhada && detalhada.porGrupo.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Penetração de ativos por UN e categoria"
            subtitle="Repique da base ativa por marca (UN) e por categoria de produto"
            hint="VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx — 1 linha larga (32 colunas fixas), lida por posição porque os pares 'grupo/participação' se repetem sem nome de coluna único. O relatório original mistura UN (marca) e categoria de produto no mesmo nível de coluna — não é possível separar um do outro só pelos dados, por isso aparecem juntos aqui."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {detalhada.porGrupo.map((g, i) => (
                <div key={i} style={{ background: 'var(--vd-bg-subtle, #F2EEE2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{g.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(g.ativos)}</div>
                  <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>{g.pct.toFixed(1).replace('.', ',')}% penetração</div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {(hasDigital || hasOptOut) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasDigital && hasOptOut ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
          {hasDigital && (
            <ChartCard
              title="Canais digitais e Espaço do Revendedor"
              subtitle="Das revendedoras que compraram no ciclo, quantas usaram cada ferramenta"
              hint="ativas_uma_compra_canais_digitais.xlsx, ativas_uma_compra_er.xlsx e Monitoramento_base_com_penetracao_em_ferramentas_digitais_pdv.xlsx (este, por PDV). 'Ativas' são as revendedoras que compraram no ciclo — o arquivo por PDV chama a coluna de 'Base Ativa', mas o número é o de ativos, não a base ativa do card no topo. ER = Espaço do Revendedor, o site/app de pedidos da revendedora. Canais digitais é um conjunto mais amplo de ferramentas digitais de compra; uma mesma revendedora pode ter usado os dois."
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {canaisDigitais && (
                  <MiniStat label="Canais digitais" value={fmtPctBR(canaisDigitais.pct)} sub={`${fmtNumber(canaisDigitais.comCompra)} de ${fmtNumber(canaisDigitais.ativas)} ativas`} />
                )}
                {espacoRevendedor && (
                  <MiniStat label="Espaço do Revendedor" value={fmtPctBR(espacoRevendedor.pct)} sub={`${fmtNumber(espacoRevendedor.comCompra)} de ${fmtNumber(espacoRevendedor.ativas)} ativas`} />
                )}
              </div>
              {digitaisPorPdv.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>PDV</th>
                      <th style={{ ...th, textAlign: 'right' }}>Ativas</th>
                      <th style={{ ...th, textAlign: 'right' }}>Canais digitais</th>
                      <th style={{ ...th, textAlign: 'right' }}>Espaço do Revendedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...digitaisPorPdv, ...(digitaisTotal ? [digitaisTotal] : [])].map((r, i) => {
                      const total = r.pdv === 'TOTAL';
                      const p = (n: number) => (r.ativas > 0 ? fmtPctBR((n / r.ativas) * 100) : '—');
                      return (
                        <tr key={i} style={total ? { fontWeight: 600 } : undefined}>
                          <td style={td}>
                            {total ? 'Total' : (
                              <span onClick={() => setOpenPdv(r.pdv)} title="Ver PDV 360" style={pdvLink}>{r.pdv}</span>
                            )}
                          </td>
                          <td style={tdNum}>{fmtNumber(r.ativas)}</td>
                          <td style={tdNum}>{p(r.comCompraCanaisDigitais)} <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>({fmtNumber(r.comCompraCanaisDigitais)})</span></td>
                          <td style={tdNum}>{p(r.comCompraER)} <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>({fmtNumber(r.comCompraER)})</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ChartCard>
          )}

          {hasOptOut && (
            <ChartCard
              title="Opt-out de catálogos (BOT)"
              subtitle="Revendedoras que pediram para não receber o catálogo impresso de O Boticário"
              hint="BaseComOptOutDeCatalogo_*.xlsx (3 arquivos): base total com e sem opt-out, o detalhe da base com opt-out (A0-I6 / inícios / reinícios) e o opt-out por PDV. Opt-out é a revendedora que optou por não receber o catálogo físico. A base total é a mesma do Monitoramento da base."
            >
              {optOutBase && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <MiniStat label="Com opt-out" value={fmtPctBR(optOutBase.pctOptOut)} sub={`${fmtNumber(optOutBase.comOptOut)} de ${fmtNumber(optOutBase.baseTotal)} na base total`} />
                  <MiniStat label="Recebem catálogo" value={fmtNumber(optOutBase.semOptOut)} sub="sem opt-out" />
                </div>
              )}
              {optOutDetalhe && (
                <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 14 }}>
                  Das {fmtNumber(optOutDetalhe.baseComOptOut)} com opt-out, {fmtNumber(optOutDetalhe.a0i6)} estão na base A0-I6;
                  {' '}{fmtNumber(optOutDetalhe.inicios)} {optOutDetalhe.inicios === 1 ? 'é início' : 'são inícios'} e
                  {' '}{fmtNumber(optOutDetalhe.reinicios)} {optOutDetalhe.reinicios === 1 ? 'é reinício' : 'são reinícios'} do ciclo.
                </div>
              )}
              {optOutPdv.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>PDV</th>
                      <th style={{ ...th, textAlign: 'right' }}>Revendedoras</th>
                      <th style={{ ...th, textAlign: 'right' }}>Com opt-out</th>
                      <th style={{ ...th, textAlign: 'right' }}>% opt-out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optOutPdv.map((r, i) => (
                      <tr key={i}>
                        <td style={td}><span onClick={() => setOpenPdv(r.pdv)} title="Ver PDV 360" style={pdvLink}>{r.pdv}</span></td>
                        <td style={tdNum}>{fmtNumber(r.revendedoras)}</td>
                        <td style={tdNum}>{fmtNumber(r.comOptOut)}</td>
                        <td style={tdNum}>{fmtPctBR(r.pctOptOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
          )}
        </div>
      )}

      {segmentacao && (
        <ChartCard
          title="Segmentação da base (CGB)"
          subtitle="Recência × tier — taxonomia própria da Extranet, separada dos 10 tiers visuais do app"
          hint="VendaDireta_Segmentacao_da_Base.xlsx (aba 'SEGMENTAÇÃO DA BASE CGB') — matriz recência (linhas A0=ativo, I1-I6=inativo) × tier da Extranet (colunas, em pares Quantidade/Participação). BLUE e SEM CLASSIFICAÇÃO só existem neste relatório — não têm correspondência confirmada com Revendedor/Bronze/Prata/etc. usados no resto do app, por isso ficam com rótulo próprio aqui em vez de tentar mapear."
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={th}>Segmento</th>
                  {segmentacao.categorias.map(cat => (
                    <th key={cat} style={{ ...th, textAlign: 'right' }}>{cat}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segmentacao.linhas.map((row, i) => (
                  <tr key={i}>
                    <td style={td}>{row.segmento}</td>
                    {segmentacao.categorias.map(cat => {
                      const v = row.valores[cat];
                      return (
                        <td key={cat} style={tdSmall}>
                          {v && v.quantidade > 0 ? `${fmtNumber(v.quantidade)} (${v.participacaoPct.toFixed(0)}%)` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <div style={{ marginTop: 20 }}>
        <GlossarioPanel termos={['rpa', 'er', 'optout']} />
      </div>

      <PdvDetailModal pdvCodigo={openPdv} onClose={() => setOpenPdv(null)} />
    </div>
  );
};

export default VDBaseScreen;
