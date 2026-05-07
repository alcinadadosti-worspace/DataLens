import { Order } from '../types/order';
import { CommercialMetrics } from '../types/analytics';
import { isRevenueEligible } from './financialMetrics';

export function calcCommercialMetrics(orders: Order[]): CommercialMetrics {
  const cancelledCount = orders.filter(o => !isRevenueEligible(o)).length;
  const cancellationRate = orders.length > 0 ? (cancelledCount / orders.length) * 100 : 0;

  // Active resellers — those with at least one non-cancelled order
  const resellerOrderMap: Record<string, { name: string; tier: string; orders: Order[] }> = {};
  for (const order of orders) {
    if (!resellerOrderMap[order.Pessoa]) {
      resellerOrderMap[order.Pessoa] = { name: order.NomePessoa, tier: order.tierId, orders: [] };
    }
    resellerOrderMap[order.Pessoa].orders.push(order);
  }

  const activeResellers = Object.values(resellerOrderMap).filter(r =>
    r.orders.some(o => isRevenueEligible(o))
  ).length;

  // Repurchase frequency — avg orders per reseller (eligible)
  const eligibleByReseller = Object.values(resellerOrderMap).map(r =>
    r.orders.filter(o => isRevenueEligible(o)).length
  ).filter(c => c > 0);
  const repurchaseFrequency = eligibleByReseller.length > 0
    ? eligibleByReseller.reduce((s, c) => s + c, 0) / eligibleByReseller.length
    : 0;

  // Tier distribution by reseller count
  const tierDistribution: Record<string, number> = {};
  const resellersByTier: Record<string, number> = {};
  for (const [, data] of Object.entries(resellerOrderMap)) {
    const tier = data.tier || 'cf';
    resellersByTier[tier] = (resellersByTier[tier] ?? 0) + 1;
    tierDistribution[tier] = (tierDistribution[tier] ?? 0) + 1;
  }

  // Top resellers by revenue
  const resellerRevenue: Record<string, { id: string; name: string; tier: string; value: number; orders: number }> = {};
  for (const order of orders) {
    if (!isRevenueEligible(order)) continue;
    if (!resellerRevenue[order.Pessoa]) {
      resellerRevenue[order.Pessoa] = {
        id: order.Pessoa,
        name: order.NomePessoa,
        tier: order.tierId,
        value: 0,
        orders: 0,
      };
    }
    resellerRevenue[order.Pessoa].value += order.ValorPraticado;
    resellerRevenue[order.Pessoa].orders++;
  }
  const topResellers = Object.values(resellerRevenue)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    activeResellers,
    cancellationRate,
    repurchaseFrequency,
    tierDistribution,
    topResellers,
    resellersByTier,
  };
}
