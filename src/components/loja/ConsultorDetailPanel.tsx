import React, { useMemo } from 'react';
import ChartCard from '../charts/ChartCard';
import KpiCard from '../ui/KpiCard';
import RankingChart from './RankingChart';
import { aggregateByName, aggregateConsultoresPorLoja, buildLojaNomeLookup, hourlyDistribution, findConsultorExtras } from '../../analytics/lojaMetrics';
import { fmtBRL, fmtBRLshort, fmtNumber, fmtPct } from '../../utils/formatters';
import { LojaDataset } from '../../types/loja';

interface ConsultorDetailPanelProps {
  dataset: LojaDataset;
  nome: string;
  view: 'consultor' | 'operador';
}

/**
 * Corpo do detalhe de um consultor/operador — usado embutido (expandir/recolher) na lista de
 * Consultores, em vez de navegar para uma página separada.
 */
const ConsultorDetailPanel: React.FC<ConsultorDetailPanelProps> = ({ dataset, nome, view }) => {
  // Cada uma dessas varre o dataset inteiro (todas as linhas de consultor/operador, lojas,
  // fidelidade, loja digital, serviços, cuidados faciais) — memoizado pra não recalcular tudo de
  // novo a cada re-render enquanto o painel está expandido (ex. ao expandir outra pessoa na lista).
  const derived = useMemo(() => {
    const rows = view === 'consultor' ? dataset.consultor : dataset.operador;
    const agg = aggregateByName(rows).find(r => r.key === nome);
    if (!agg) return { agg: undefined };

    const porLojaAgg = aggregateConsultoresPorLoja(rows).find(r => r.key === nome);
    const lojaNomeLookup = buildLojaNomeLookup(dataset.lojas);

    // Sempre usa a loja "principal" (maior GMV) para o padrão de horário — inclusive quando a
    // pessoa vendeu em mais de uma unidade no período, em vez de deixar indisponível.
    const principal = porLojaAgg && porLojaAgg.porLoja.length > 0 ? porLojaAgg.porLoja[0] : null;
    const lojaCodigo = principal?.codigo ?? null;
    const lojaNome = lojaCodigo ? lojaNomeLookup.get(lojaCodigo) : null;
    const horaRows = lojaCodigo && dataset.vendaPorHora ? dataset.vendaPorHora.filter(r => r.lojaCodigo === lojaCodigo) : [];
    const buckets = horaRows.length > 0 ? hourlyDistribution(horaRows) : [];
    const multiLoja = (porLojaAgg?.porLoja.length ?? 0) > 1;

    const extras = findConsultorExtras(dataset, nome);
    const hasExtras = !!extras.fidelidade || extras.lojaDigital.length > 0 || extras.servicos.length > 0 || extras.cuidadosFaciais.length > 0;
    const cuidadosTotal = extras.cuidadosFaciais.reduce((s, r) => s + r.receitaTotal, 0);
    const cuidadosBotik = extras.cuidadosFaciais.reduce((s, r) => s + r.receitaBotik, 0);
    const servicosTotalGmv = extras.servicos.reduce((s, r) => s + r.gmv, 0);
    const servicosTotalCompletos = extras.servicos.reduce((s, r) => s + r.qtdCompletos, 0);

    return {
      agg, lojaNomeLookup, lojaCodigo, lojaNome, buckets, multiLoja, extras, hasExtras,
      cuidadosTotal, cuidadosBotik, servicosTotalGmv, servicosTotalCompletos,
    };
  }, [dataset, nome, view]);

  if (!derived.agg) {
    return (
      <div style={{ padding: '16px 0', color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>
        Não foi possível encontrar dados para "{nome}".
      </div>
    );
  }

  const {
    agg, lojaNomeLookup, lojaCodigo, lojaNome, buckets, multiLoja, extras, hasExtras,
    cuidadosTotal, cuidadosBotik, servicosTotalGmv, servicosTotalCompletos,
  } = derived;

  return (
    <div style={{ padding: '20px 4px 4px' }}>
      {agg.lojaCodigos.length > 0 && (
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
          Unidade{agg.lojaCodigos.length > 1 ? 's' : ''}: {agg.lojaCodigos.map(c => `${c}${lojaNomeLookup.get(c) ? ' - ' + lojaNomeLookup.get(c) : ''}`).join(', ')}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard glow
          eyebrow="GMV no ciclo"
          hint="GMV — Gross Merchandise Value: valor total vendido por essa pessoa no ciclo, antes de descontos e trocas."
          value={fmtBRLshort(agg.gmv)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(agg.gmv)}</span>}
        />
        <KpiCard glow
          eyebrow="Boletos"
          hint="Quantidade de boletos (cupons/recibos de venda) fechados por essa pessoa no ciclo."
          value={fmtNumber(agg.qtdBoletos)}
        />
        <KpiCard glow
          eyebrow="Ticket médio"
          hint="GMV dividido pela quantidade de boletos — quanto, em média, cada venda fechada por essa pessoa valeu."
          value={fmtBRLshort(agg.ticketMedio)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(agg.ticketMedio)}</span>}
        />
        <KpiCard glow
          eyebrow="% Desconto sobre receita"
          hint="Total de descontos concedidos dividido pela receita líquida — quanto do valor vendido foi abatido em desconto."
          value={agg.descontoPct.toFixed(1).replace('.', ',') + '%'}
          meta={fmtBRL(agg.totalDescontos)}
        />
      </div>

      {agg.qtdBoletos > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
          <KpiCard glow
            eyebrow="Boletos de cliente Fidelidade"
            hint="% dos boletos dessa pessoa que pertencem a clientes cadastrados no programa Fidelidade (dado que já vinha no CSV, mas não era exibido em nenhuma tela)."
            value={agg.fidelidadePenetracaoPct.toFixed(1).replace('.', ',') + '%'}
            meta={`${fmtNumber(agg.qtdBoletos)} boletos no ciclo`}
          />
          {extras.fidelidade && (
            <KpiCard glow
              eyebrow="% concluiu desafio Fidelidade"
              hint="Dos boletos de cliente Fidelidade, quantos concluíram o 'desafio' Fidelidade (uma ação/meta específica do programa) — vem do arquivo ProgramaFidelidade novo."
              value={extras.fidelidade.penetracaoPct.toFixed(1).replace('.', ',') + '%'}
              meta={`${fmtNumber(extras.fidelidade.qtdBoletosDesafio)} de ${fmtNumber(extras.fidelidade.qtdBoletosFidelidade)} boletos`}
            />
          )}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <ChartCard glow
          title="Padrão de horário"
          hint="Distribuição da receita líquida por faixa de horário do dia, na loja onde essa pessoa mais vendeu — mostra em que horário o movimento é mais forte."
          subtitle={
            lojaCodigo
              ? `Loja ${lojaCodigo}${lojaNome ? ' - ' + lojaNome : ''}${multiLoja ? ' (principal — maior GMV)' : ''} — não é possível segmentar por vendedor individual`
              : 'Indisponível'
          }
        >
          {!lojaCodigo ? (
            <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13, lineHeight: 1.6 }}>
              Não foi possível identificar a loja de {nome} no período.
            </div>
          ) : buckets.length === 0 ? (
            <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13, lineHeight: 1.6 }}>
              O arquivo <strong>relatorioVendaPorHora</strong> não foi importado, ou não tem dados para essa loja.
            </div>
          ) : (
            <>
              <RankingChart
                medals={false}
                items={buckets.map(b => ({
                  label: b.faixaHoraria,
                  value: b.receitaLiquida,
                  valueLabel: fmtBRLshort(b.receitaLiquida),
                }))}
              />
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', marginTop: 12, lineHeight: 1.5 }}>
                Este é o padrão de horário <strong>da loja inteira</strong> (todos os vendedores){multiLoja ? ', a unidade onde ' + nome + ' mais vendeu' : ''} —
                os arquivos de origem não trazem venda por hora quebrada por consultor/operador individual, então não é
                possível isolar só as vendas de {nome} por faixa horária.
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {hasExtras && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          {extras.lojaDigital.length > 0 && (
            <ChartCard glow
              title="Loja Digital"
              hint="Funil de atendimento via WhatsApp/canais digitais dessa pessoa: quantos clientes foram atendidos, quantos converteram em venda, e o tempo de resposta."
              subtitle="Funil de atendimento via WhatsApp/digital"
            >
              {extras.lojaDigital.map((r, i) => (
                <div key={i} style={{ fontSize: 13, borderBottom: i < extras.lojaDigital.length - 1 ? '1px solid var(--loja-bg-subtle, #F2EEE2)' : 'none', paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{lojaNomeLookup.get(r.pdvCodigo ?? '') ?? r.pdvCodigo}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRL(r.receita)}</span>
                  </div>
                  <div style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 12, marginTop: 2 }}>
                    {r.clientesConvertidos}/{r.clientesAtendidos} convertidos ({fmtPct(r.conversaoPct).replace('+', '')}) · TME (tempo médio de espera/atendimento) {r.tmeAjustado}
                  </div>
                </div>
              ))}
            </ChartCard>
          )}

          {extras.servicos.length > 0 && (
            <ChartCard glow
              title="Serviços em loja"
              hint="Serviços de beleza (maquiagem, cuidados faciais, cabelo...) realizados por essa pessoa, e quantos deles foram convertidos em venda (GMV)."
              subtitle={`${fmtNumber(servicosTotalCompletos)} serviços completos · ${fmtBRL(servicosTotalGmv)} em GMV`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {extras.servicos.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{r.servico}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)' }}>
                      {r.qtdCompletos}/{r.qtdRealizados} · {fmtBRL(r.gmv)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {extras.cuidadosFaciais.length > 0 && (
            <ChartCard glow
              title="Cuidados Faciais + Botik"
              hint="Receita gerada por essa pessoa nesse recorte específico de produtos (linha Botik e categoria Cuidados Faciais)."
              subtitle="Receita gerada nesse recorte"
            >
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtBRL(cuidadosTotal)}</div>
              <div style={{ fontSize: 12, color: 'var(--loja-text-secondary, #6B6258)', marginTop: 4 }}>
                dos quais {fmtBRL(cuidadosBotik)} em produtos Botik ({cuidadosTotal > 0 ? ((cuidadosBotik / cuidadosTotal) * 100).toFixed(0) : 0}%)
              </div>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsultorDetailPanel;
