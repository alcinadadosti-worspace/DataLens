import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import KpiCard from '../../components/ui/KpiCard';
import PageTitle from '../../components/ui/PageTitle';
import { CelulaVariacao, ColunaTabela, LojaTabela, LojaVazio, SeletorLoja, fmtDuracaoSeg, pct, variacao } from '../../components/loja/lojaUi';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { chaveMetrica } from '../../parsers/lojaExtranetParser';
import { fmtNumber } from '../../utils/formatters';
import { IdClienteConsultorRow, PdvMetricasRow } from '../../types/lojaExtranet';

const C = {
  atendimentos: chaveMetrica('ATENDIMENTOS NO ID CLIENTE'),
  validos: chaveMetrica('% BOLETOS ID CLIENTE VÁLIDOS (IAF)'),
  usoIndevido: chaveMetrica('% ATENDIMENTOS USO INDEVIDO'),
  tma: chaveMetrica('TEMPO MÉDIO DE ATENDIMENTO (TMA CPF)'),
  abaixo2min: chaveMetrica('% BOLETO ID CLIENTE ABAIXO DE 2MIN'),
};

const fracao = (v: number | null | undefined) => (v == null ? null : v * 100);

const LojaIdClienteScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [loja, setLoja] = useState('');

  const id = dataset?.idCliente;
  if (!id) {
    return <LojaVazio onNavigate={onNavigate} mensagem={<>O arquivo <strong>Indicadores_ID_Cliente</strong> não foi importado.</>} />;
  }

  const evolucao = dataset?.idClienteEvolucao?.[0];
  const resultado = (rotulo: RegExp) => id.benchmark.find(b => rotulo.test(b.indicador))?.resultado ?? '—';
  const lojas = id.pdv.map(p => ({ codigo: p.pdv, nome: resolveLojaNome(p.pdv, p.pdv) }));
  const consultores = id.consultor.filter(c => c.atendimentos > 0 && (!loja || c.pdv === loja));

  const colunasPdv: ColunaTabela<PdvMetricasRow>[] = [
    { id: 'loja', titulo: 'Loja', valor: r => <strong>{resolveLojaNome(r.pdv, r.pdv)}</strong> },
    { id: 'atend', titulo: 'Atendimentos', direita: true, valor: r => fmtNumber(r.metricas[C.atendimentos]?.atual ?? 0), ordem: r => r.metricas[C.atendimentos]?.atual ?? null },
    {
      id: 'atendVar', titulo: 'vs. 2025', direita: true,
      valor: r => <CelulaVariacao valor={variacao(r.metricas[C.atendimentos]?.anterior, r.metricas[C.atendimentos]?.atual)} />,
      ordem: r => variacao(r.metricas[C.atendimentos]?.anterior, r.metricas[C.atendimentos]?.atual),
    },
    { id: 'validos', titulo: '% boletos válidos', direita: true, valor: r => pct(fracao(r.metricas[C.validos]?.atual), 2), ordem: r => r.metricas[C.validos]?.atual ?? null },
    { id: 'indevido', titulo: '% uso indevido', direita: true, valor: r => pct(fracao(r.metricas[C.usoIndevido]?.atual), 2), ordem: r => r.metricas[C.usoIndevido]?.atual ?? null },
    { id: 'abaixo', titulo: '% abaixo de 2 min', direita: true, valor: r => pct(fracao(r.metricas[C.abaixo2min]?.atual), 2), ordem: r => r.metricas[C.abaixo2min]?.atual ?? null },
    { id: 'tma', titulo: 'TMA', direita: true, valor: r => fmtDuracaoSeg(r.metricas[C.tma]?.atual), ordem: r => r.metricas[C.tma]?.atual ?? null },
  ];

  const colunasConsultor: ColunaTabela<IdClienteConsultorRow>[] = [
    { id: 'nome', titulo: 'Consultor', valor: r => <strong>{r.consultor}</strong>, ordem: r => r.consultor },
    { id: 'loja', titulo: 'Loja', valor: r => resolveLojaNome(r.pdv, r.pdv) },
    { id: 'atend', titulo: 'Atendimentos', direita: true, valor: r => fmtNumber(r.atendimentos), ordem: r => r.atendimentos },
    { id: 'boletos', titulo: 'Boletos', direita: true, valor: r => fmtNumber(r.totalBoletos), ordem: r => r.totalBoletos },
    { id: 'validos', titulo: '% válidos', direita: true, valor: r => pct(r.boletosValidosPct * 100), ordem: r => r.boletosValidosPct },
    { id: 'indevido', titulo: '% uso indevido', direita: true, valor: r => pct(r.atendimentosUsoIndevidoPct * 100), ordem: r => r.atendimentosUsoIndevidoPct },
    { id: 'abaixo', titulo: '% abaixo de 2 min', direita: true, valor: r => pct(r.boletosAbaixo2MinPct * 100), ordem: r => r.boletosAbaixo2MinPct },
    { id: 'tma', titulo: 'TMA', direita: true, valor: r => fmtDuracaoSeg(r.tmaSegundos), ordem: r => r.tmaSegundos },
  ];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="ID Cliente"
          hint="Quanto do atendimento em loja está identificado com o CPF do cliente, com qual qualidade e em que tempo."
        />
        <SeletorLoja lojas={lojas} valor={loja} onChange={setLoja} />
      </div>
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
        <KpiCard glow eyebrow="Boletos com ID Cliente" value={evolucao ? pct(evolucao.pct, 2) : resultado(/válidos/i)}
          meta={evolucao ? `${fmtNumber(evolucao.comId)} de ${fmtNumber(evolucao.totalBoletos)} boletos` : undefined}
          hint="ID_Cliente_Evolucao_Boletos.xlsx. A base aqui é a do relatório de ID Cliente, um pouco maior que a de Boletos & alavancas." />
        <KpiCard glow eyebrow="Atendimentos" value={resultado(/^Atendimentos no ID/i)} meta={`${resultado(/^Atendimentos com CPF/i)} com CPF`}
          hint="Atendimentos registrados no ID Cliente, com e sem compra." />
        <KpiCard glow eyebrow="Uso indevido" value={resultado(/^% Atendimentos Uso Indevido/i)} meta={`${resultado(/^Atendimentos Uso Indevido/i)} atendimentos`}
          hint="Parcela dos atendimentos com CPF marcada como uso indevido no relatório." />
        <KpiCard glow eyebrow="TMA com CPF" value={resultado(/TMA CPF\)$/i)} hint="Tempo médio de atendimento com CPF." />
      </div>

      <ChartCard glow title="Loja a loja" subtitle="Clique na coluna para ordenar"
        hint="Indicadores_ID_Cliente.xlsx, aba PDV. '% boletos válidos' é o indicador do IAF. 'vs. 2025' fica vazio em loja sem movimento no ano anterior.">
        <LojaTabela colunas={colunasPdv} linhas={loja ? id.pdv.filter(p => p.pdv === loja) : id.pdv} chave={r => r.pdv} ordemInicial={{ id: 'atend', desc: true }} />
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginTop: 20 }}>
        <ChartCard glow title="Boletos válidos por consultor" subtitle="% de boletos com ID Cliente válido"
          hint="Indicadores_ID_Cliente.xlsx, aba CONSULTOR. Só entram consultores com atendimento no ID Cliente.">
          <RankingChart
            medals={false}
            items={[...consultores].sort((a, b) => b.boletosValidosPct - a.boletosValidosPct).map(r => ({
              label: r.consultor,
              sublabel: resolveLojaNome(r.pdv, r.pdv),
              value: r.boletosValidosPct * 100,
              valueLabel: pct(r.boletosValidosPct * 100),
              meta: `${fmtNumber(r.boletosId)} de ${fmtNumber(r.totalBoletos)}`,
            }))}
          />
        </ChartCard>
        <ChartCard glow title="Uso indevido por consultor" subtitle="% dos atendimentos com CPF"
          hint="Indicadores_ID_Cliente.xlsx, aba CONSULTOR. Aqui, menos é melhor.">
          <RankingChart
            medals={false}
            items={[...consultores].filter(r => r.atendimentosUsoIndevido > 0).sort((a, b) => b.atendimentosUsoIndevidoPct - a.atendimentosUsoIndevidoPct).map(r => ({
              label: r.consultor,
              sublabel: resolveLojaNome(r.pdv, r.pdv),
              value: r.atendimentosUsoIndevidoPct * 100,
              valueLabel: pct(r.atendimentosUsoIndevidoPct * 100),
              meta: `${fmtNumber(r.atendimentosUsoIndevido)} de ${fmtNumber(r.atendimentosCpf)}`,
            }))}
          />
        </ChartCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard glow title="Detalhe por consultor" subtitle="Clique na coluna para ordenar" hint="Indicadores_ID_Cliente.xlsx, aba CONSULTOR. Quem atende em mais de uma loja aparece uma vez por loja.">
          <LojaTabela colunas={colunasConsultor} linhas={consultores} chave={(r, i) => `${r.pdv}-${r.consultor}-${i}`} ordemInicial={{ id: 'atend', desc: true }} />
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaIdClienteScreen;
