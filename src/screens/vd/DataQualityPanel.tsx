import React, { useMemo } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import { useOrderStore } from '../../store/useOrderStore';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { calcEligibleRevenue } from '../../analytics/financialMetrics';
import { fmtBRL } from '../../utils/formatters';
import { isFVCOrder } from '../../analytics/fvc';
import { metaPefCanalVD } from '../../analytics/metaPefCanalVD';
import { ReportContext, VDCorporateFile, VD_CORPORATE_FILE_LABELS } from '../../types/vdCorporate';

/**
 * Relatórios cujo valor é receita em R$, em duas famílias. Dentro de cada família o tipo de receita
 * precisa ser igual; entre as famílias ele muda de propósito (Ciclo 14: ReceitaCanalVD_* e Receita_por_*
 * em "Receita Bruta", VendaDireta_* sempre em "Receita GMV"), então isso é informação, não alerta.
 */
const RECEITA_FILES: VDCorporateFile[] = [
  'receitaCanalVDPdv', 'receitaCanalVDUn', 'receitaCanalVDPeriodo', 'receitaCanalVDCiclo',
  'receitaPeriodo', 'receitaCanalUn', 'receitaCategoria',
];
const RECEITA_VD_FILES: VDCorporateFile[] = [
  'vdReceitaCiclo', 'distribuicaoReceita', 'receitaCategoriaMix', 'arvorePedidos',
  'performancePdvSupervisor', 'receitaUnGmv',
];

type CheckStatus = 'ok' | 'warn' | 'info';

interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const STATUS_META: Record<CheckStatus, { icon: string; color: string }> = {
  ok: { icon: 'ph-check-circle', color: 'var(--vd-success, #2E7D5B)' },
  warn: { icon: 'ph-warning', color: 'var(--vd-warning-strong, #C9A227)' },
  info: { icon: 'ph-info', color: 'var(--vd-text-muted, #9B9287)' },
};

/**
 * Roda, de forma automática a cada import, as mesmas validações que fizemos manualmente ao
 * construir a camada de dados corporativos (ver LEITURA_PLANILHAS_VD.md §5/§6) — reconciliação de
 * receita, consistência de tipo de receita entre relatórios, dias com receita zerada suspeita,
 * integridade do sell-in por SKU. Não é um teste automatizado no sentido de CI — roda no navegador,
 * sobre os dados já carregados, pra dar visibilidade rápida de qualidade sem abrir o console.
 */
const DataQualityPanel: React.FC = () => {
  const orders = useOrderStore(s => s.orders);
  const dataset = useVDCorporateStore(s => s.dataset);

  const checks = useMemo<QualityCheck[]>(() => {
    const list: QualityCheck[] = [];

    // 1) Reconciliação receita Order[] vs Extranet — sobre o extrato inteiro, sem os filtros globais (o total
    // da Extranet é o ciclo todo; um recorte mostraria divergência falsa).
    const totalRow = dataset?.receitaCanalVDPdv?.find(r => r.un.trim().toUpperCase() === 'TOTAL');
    if (orders.length > 0 && totalRow) {
      const ordersRevenue = calcEligibleRevenue(orders);
      const diffValor = ordersRevenue - totalRow.total.receitaAtual;
      const diffPct = totalRow.total.receitaAtual > 0 ? (diffValor / totalRow.total.receitaAtual) * 100 : 0;
      const bate = Math.abs(diffPct) <= 1;
      // 2 casas: com 1 casa uma diferença de -0,04% aparecia como "-0,0%", que parece erro de conta.
      const pctTxt = (diffPct >= 0 ? '+' : '−') + Math.abs(diffPct).toFixed(2).replace('.', ',') + '%';
      const valorTxt = (diffValor >= 0 ? '+' : '−') + fmtBRL(Math.abs(diffValor));
      list.push({
        id: 'reconciliacao',
        label: bate ? 'Receita de pedidos bate com a Extranet' : 'Receita de pedidos não bate com a Extranet',
        status: bate ? 'ok' : 'warn',
        detail: `Pedidos (FVC incluído) ${fmtBRL(ordersRevenue)} × Extranet ${fmtBRL(totalRow.total.receitaAtual)} (ReceitaCanalVD_Performance_por_PDV.xlsx): diferença de ${pctTxt} (${valorTxt}). Tolerância: ±1%.`,
      });
    }

    // 2) FVC informativo
    if (orders.length > 0) {
      const fvcCount = orders.filter(isFVCOrder).length;
      const pct = (fvcCount / orders.length) * 100;
      list.push({
        id: 'fvc',
        label: 'Pedidos FVC: no total da Extranet, fora da Visão geral',
        status: 'info',
        detail: `${fvcCount} de ${orders.length} pedidos (${pct.toFixed(1).replace('.', ',')}%) são de estrutura FVC. Eles entram nesta reconciliação, porque a receita da Extranet os inclui, mas a Visão geral os deixa de fora: a participação deles fica na tela FVC.`,
      });
    }

    // 3) Tipo de receita consistente entre os relatórios de RECEITA. Ruptura (% de itens) e base
    // (contagem de revendedores) também trazem o filtro na aba FILTROS ("Receita Bruta"/"Receita GMV"
    // no Ciclo 13), mas não têm valor em R$ que seja somado ou comparado com os de receita — incluí-los
    // gerava um alerta falso. Eles aparecem só como informação.
    if (dataset?.reportContexts) {
      const tipoPorArquivo = (Object.entries(dataset.reportContexts) as [VDCorporateFile, ReportContext | undefined][])
        .filter(([, ctx]) => !!ctx?.tipoReceita)
        .map(([file, ctx]) => ({ file, tipo: ctx!.tipoReceita! }));
      const receita = tipoPorArquivo.filter(r => RECEITA_FILES.includes(r.file));
      const receitaVD = tipoPorArquivo.filter(r => RECEITA_VD_FILES.includes(r.file));
      const outros = tipoPorArquivo.filter(r => !RECEITA_FILES.includes(r.file) && !RECEITA_VD_FILES.includes(r.file));
      const tiposReceita = [...new Set(receita.map(r => r.tipo))];
      const tiposReceitaVD = [...new Set(receitaVD.map(r => r.tipo))];

      const checarFamilia = (id: string, nome: string, arquivos: typeof receita, tipos: string[]) => {
        if (tipos.length > 1) {
          list.push({
            id,
            label: `Tipo de receita varia entre os relatórios ${nome}`,
            status: 'warn',
            detail: `Declaram tipos diferentes na aba FILTROS: ${arquivos.map(r => `${VD_CORPORATE_FILE_LABELS[r.file]} = "${r.tipo}"`).join('; ')}. Reexporte esses relatórios da Extranet com o mesmo filtro "Tipo de receita" antes de comparar os valores.`,
          });
        } else if (tipos.length === 1) {
          list.push({
            id,
            label: `Tipo de receita consistente entre os relatórios ${nome}`,
            status: 'ok',
            detail: `Os ${arquivos.length} relatórios declaram "${tipos[0]}" na aba FILTROS.`,
          });
        }
      };
      checarFamilia('tipo-receita', 'de receita por canal (ReceitaCanalVD / Receita_por)', receita, tiposReceita);
      checarFamilia('tipo-receita-vd', 'VendaDireta', receitaVD, tiposReceitaVD);
      if (tiposReceita.length === 1 && tiposReceitaVD.length === 1 && tiposReceita[0] !== tiposReceitaVD[0]) {
        list.push({
          id: 'tipo-receita-familias',
          label: 'Duas bases de receita no lote',
          status: 'info',
          detail: `Receita & Metas usa "${tiposReceita[0]}"; Pedidos & Mix usa "${tiposReceitaVD[0]}" (relatórios VendaDireta). Os totais não são iguais e não devem ser comparados entre as duas telas como se fossem a mesma conta.`,
        });
      }

      const outrosDiferentes = outros.filter(r => !tiposReceita.includes(r.tipo) && !tiposReceitaVD.includes(r.tipo));
      if (outrosDiferentes.length > 0) {
        const porTipo = new Map<string, string[]>();
        for (const r of outrosDiferentes) porTipo.set(r.tipo, [...(porTipo.get(r.tipo) ?? []), VD_CORPORATE_FILE_LABELS[r.file]]);
        list.push({
          id: 'tipo-receita-outros',
          label: 'Relatórios de ruptura e base usam outro tipo de receita',
          status: 'info',
          detail: `${[...porTipo].map(([tipo, arqs]) => `"${tipo}": ${arqs.join(', ')}`).join(' · ')}. Esses relatórios medem % de itens ou contagem de revendedores, não somam R$, então o filtro não altera a comparação com a receita.`,
        });
      }
    }

    // 4) Dias com receita zerada nos dois períodos. Receita_por_Periodo é por data de FATURAMENTO
    // (confere dia a dia com a DataFaturamento dos pedidos a partir de 03/09) — dia zerado é dia sem
    // faturamento, não falha do relatório.
    const diaRows = dataset?.receitaPeriodo?.dia ?? [];
    const zeroDays = diaRows.filter(r => r.label.toUpperCase() !== 'TOTAL' && r.receitaAnterior === 0 && r.receitaAtual === 0);
    if (zeroDays.length > 0) {
      list.push({
        id: 'dias-zerados',
        label: `${zeroDays.length} dia(s) com receita zerada em ambos os períodos`,
        status: 'info',
        detail: `${zeroDays.map(d => d.label).join(', ')} — o relatório é por data de faturamento, e nesses dias não houve faturamento (os pedidos do ConsultaPedidos também não têm DataFaturamento neles). Não é falha de captura.`,
      });
    }

    // 5) Integridade do detalhamento de Sell-In vs. total
    if (dataset?.sellInMeta?.[0] && dataset.sellInDetalheSku) {
      const somaDetalhe = dataset.sellInDetalheSku.reduce((s, r) => s + r.sugestaoComercial, 0);
      const total = dataset.sellInMeta[0].sugestaoComercial;
      const bate = somaDetalhe === total;
      list.push({
        id: 'sellin-integridade',
        label: bate ? 'Detalhamento de Sell-In bate com o total' : 'Detalhamento de Sell-In não bate com o total',
        status: bate ? 'ok' : 'warn',
        detail: `Soma de "Sugestão Comercial" por SKU×PDV: ${somaDetalhe.toLocaleString('pt-BR')} — total do arquivo agregado: ${total.toLocaleString('pt-BR')}.`,
      });
    }

    // 6) Meta PEF zerada — a Extranet exporta 0 quando a meta do ciclo ainda não foi cadastrada.
    // Se a meta foi informada à mão (metaPefCanalVD.ts), vira informação em vez de alerta.
    const metaCanal = metaPefCanalVD(dataset);
    if (totalRow && totalRow.total.metaPef === 0 && metaCanal?.origem === 'manual') {
      list.push({
        id: 'meta-zerada',
        label: 'Meta PEF zerada no arquivo, usando a meta informada',
        status: 'info',
        detail: `A Extranet exportou META PEF = 0. O app usa a meta do canal VD informada manualmente: ${fmtBRL(metaCanal.total)} (Venda Direta ${fmtBRL(metaCanal.vd)} + Omni Envio ER ${fmtBRL(metaCanal.omni)}). Ela existe só no total do canal; PDVs e UNs seguem sem meta.`,
      });
    } else if (totalRow && totalRow.total.metaPef === 0 && totalRow.total.receitaAtual > 0) {
      list.push({
        id: 'meta-zerada',
        label: 'Meta PEF do ciclo veio zerada',
        status: 'warn',
        detail: 'ReceitaCanalVD_Performance_por_PDV, ReceitaCanalVD_por_UN e ReceitaCanalVD_por_Ciclo trazem meta 0 em todas as linhas: a meta ainda não foi lançada na Extranet. % realizado e gap ficam sem valor até os arquivos serem exportados de novo, com a meta.',
      });
    }

    // 7) Ativos: o mesmo número em 3 relatórios de base.
    const monitorTotal = dataset?.monitoramentoBase?.porPdv.find(r => r.chave.trim().toUpperCase() === 'TOTAL');
    const digitaisTotal = dataset?.ferramentasDigitaisPdv?.find(r => r.pdv === 'TOTAL');
    const ativosFontes = [
      monitorTotal ? { nome: 'Monitoramento da base', v: monitorTotal.ativosBaseTotal } : null,
      digitaisTotal ? { nome: 'Ferramentas digitais por PDV', v: digitaisTotal.ativas } : null,
      dataset?.ativasCanaisDigitais ? { nome: 'Ativas — canais digitais', v: dataset.ativasCanaisDigitais.ativas } : null,
      dataset?.ativasEspacoRevendedor ? { nome: 'Ativas — Espaço Revendedor', v: dataset.ativasEspacoRevendedor.ativas } : null,
    ].filter((x): x is { nome: string; v: number } => !!x);
    if (ativosFontes.length >= 2) {
      const bate = ativosFontes.every(f => f.v === ativosFontes[0].v);
      list.push({
        id: 'ativos-consistentes',
        label: bate ? 'Número de ativos bate entre os relatórios de base' : 'Número de ativos diverge entre os relatórios de base',
        status: bate ? 'ok' : 'warn',
        detail: `${ativosFontes.map(f => `${f.nome}: ${f.v.toLocaleString('pt-BR')}`).join(' · ')}.`,
      });
    }

    // 8) Opt-out: a base total do relatório de catálogo é a mesma do Monitoramento.
    if (dataset?.optOutBase && monitorTotal) {
      const bate = dataset.optOutBase.baseTotal === monitorTotal.baseTotal;
      list.push({
        id: 'optout-base',
        label: bate ? 'Base do opt-out de catálogos bate com o Monitoramento' : 'Base do opt-out de catálogos não bate com o Monitoramento',
        status: bate ? 'ok' : 'warn',
        detail: `Opt-out: base total ${dataset.optOutBase.baseTotal.toLocaleString('pt-BR')} · Monitoramento: ${monitorTotal.baseTotal.toLocaleString('pt-BR')}.`,
      });
    }

    // 9) Histórico de colocação por SKU soma o mesmo que a Visão geral do ciclo.
    const visao = dataset?.pedidosVisaoGeral?.[0];
    if (visao && dataset?.pedidosColocacao && dataset.pedidosColocacao.length > 0) {
      const soma = (k: 'volumeSugestao' | 'volumeColocado' | 'volumeFaturado') => dataset.pedidosColocacao!.reduce((s, r) => s + r[k], 0);
      const pares = [
        ['sugestão', soma('volumeSugestao'), visao.metaSugestao],
        ['pedido', soma('volumeColocado'), visao.pedidoRealizado],
        ['faturado', soma('volumeFaturado'), visao.pedidoFaturado],
      ] as const;
      const bate = pares.every(([, a, b]) => Math.abs(a - b) < 0.5);
      list.push({
        id: 'colocacao-integridade',
        label: bate ? 'Histórico de colocação bate com a visão geral de pedidos' : 'Histórico de colocação não bate com a visão geral de pedidos',
        status: bate ? 'ok' : 'warn',
        detail: pares.map(([n, a, b]) => `${n}: ${a.toLocaleString('pt-BR')} por SKU × ${b.toLocaleString('pt-BR')} no total`).join(' · ') + '.',
      });
    }

    // 10) Árvore de pedidos: faixas somam o total; e o total contra o ConsultaPedidos.
    const arvore = dataset?.arvorePedidos;
    if (arvore?.totalPedidos && arvore.faixas.length > 0) {
      const somaFaixas = arvore.faixas.reduce((s, f) => s + f.atual, 0);
      const bate = somaFaixas === arvore.totalPedidos.atual;
      const naoCancelados = orders.filter(o => o.SituacaoComercial !== 'Cancelado').length;
      list.push({
        id: 'arvore-pedidos',
        label: bate ? 'Faixas de valor somam o total de pedidos' : 'Faixas de valor não somam o total de pedidos',
        status: bate ? 'ok' : 'warn',
        detail: `Árvore de Pedidos: ${somaFaixas.toLocaleString('pt-BR')} nas faixas × ${arvore.totalPedidos.atual.toLocaleString('pt-BR')} no total.`
          + (orders.length > 0 ? ` O ConsultaPedidos tem ${orders.length.toLocaleString('pt-BR')} pedidos (${naoCancelados.toLocaleString('pt-BR')} não cancelados) — os relatórios da Extranet e o extrato saem em momentos diferentes, então alguns pedidos de diferença são esperados.` : ''),
      });
    }

    // 11) Performance PDV/Supervisor: fora da linha TOTAL, as faixas somam mais que os pedidos.
    const perfTotal = dataset?.performancePdvSupervisor?.pdv.find(r => r.nome.toUpperCase() === 'TOTAL');
    if (perfTotal) {
      const somaFaixas = perfTotal.faixas.reduce((s, f) => s + f.quantidade, 0);
      if (somaFaixas !== perfTotal.qtdPedidos) {
        list.push({
          id: 'performance-faixas',
          label: 'Faixas de valor da Performance por PDV/supervisor não são pedidos',
          status: 'info',
          detail: `As colunas de faixa somam ${somaFaixas.toLocaleString('pt-BR')} contra ${perfTotal.qtdPedidos.toLocaleString('pt-BR')} pedidos, e o "pedido médio" das linhas por PDV/supervisor divide a receita por essa soma. Em Pedidos & Mix o pedido médio é recalculado (receita ÷ pedidos) e as faixas aparecem só como proporção.`,
        });
      }
    }

    // 12) Mix de categorias: o total não fecha com a receita GMV dos outros relatórios VendaDireta.
    const mixCp = dataset?.receitaCategoriaMix?.cp[0];
    const gmvCp = dataset?.distribuicaoReceita?.cp[0]?.atual ?? dataset?.vdReceitaCiclo?.[0]?.atual;
    if (mixCp && gmvCp) {
      const diffPct = ((mixCp.totalReceita - gmvCp) / gmvCp) * 100;
      const bate = Math.abs(diffPct) <= 0.5;
      list.push({
        id: 'mix-categoria-total',
        label: bate ? 'Mix de categorias bate com a receita GMV' : 'Mix de categorias não fecha com a receita GMV',
        status: bate ? 'ok' : 'warn',
        detail: `Distribuição por categoria: ${fmtBRL(mixCp.totalReceita)} × receita GMV do CP: ${fmtBRL(gmvCp)} (${diffPct >= 0 ? '+' : '−'}${Math.abs(diffPct).toFixed(2).replace('.', ',')}%). Os dois declaram "Receita GMV". Use o mix para comparar a composição, não o valor.`,
      });
    }

    // 13) Aderência: a Extranet ignora o filtro de canal.
    if (dataset?.aderencia && dataset.aderencia.pdv.length > 0) {
      list.push({
        id: 'aderencia-canal',
        label: 'Aderência por curva traz lojas e VD juntos',
        status: 'info',
        detail: `O arquivo vem com CANAL = VD na aba FILTROS, mas lista ${dataset.aderencia.pdv.length} PDVs (lojas físicas incluídas) e os mesmos números do Modo Loja. A tela Sell-In & Reposição mostra só os PDVs da Venda Direta; a linha do CP e a evolução semanal são da rede inteira.`,
      });
    }

    // 14) Ruptura por item — sempre lembrete, nunca falha
    if (dataset?.rupturaPorItem && dataset.rupturaPorItem.length > 0) {
      list.push({
        id: 'ruptura-amostra',
        label: 'Detalhamento de ruptura por item é amostra, não catálogo completo',
        status: 'info',
        detail: `${dataset.rupturaPorItem.length} SKUs monitorados nesta planilha — o catálogo real tem muito mais itens (ver Ranking de Produtos). Não trate como universo completo de ruptura.`,
      });
    }

    return list;
  }, [orders, dataset]);

  if (checks.length === 0) return null;

  const verificacoes = checks.filter(c => c.status !== 'info').sort((a, b) => (a.status === 'warn' ? 0 : 1) - (b.status === 'warn' ? 0 : 1));
  const avisos = checks.filter(c => c.status === 'info');
  const warnCount = verificacoes.filter(c => c.status === 'warn').length;

  const renderCheck = (c: QualityCheck) => {
    const meta = STATUS_META[c.status];
    return (
      <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <i className={`ph ph-bold ${meta.icon}`} style={{ fontSize: 16, color: meta.color, marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vd-ink, #1C1814)' }}>{c.label}</div>
          <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 2 }}>{c.detail}</div>
        </div>
      </div>
    );
  };

  return (
    <ChartCard
      title="Verificações de qualidade"
      subtitle={warnCount > 0
        ? `${warnCount} ponto(s) de atenção de ${verificacoes.length} verificações`
        : `${verificacoes.length} verificações, sem alertas`}
      hint="Roda automaticamente sobre os dados carregados as mesmas checagens de consistência feitas manualmente ao construir esta camada — não é teste de CI, é uma auditoria rápida do que está na tela agora. Os itens em 'Para ter em mente' não são falhas: explicam como ler os números."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {verificacoes.map(renderCheck)}
      </div>
      {avisos.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--vd-text-muted, #9B9287)', margin: '18px 0 10px', paddingTop: 14,
            borderTop: '1px solid var(--vd-border, #E8E2D6)',
          }}>
            Para ter em mente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {avisos.map(renderCheck)}
          </div>
        </>
      )}
    </ChartCard>
  );
};

export default DataQualityPanel;
