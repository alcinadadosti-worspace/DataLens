import React, { useMemo } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import { useOrderStore } from '../../store/useOrderStore';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { calcEligibleRevenue } from '../../analytics/financialMetrics';
import { fmtBRL } from '../../utils/formatters';
import { isFVCOrder } from '../../analytics/fvc';
import { ReportContext, VDCorporateFile, VD_CORPORATE_FILE_LABELS } from '../../types/vdCorporate';

/** Relatórios cujo valor é receita em R$ — só entre eles o tipo de receita precisa ser igual. */
const RECEITA_FILES: VDCorporateFile[] = [
  'receitaCanalVDPdv', 'receitaCanalVDUn', 'receitaCanalVDPeriodo',
  'receitaPeriodo', 'receitaCanalUn', 'receitaCategoria',
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

    // 1) Reconciliação receita Order[] vs BI — sobre o extrato inteiro, sem os filtros globais (o total
    // do BI é o ciclo todo; um recorte mostraria divergência falsa).
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
        label: bate ? 'Receita de pedidos bate com o BI corporativo' : 'Receita de pedidos não bate com o BI corporativo',
        status: bate ? 'ok' : 'warn',
        detail: `Pedidos (FVC incluído) ${fmtBRL(ordersRevenue)} × BI ${fmtBRL(totalRow.total.receitaAtual)} (ReceitaCanalVD_Performance_por_PDV.xlsx): diferença de ${pctTxt} (${valorTxt}). Tolerância: ±1%.`,
      });
    }

    // 2) FVC informativo
    if (orders.length > 0) {
      const fvcCount = orders.filter(isFVCOrder).length;
      const pct = (fvcCount / orders.length) * 100;
      list.push({
        id: 'fvc',
        label: 'Pedidos FVC: no total do BI, fora da Visão geral',
        status: 'info',
        detail: `${fvcCount} de ${orders.length} pedidos (${pct.toFixed(1).replace('.', ',')}%) são de estrutura FVC. Eles entram nesta reconciliação, porque a receita do BI os inclui, mas a Visão geral os deixa de fora: a participação deles fica na tela FVC.`,
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
      const outros = tipoPorArquivo.filter(r => !RECEITA_FILES.includes(r.file));
      const tiposReceita = [...new Set(receita.map(r => r.tipo))];

      if (tiposReceita.length > 1) {
        list.push({
          id: 'tipo-receita',
          label: 'Tipo de receita varia entre relatórios de receita',
          status: 'warn',
          detail: `Os relatórios de receita declaram tipos diferentes na aba FILTROS: ${receita.map(r => `${VD_CORPORATE_FILE_LABELS[r.file]} = "${r.tipo}"`).join('; ')}. Reexporte todos do BI com o mesmo filtro "Tipo de receita" antes de comparar os valores.`,
        });
      } else if (tiposReceita.length === 1) {
        list.push({
          id: 'tipo-receita',
          label: 'Tipo de receita consistente entre relatórios de receita',
          status: 'ok',
          detail: `Os ${receita.length} relatórios de receita declaram "${tiposReceita[0]}" na aba FILTROS.`,
        });
      }

      const outrosDiferentes = outros.filter(r => !tiposReceita.includes(r.tipo));
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

    // 6) Ruptura por item — sempre lembrete, nunca falha
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
