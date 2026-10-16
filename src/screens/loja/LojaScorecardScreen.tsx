import React, { useMemo, useRef, useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { receitaBaseMismatches } from '../../analytics/lojaMetrics';
import { tipoIndicadorPef, unidadeVariacao, fmtDuracao } from '../../analytics/indicadorPef';
import { exportToCSV, exportToPDF } from '../../services/exportService';
import { fmtBRL, fmtNumber } from '../../utils/formatters';
import { ResumoPerformanceRow, LOJA_OPTIONAL_FILE_LABELS, LojaOptionalFile } from '../../types/loja';

type Scope = 'rede' | 'loja' | 'consultor';

/**
 * Pra onde levar o usuário quando ele clica num indicador — só pros que têm uma tela claramente
 * mais específica que o próprio Scorecard (funil de Fidelidade/Serviços/Loja Digital, ou o canal
 * de cumprimento em Canais & Formas). Indicadores sem uma tela melhor (ex. "Itens por Boleto",
 * "Share de Alavancas BT/BP") ficam sem link — mandar pra Ranking geral não ajudaria em nada.
 */
const INDICATOR_LINKS: { pattern: RegExp; route: string; label: string }[] = [
  { pattern: /fidelidade|resgate/i, route: 'loja-fidelidade-servicos', label: 'Ver em Fidelidade & serviços' },
  { pattern: /cuidados faciais/i, route: 'loja-fidelidade-servicos', label: 'Ver em Fidelidade & serviços' },
  { pattern: /serviços em loja/i, route: 'loja-fidelidade-servicos', label: 'Ver em Fidelidade & serviços' },
  { pattern: /loja digital/i, route: 'loja-fidelidade-servicos', label: 'Ver em Fidelidade & serviços' },
  { pattern: /clique\s*&?\s*retire/i, route: 'loja-canais', label: 'Ver em Canais & Formas' },
  { pattern: /^receita total$|^receita$|quantidade de boletos|boleto médio/i, route: 'loja-overview', label: 'Ver em Ranking geral' },
];

function findIndicatorLink(nome: string) {
  return INDICATOR_LINKS.find(l => l.pattern.test(nome)) ?? null;
}

function IndicatorLinkButton({ nome, onNavigate }: { nome: string; onNavigate: (r: string) => void }) {
  const link = findIndicatorLink(nome);
  if (!link) return null;
  return (
    <button
      onClick={e => { e.stopPropagation(); onNavigate(link.route); }}
      title={link.label}
      style={{
        border: 'none', background: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--loja-text-muted, #9B9287)', display: 'inline-flex', alignItems: 'center',
        fontSize: 13, flexShrink: 0,
      }}
    >
      <i className="ph ph-arrow-square-out" />
    </button>
  );
}

/**
 * Nomes de indicador cuja direção "boa" é a oposta do resto (menor é melhor, ex. tempo de espera)
 * — usado só pra não colorir de verde um aumento de TME, que seria o oposto do que os outros
 * ~19 indicadores significam (penetração, conversão, receita — todos "maior é melhor").
 */
function isLowerBetter(nomeIndicador: string): boolean {
  return /tme|tempo/i.test(nomeIndicador);
}

/**
 * Formata o valor de um indicador pela natureza dele (`tipoIndicadorPef`, decidida pelo nome). Os
 * valores já chegam do parser na unidade canônica — taxa em % (0-100), tempo em segundos —
 * qualquer que seja a escala da aba de origem, então aqui não se adivinha nada pela magnitude.
 */
function formatIndicatorValue(nome: string, valor: number | null): string {
  if (valor === null) return '—';
  switch (tipoIndicadorPef(nome)) {
    case 'taxa': return valor.toFixed(1).replace('.', ',') + '%';
    case 'moeda': return fmtBRL(valor);
    case 'tempo': return fmtDuracao(valor);
    default: return fmtNumber(valor);
  }
}

/** Variação em % relativo ("+13,1%") ou em pontos percentuais ("−19,9 p.p."). */
function fmtVariacao(valor: number, unidade: 'pct' | 'pp'): string {
  return `${valor >= 0 ? '+' : ''}${valor.toFixed(1).replace('.', ',')}${unidade === 'pp' ? ' p.p.' : '%'}`;
}

/**
 * Texto de apoio da variação vs. ano passado: numa taxa, a diferença em p.p. esconde o tamanho
 * da mudança (−19,9 p.p. saindo de 32,9% é uma queda de 61%), então o tooltip reconstrói o valor
 * do ano passado e a variação relativa.
 */
function explicaVariacaoAno(nome: string, atual: number | null, variacao: number | null): string | undefined {
  if (variacao == null) return undefined;
  if (tipoIndicadorPef(nome) !== 'taxa') return 'Variação relativa sobre o mesmo período do ano passado.';
  if (atual == null) return 'Diferença em pontos percentuais sobre a taxa do mesmo período do ano passado.';
  const anoPassado = atual - variacao;
  const fmt = (v: number) => v.toFixed(1).replace('.', ',') + '%';
  const relativa = anoPassado > 0 ? ` — variação relativa de ${fmtVariacao((variacao / anoPassado) * 100, 'pct')}` : '';
  return `Ano passado: ${fmt(anoPassado)} → agora ${fmt(atual)} (${fmtVariacao(variacao, 'pp')}${relativa}).`;
}

const BASE_COLOR: Record<string, string> = {
  'GMV': '#8A6D00',
  'GMV + Omni': '#B36B1E',
  'Receita Líquida': '#1E5B8C',
  'Receita Bruta Varejo': '#6B4A9E',
  'Receita Bruta': '#6B4A9E',
};

/**
 * Rótulo da base de receita de um indicador — crítico pra não ler dois indicadores lado a lado
 * como se fossem comparáveis quando um é sobre GMV e outro sobre Receita Líquida (bases
 * diferentes, valores diferentes por definição, mesmo que os nomes pareçam parecidos).
 */
function BaseTag({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  const color = BASE_COLOR[tipo] ?? '#6B6258';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
      color, background: `${color}18`, padding: '1px 5px', borderRadius: 5, whiteSpace: 'nowrap',
    }}>
      {tipo}
    </span>
  );
}

function DeltaBadge({ pct, unidade = 'pct', lowerBetter, invalido = false, title }: {
  pct: number | null; unidade?: 'pct' | 'pp'; lowerBetter: boolean; invalido?: boolean; title?: string;
}) {
  if (invalido) {
    return (
      <span
        title="O arquivo de origem trouxe uma variação impossível para este indicador (ex. uma taxa que teria passado de 100% no ano passado) — o número foi descartado."
        style={{ color: 'var(--loja-warning-text, #8A6D00)', fontSize: 11, cursor: 'help', borderBottom: '1px dotted currentColor' }}
      >
        dado inválido
      </span>
    );
  }
  if (pct === null) {
    return <span style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 11 }}>sem dado</span>;
  }
  const isGood = lowerBetter ? pct <= 0 : pct >= 0;
  return (
    <span title={title} style={{
      cursor: title ? 'help' : undefined,
      fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
      color: isGood ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-danger, #B83A3A)',
      background: isGood ? 'var(--loja-success-bg, #E0F2E8)' : 'var(--loja-danger-bg, #FBE5E9)',
      padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap',
    }}>
      {fmtVariacao(pct, unidade)}
    </span>
  );
}

const LojaScorecardScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [scope, setScope] = useState<Scope>('rede');
  const [consultorSel, setConsultorSel] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);

  const rp = dataset?.resumoPerformance;

  const mismatches = useMemo(() => (dataset ? receitaBaseMismatches(dataset) : []), [dataset]);
  const basesAjustadas = mismatches.filter(m => m.baseAdotada);
  const basesSemMaioria = mismatches.filter(m => !m.baseAdotada);

  const receitaBasesArquivos = useMemo(() => {
    if (!dataset?.receitaBasesPorArquivo) return [];
    return (Object.entries(dataset.receitaBasesPorArquivo) as [LojaOptionalFile, string | null][])
      .filter(([, tipo]) => tipo !== null)
      .map(([key, tipo]) => ({
        arquivo: LOJA_OPTIONAL_FILE_LABELS[key] ?? key,
        fileName: dataset.optionalFileNames?.[key] ?? '',
        tipo: tipo as string,
      }));
  }, [dataset]);

  const lojaColumns = useMemo(() => {
    if (!rp) return [];
    return rp.pdv.map(r => ({ codigo: r.nome, nome: resolveLojaNome(r.nome, r.nome), row: r }));
  }, [rp]);

  const indicadoresPorLoja = useMemo(() => {
    if (!rp || rp.pdv.length === 0) return [];
    return rp.pdv[0].metricas.map(m => ({ nome: m.metrica, tipoReceita: m.tipoReceita }));
  }, [rp]);

  const consultorOptions = useMemo(() => {
    if (!rp) return [];
    return [...rp.consultor].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [rp]);

  const consultorRow: ResumoPerformanceRow | undefined = useMemo(() => {
    if (!rp) return undefined;
    // Mesma fonte do valor default do <select> (consultorOptions[0], ordenado por nome) — usar
    // rp.consultor[0] (ordem original do arquivo) aqui causava mismatch entre o nome selecionado
    // no dropdown e a linha de fato exibida na tabela.
    const targetNome = consultorSel || consultorOptions[0]?.nome || '';
    return rp.consultor.find(c => c.nome === targetNome);
  }, [rp, consultorSel, consultorOptions]);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver o scorecard de indicadores.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!rp) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          O arquivo <strong>Resumo_de_Performance_Indicadores_Loja.xlsx</strong> não foi importado — scorecard de indicadores indisponível.
        </p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar arquivo</Button>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  function handleExportCSV() {
    if (!rp) return;
    if (scope === 'rede') {
      const rows = rp.cp.map(ind => ({
        Indicador: ind.indicador,
        Base: ind.tipoReceita ?? '',
        'Meta PEF': formatIndicatorValue(ind.indicador, ind.metaPEF),
        Realizado: formatIndicatorValue(ind.indicador, ind.realizado),
        'Vs. Meta PEF': ind.vsMetaPEFPct != null ? fmtVariacao(ind.vsMetaPEFPct, 'pct') : '',
        'Vs. Ano Passado': ind.vsAnoPassadoInvalido ? 'dado inválido' : ind.vsAnoPassadoPct != null ? fmtVariacao(ind.vsAnoPassadoPct, unidadeVariacao(ind.tipo)) : '',
      }));
      exportToCSV(rows, `indicadores-pef-rede-${todayStr}`);
    } else if (scope === 'loja') {
      const rows = indicadoresPorLoja.map(({ nome, tipoReceita }) => {
        const row: Record<string, unknown> = { Indicador: nome, Base: tipoReceita ?? '' };
        for (const l of lojaColumns) {
          const m = l.row.metricas.find(mm => mm.metrica === nome);
          row[l.nome] = m ? formatIndicatorValue(nome, m.valor) : '';
        }
        return row;
      });
      exportToCSV(rows, `indicadores-pef-por-loja-${todayStr}`);
    } else if (consultorRow) {
      const rows = consultorRow.metricas.map(m => ({
        Indicador: m.metrica,
        Base: m.tipoReceita ?? '',
        Valor: formatIndicatorValue(m.metrica, m.valor),
        'Vs. Ano Passado': m.vsAnoAnteriorInvalido ? 'dado inválido' : m.vsAnoAnteriorPct != null ? fmtVariacao(m.vsAnoAnteriorPct, unidadeVariacao(m.tipo)) : '',
      }));
      exportToCSV(rows, `indicadores-pef-${consultorRow.nome.replace(/\s+/g, '-').toLowerCase()}-${todayStr}`);
    }
  }

  function handleExportPDF() {
    if (panelRef.current) exportToPDF(panelRef.current, `indicadores-pef-${scope}-${todayStr}`);
  }

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Indicadores PEF"
          hint="Os ~20 indicadores do Resumo de Performance (Meta PEF, Realizado, Vs. Meta PEF, Vs. Ano Passado) por rede, por loja e por consultor — a maioria desses indicadores é importada mas não aparecia em nenhuma outra tela."
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" size="md" icon={<i className="ph ph-download-simple" />} onClick={handleExportCSV}>Exportar CSV</Button>
          <Button variant="ghost" size="md" icon={<i className="ph ph-file-pdf" />} onClick={handleExportPDF}>Exportar PDF</Button>
          <div style={{ display: 'flex', gap: 6, background: 'var(--loja-bg-subtle, #F2EEE2)', borderRadius: 10, padding: 4 }}>
            {([['rede', 'Rede'], ['loja', 'Por loja'], ['consultor', 'Por consultor']] as [Scope, string][]).map(([v, label]) => (
              <button
                key={v}
                className={`glossy-btn${scope === v ? ' glossy-active' : ''}`}
                onClick={() => setScope(v)}
                style={{ borderRadius: 9, fontSize: 14 }}
              >
              <GlossyContent compact>{label}</GlossyContent>
            </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 24 }} />

      <div ref={panelRef}>
      {scope === 'rede' && (
        <ChartCard glow
          title="Indicadores da rede (CP)"
          hint="Todos os indicadores do ciclo para o Centro de Perfumaria inteiro — Meta PEF é a meta definida internamente pelo sistema de origem; Vs. Ano Passado compara com o mesmo período do ano anterior."
          subtitle={`${rp.cp.length} indicadores`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--loja-text-muted, #9B9287)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Indicador</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Meta PEF</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Realizado</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Vs. Meta PEF</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Vs. Ano Passado</th>
                </tr>
              </thead>
              <tbody>
                {rp.cp.map((ind, i) => {
                  const lowerBetter = isLowerBetter(ind.indicador);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {ind.indicador}
                          <BaseTag tipo={ind.tipoReceita} />
                          <IndicatorLinkButton nome={ind.indicador} onNavigate={onNavigate} />
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)' }}>
                        {formatIndicatorValue(ind.indicador, ind.metaPEF)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                        {formatIndicatorValue(ind.indicador, ind.realizado)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}><DeltaBadge pct={ind.vsMetaPEFPct} lowerBetter={lowerBetter} /></td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <DeltaBadge
                          pct={ind.vsAnoPassadoPct} unidade={unidadeVariacao(ind.tipo)} lowerBetter={lowerBetter}
                          invalido={ind.vsAnoPassadoInvalido} title={explicaVariacaoAno(ind.indicador, ind.realizado, ind.vsAnoPassadoPct)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {scope === 'loja' && (
        lojaColumns.length === 0 ? (
          <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13, padding: 24 }}>Sem dados por loja no arquivo importado.</div>
        ) : (
          <ChartCard glow
            title="Indicadores por loja"
            hint="Cada célula mostra o valor realizado da loja naquele indicador; a cor do indicador logo abaixo mostra se está acima (verde) ou abaixo (vermelho) da Meta PEF. Passe o mouse pro detalhe."
            subtitle={`${indicadoresPorLoja.length} indicadores × ${lojaColumns.length} lojas`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--loja-text-muted, #9B9287)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--loja-surface, #FFFFFF)' }}>Indicador</th>
                    {lojaColumns.map(l => (
                      <th key={l.codigo} style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', minWidth: 108 }}>{l.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indicadoresPorLoja.map(({ nome: nomeIndicador, tipoReceita }, i) => {
                    const lowerBetter = isLowerBetter(nomeIndicador);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--loja-surface, #FFFFFF)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {nomeIndicador}
                            <BaseTag tipo={tipoReceita} />
                            <IndicatorLinkButton nome={nomeIndicador} onNavigate={onNavigate} />
                          </div>
                        </td>
                        {lojaColumns.map(l => {
                          const m = l.row.metricas.find(mm => mm.metrica === nomeIndicador);
                          if (!m) return <td key={l.codigo} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--loja-text-muted, #9B9287)' }}>—</td>;
                          const isGood = m.vsMetaPEFPct === null ? null : (lowerBetter ? m.vsMetaPEFPct <= 0 : m.vsMetaPEFPct >= 0);
                          return (
                            <td key={l.codigo} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                              <div style={{
                                fontWeight: 600,
                                color: isGood === null ? 'var(--loja-text-strong, #3D362E)' : isGood ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-danger, #B83A3A)',
                              }}>
                                {formatIndicatorValue(nomeIndicador, m.valor)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )
      )}

      {scope === 'consultor' && (
        rp.consultor.length === 0 ? (
          <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13, padding: 24 }}>Sem dados por consultor no arquivo importado.</div>
        ) : (
          <ChartCard glow
            title="Indicadores por consultor"
            hint="A aba CONSULTOR do Resumo de Performance não traz Meta PEF individual — só a comparação com o ano anterior — por isso a cor aqui reflete Vs. Ano Passado, não Vs. Meta."
            subtitle={consultorRow ? consultorRow.nome : undefined}
            action={
              <select
                value={consultorSel || (consultorOptions[0]?.nome ?? '')}
                onChange={e => setConsultorSel(e.target.value)}
                style={{ fontSize: 13, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--loja-border, #E8E2D6)', background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)', cursor: 'pointer' }}
              >
                {consultorOptions.map(c => (
                  <option key={c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            }
          >
            {!consultorRow ? (
              <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>Selecione um consultor.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--loja-text-muted, #9B9287)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Indicador</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Valor</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Vs. Ano Passado</th>
                  </tr>
                </thead>
                <tbody>
                  {consultorRow.metricas.map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {m.metrica}
                          <BaseTag tipo={m.tipoReceita} />
                          <IndicatorLinkButton nome={m.metrica} onNavigate={onNavigate} />
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{formatIndicatorValue(m.metrica, m.valor)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <DeltaBadge
                          pct={m.vsAnoAnteriorPct} unidade={unidadeVariacao(m.tipo)} lowerBetter={isLowerBetter(m.metrica)}
                          invalido={m.vsAnoAnteriorInvalido} title={explicaVariacaoAno(m.metrica, m.valor, m.vsAnoAnteriorPct)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ChartCard>
        )
      )}
      </div>

      {receitaBasesArquivos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Bases de receita por arquivo importado"
            hint="Todo arquivo opcional que tem receita como assunto declara, na própria aba FILTROS, sobre qual base os números foram calculados. Arquivos diferentes descrevem coisas diferentes (Loja Digital é só atendimento digital, Cuidados Faciais é só uma categoria) — não são pra bater entre si, mas é importante saber a base de cada um antes de citar um número."
            subtitle={`${receitaBasesArquivos.length} arquivo(s) com receita declarada`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {receitaBasesArquivos.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.arquivo}</div>
                    <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace' }}>{r.fileName}</div>
                  </div>
                  <BaseTag tipo={r.tipo} />
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      <div style={{
        marginTop: 20, background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)',
        borderRadius: 14, padding: '16px 20px', fontSize: 12, color: 'var(--loja-text-secondary, #6B6258)', lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--loja-text-strong, #3D362E)', marginBottom: 8, fontSize: 13 }}>
          Sobre as bases de receita (a etiqueta ao lado de cada indicador)
        </div>
        <div>
          O arquivo Resumo de Performance calcula cada indicador sobre uma base de receita diferente — comparar dois
          indicadores com etiquetas diferentes como se fossem a mesma unidade leva a conclusão errada:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 8 }}>
          <span><BaseTag tipo="GMV" /> Gross Merchandise Value — valor bruto transacionado, antes de qualquer desconto.</span>
          <span><BaseTag tipo="GMV + Omni" /> GMV somado ao canal Clique e Retire (compra online, retirada na loja).</span>
          <span><BaseTag tipo="Receita Líquida" /> já descontando trocas/devoluções.</span>
          <span><BaseTag tipo="Receita Bruta Varejo" /> receita bruta só do varejo físico, sem outros canais.</span>
        </div>
        <div>
          Indicadores sem etiqueta (contagens como "Quantidade de Serviços em Loja", ou "Clique & Retire" na aba CP) não
          são sobre receita — a planilha marca a base deles como "N/A".
        </div>
        {basesAjustadas.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>{basesAjustadas.length} base(s) ajustada(s) pela maioria das abas:</strong> a planilha de origem
            declarou bases diferentes pro mesmo indicador conforme a aba (CP, PDV, CONSULTOR). Vale a base que a
            maioria das abas declara, e ela é usada em todas as visões.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {basesAjustadas.map((m, i) => (
                <div key={i}>
                  "{m.indicadorCp}" — adotado <BaseTag tipo={m.baseAdotada} /> ({m.declaracoes.map(d => `${d.aba}: ${d.base}`).join(' · ')}).
                </div>
              ))}
            </div>
          </div>
        )}
        {basesSemMaioria.length > 0 ? (
          <div style={{ marginTop: 8, color: 'var(--loja-warning-text, #8A6D00)' }}>
            <strong>{basesSemMaioria.length} inconsistência(s) sem maioria na planilha de origem:</strong> as abas
            declaram bases diferentes e nenhuma base aparece em mais abas que as outras, então cada visão mostra a
            base da própria aba.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {basesSemMaioria.map((m, i) => (
                <div key={i}>
                  "{m.indicadorCp}" —{' '}
                  {m.declaracoes.map((d, j) => (
                    <span key={j}>{j > 0 && ' vs. '}<BaseTag tipo={d.base} /> na aba {d.aba}</span>
                  ))}.
                </div>
              ))}
            </div>
            Não é erro deste app: é assim que o sistema de origem exportou o relatório.
          </div>
        ) : basesAjustadas.length === 0 && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--loja-success, #2E7D5B)' }}>
            <i className="ph-bold ph-check-circle" />
            Checagem automática: nenhuma inconsistência de base entre as abas CP, PDV e CONSULTOR neste ciclo.
          </div>
        )}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <InfoHint text="Taxas ('Penetração', 'Share', 'Conversão', 'Resgate', 'Clique & Retire' e os que têm '%' no nome) são exibidas em %, e a variação delas vs. ano passado em pontos percentuais (p.p.): taxa atual menos a do ano passado — passe o mouse na variação pra ver o valor do ano passado e a variação relativa. 'Receita', 'Boleto Médio' e 'Preço Médio' são exibidos em R$, o TME em minutos e segundos, e a variação desses e das contagens é relativa (%). Quando o arquivo traz uma variação impossível, ela aparece como 'dado inválido'." />
          Sobre a formatação dos valores e das variações
        </div>
      </div>
    </div>
  );
};

export default LojaScorecardScreen;
