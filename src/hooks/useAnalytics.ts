import { useMemo } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';
import { Order } from '../types/order';
import { calcFinancialMetrics } from '../analytics/financialMetrics';
import { calcOperationalMetrics } from '../analytics/operationalMetrics';
import { calcCommercialMetrics } from '../analytics/commercialMetrics';
import { generateInsights } from '../analytics/insightsEngine';
import { TIER_DEFINITIONS } from '../design-system/tierStyles';
import { parseBRDate } from '../utils/dateUtils';
import { pdvForOrder } from '../analytics/pdvMapping';
import { isFVCOrder } from '../analytics/fvc';
import { dominantCiclo } from '../analytics/vdSnapshot';
import { useVDCorporateStore } from '../store/useVDCorporateStore';
import {
  FinancialMetrics,
  OperationalMetrics,
  CommercialMetrics,
  InsightItem,
  TierMetrics,
} from '../types/analytics';

/**
 * `ignoreDateAndCycle` deixa de fora os filtros de ciclo/período — usado pela Comparação Semanal,
 * que precisa enxergar vários ciclos/semanas ao mesmo tempo pra comparar entre eles; aplicar o
 * filtro global de ciclo ali apagaria a própria comparação que a tela existe pra fazer. Os demais
 * filtros (supervisor, estrutura, cidade, tier etc.) continuam valendo normalmente.
 *
 * `excludeFVC` tira os pedidos de estrutura FVC — usado pela Visão geral, que mostra o faturamento sem
 * FVC (a participação das FVCs e o total geral ficam na tela FVC).
 */
export interface OrderScopeOptions {
  ignoreDateAndCycle?: boolean;
  excludeFVC?: boolean;
}

export function useFilteredOrders(opts?: OrderScopeOptions): Order[] {
  const orders = useOrderStore(s => s.orders);
  const filters = useFilterStore();
  const ignoreDateAndCycle = opts?.ignoreDateAndCycle ?? false;
  const excludeFVC = opts?.excludeFVC ?? false;

  return useMemo(() => {
    return orders.filter(order => {
      if (excludeFVC && isFVCOrder(order)) return false;
      if (!ignoreDateAndCycle && filters.cycle?.length && !filters.cycle.includes(order.CicloMarketing)) return false;
      if (filters.supervisor?.length && !filters.supervisor.includes(order.ResponsavelEstrutura)) return false;
      if (filters.structure?.length && !filters.structure.includes(order.Estrutura)) return false;
      if (filters.city?.length && !filters.city.includes(order.CidadeEntregaRetirada)) return false;
      if (filters.state?.length && !filters.state.includes(order.UFEntregaRetirada)) return false;
      if (filters.modeloComercial?.length && !filters.modeloComercial.includes(order.ModeloComercial)) return false;
      if (filters.meioCaptacao?.length && !filters.meioCaptacao.includes(order.MeioCaptacao)) return false;
      if (filters.situacaoComercial?.length && !filters.situacaoComercial.includes(order.SituacaoComercial)) return false;
      if (filters.tier?.length && !filters.tier.includes(order.tierId)) return false;
      if (filters.pdv?.length) {
        const pdv = pdvForOrder(order);
        if (!pdv || !filters.pdv.includes(pdv)) return false;
      }

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const haystack = [
          order.NomePessoa,
          order.Pessoa,
          order.CodigoPedido,
          order.ResponsavelEstrutura,
          order.Estrutura,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (!ignoreDateAndCycle && (filters.dateFrom || filters.dateTo)) {
        const orderDate = parseBRDate(order.DataCaptacao);
        if (orderDate) {
          if (filters.dateFrom) {
            const from = new Date(filters.dateFrom + 'T00:00:00');
            if (orderDate < from) return false;
          }
          if (filters.dateTo) {
            const to = new Date(filters.dateTo + 'T23:59:59');
            if (orderDate > to) return false;
          }
        }
      }

      return true;
    });
  }, [orders, filters, ignoreDateAndCycle, excludeFVC]);
}

/**
 * `true` quando a tela mostra o ciclo inteiro do BI, sem recortes (só o filtro de ciclo, no ciclo do
 * lote). É a única situação em que os números oficiais do BI valem: com qualquer outro filtro, o BI
 * não tem o número equivalente.
 */
function useIsFullCycleView(): boolean {
  const orders = useOrderStore(s => s.orders);
  const filters = useFilterStore();
  return useMemo(() => {
    const { cycle, searchQuery, dateFrom, dateTo, ...rest } = filters;
    const hasOtherFilters = Object.values(rest).some(v => Array.isArray(v) && v.length > 0);
    if (hasOtherFilters || searchQuery || dateFrom || dateTo) return false;
    return !cycle || (cycle.length === 1 && cycle[0] === dominantCiclo(orders));
  }, [filters, orders]);
}

/**
 * Receita oficial do canal VD no BI (coluna VD, linha TOTAL de ReceitaCanalVD_Performance_por_PDV),
 * que inclui os pedidos FVC. `null` fora do ciclo inteiro sem recortes ou sem o relatório carregado.
 */
export function useOfficialVDRevenue(): number | null {
  const fullCycle = useIsFullCycleView();
  const corporate = useVDCorporateStore(s => s.dataset);
  if (!fullCycle) return null;
  return corporate?.receitaCanalVDPdv?.find(r => r.un.trim().toUpperCase() === 'TOTAL')?.vd.receitaAtual ?? null;
}

/**
 * RPA oficial do BI (linha TOTAL do Monitoramento por PDV), que inclui os revendedores FVC. `null`
 * fora do ciclo inteiro sem recortes ou sem o relatório carregado.
 */
export function useOfficialRPA(): number | null {
  const fullCycle = useIsFullCycleView();
  const corporate = useVDCorporateStore(s => s.dataset);
  if (!fullCycle) return null;
  return corporate?.monitoramentoBase?.porPdv.find(r => r.chave.trim().toUpperCase() === 'TOTAL')?.rpa ?? null;
}

export function useFinancialMetrics(opts?: OrderScopeOptions): FinancialMetrics | null {
  const orders = useFilteredOrders(opts);
  return useMemo(() => {
    if (orders.length === 0) return null;
    return calcFinancialMetrics(orders);
  }, [orders]);
}

export function useOperationalMetrics(): OperationalMetrics | null {
  const orders = useFilteredOrders();
  return useMemo(() => {
    if (orders.length === 0) return null;
    return calcOperationalMetrics(orders);
  }, [orders]);
}

export function useCommercialMetrics(): CommercialMetrics | null {
  const orders = useFilteredOrders();
  return useMemo(() => {
    if (orders.length === 0) return null;
    return calcCommercialMetrics(orders);
  }, [orders]);
}

export function useInsights(): InsightItem[] {
  const financial = useFinancialMetrics();
  const operational = useOperationalMetrics();
  const commercial = useCommercialMetrics();

  return useMemo(() => {
    if (!financial || !operational || !commercial) return [];
    return generateInsights(financial, operational, commercial);
  }, [financial, operational, commercial]);
}

export function useTierMetrics(opts?: OrderScopeOptions): TierMetrics[] {
  const orders = useFilteredOrders(opts);

  return useMemo(() => {
    if (orders.length === 0) return [];

    return TIER_DEFINITIONS.map(def => {
      const tierOrders = orders.filter(o => o.tierId === def.id);
      const eligibleOrders = tierOrders.filter(
        o => o.SituacaoComercial !== 'Cancelado' && o.DetalheSituacaoComercial !== 'Cancelado Pelo Usuário'
      );
      const totalRevenue = eligibleOrders.reduce((s, o) => s + o.ValorPraticado, 0);
      const resellerSet = new Set(tierOrders.map(o => o.Pessoa).filter(Boolean));

      return {
        tierId: def.id,
        name: def.name,
        orderCount: tierOrders.length,
        resellerCount: resellerSet.size,
        totalRevenue,
        avgTicket: eligibleOrders.length > 0 ? totalRevenue / eligibleOrders.length : 0,
        growth: 0, // Would need historical data for real growth
      };
    });
  }, [orders]);
}
