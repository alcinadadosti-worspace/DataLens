import React, { useMemo } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import { useOrderStore } from '../../store/useOrderStore';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { useFinancialMetrics } from '../../hooks/useAnalytics';
import { fmtPct } from '../../utils/formatters';
import { isFVCOrder } from '../../analytics/fvc';

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
  const financial = useFinancialMetrics();

  const checks = useMemo<QualityCheck[]>(() => {
    const list: QualityCheck[] = [];

    // 1) Reconciliação receita Order[] vs BI
    const totalRow = dataset?.receitaCanalVDPdv?.find(r => r.un.trim().toUpperCase() === 'TOTAL');
    if (financial && totalRow) {
      const diffPct = totalRow.total.receitaAtual > 0
        ? ((financial.grossRevenue - totalRow.total.receitaAtual) / totalRow.total.receitaAtual) * 100
        : 0;
      list.push({
        id: 'reconciliacao',
        label: 'Receita de pedidos bate com o BI corporativo',
        status: Math.abs(diffPct) <= 1 ? 'ok' : Math.abs(diffPct) <= 5 ? 'warn' : 'warn',
        detail: `Diferença de ${fmtPct(diffPct)} entre a soma de Order[] (FVC incluído) e ReceitaCanalVD_Performance_por_PDV.xlsx.`,
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

    // 3) Tipo de receita consistente entre relatórios de Família C
    if (dataset?.reportContexts) {
      const tipos = new Set(
        Object.values(dataset.reportContexts)
          .map(ctx => ctx?.tipoReceita)
          .filter((t): t is string => !!t)
      );
      if (tipos.size > 1) {
        list.push({
          id: 'tipo-receita',
          label: 'Tipo de receita varia entre relatórios',
          status: 'warn',
          detail: `Os relatórios carregados declaram tipos de receita diferentes na aba FILTROS (${[...tipos].join(', ')}) — comparar números entre eles sem checar isso pode gerar conclusão errada.`,
        });
      } else if (tipos.size === 1) {
        list.push({
          id: 'tipo-receita',
          label: 'Tipo de receita consistente entre relatórios',
          status: 'ok',
          detail: `Todos os relatórios de receita carregados declaram "${[...tipos][0]}" na aba FILTROS.`,
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
  }, [orders, dataset, financial]);

  if (checks.length === 0) return null;

  const warnCount = checks.filter(c => c.status === 'warn').length;

  return (
    <ChartCard
      title="Verificações de qualidade"
      subtitle={warnCount > 0 ? `${warnCount} ponto(s) de atenção de ${checks.length} verificações` : `${checks.length} verificações, sem alertas`}
      hint="Roda automaticamente sobre os dados carregados as mesmas checagens de consistência feitas manualmente ao construir esta camada — não é teste de CI, é uma auditoria rápida do que está na tela agora."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {checks.map(c => {
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
        })}
      </div>
    </ChartCard>
  );
};

export default DataQualityPanel;
