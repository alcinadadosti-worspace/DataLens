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
import {
  FinancialMetrics,
  OperationalMetrics,
  CommercialMetrics,
  InsightItem,
  TierMetrics,
} from '../types/analytics';

export function useFilteredOrders(): Order[] {
  const orders = useOrderStore(s => s.orders);
  const filters = useFilterStore();

  return useMemo(() => {
    return orders.filter(order => {
      if (filters.cycle?.length && !filters.cycle.includes(order.CicloMarketing)) return false;
      if (filters.supervisor?.length && !filters.supervisor.includes(order.ResponsavelEstrutura)) return false;
      if (filters.structure?.length && !filters.structure.includes(order.Estrutura)) return false;
      if (filters.city?.length && !filters.city.includes(order.CidadeEntregaRetirada)) return false;
      if (filters.state?.length && !filters.state.includes(order.UFEntregaRetirada)) return false;
      if (filters.modeloComercial?.length && !filters.modeloComercial.includes(order.ModeloComercial)) return false;
      if (filters.meioCaptacao?.length && !filters.meioCaptacao.includes(order.MeioCaptacao)) return false;
      if (filters.situacaoComercial?.length && !filters.situacaoComercial.includes(order.SituacaoComercial)) return false;
      if (filters.tier?.length && !filters.tier.includes(order.tierId)) return false;

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

      if (filters.dateFrom || filters.dateTo) {
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
  }, [orders, filters]);
}

export function useFinancialMetrics(): FinancialMetrics | null {
  const orders = useFilteredOrders();
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

export function useTierMetrics(): TierMetrics[] {
  const orders = useFilteredOrders();

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
