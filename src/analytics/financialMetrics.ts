import { Order } from '../types/order';
import { FinancialMetrics } from '../types/analytics';

export function isRevenueEligible(order: Order): boolean {
  return (
    order.SituacaoComercial !== 'Cancelado' &&
    order.DetalheSituacaoComercial !== 'Cancelado Pelo Usuário'
  );
}

export function calcFinancialMetrics(orders: Order[]): FinancialMetrics {
  const eligible = orders.filter(isRevenueEligible);

  const grossRevenue = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
  const netRevenue = eligible.reduce((s, o) => s + o.ValorLiquido, 0);
  const totalOrders = orders.length;
  const avgTicket = eligible.length > 0 ? grossRevenue / eligible.length : 0;

  const revenueByTier: Record<string, number> = {};
  const ordersByTier: Record<string, number> = {};
  const revenueByCycle: Record<string, number> = {};
  const revenueBySupervisor: Record<string, number> = {};
  const revenueByReseller: Record<string, { name: string; value: number; tier: string }> = {};
  const revenueByModeloComercial: Record<string, number> = {};
  const revenueByMeioCaptacao: Record<string, number> = {};

  for (const order of orders) {
    const tierId = order.tierId || 'cf';
    ordersByTier[tierId] = (ordersByTier[tierId] ?? 0) + 1;

    if (!isRevenueEligible(order)) continue;

    const v = order.ValorPraticado;

    revenueByTier[tierId] = (revenueByTier[tierId] ?? 0) + v;

    const cycle = order.CicloMarketing || 'Sem ciclo';
    revenueByCycle[cycle] = (revenueByCycle[cycle] ?? 0) + v;

    const supervisor = order.ResponsavelEstrutura || 'Sem supervisor';
    revenueBySupervisor[supervisor] = (revenueBySupervisor[supervisor] ?? 0) + v;

    const resellerId = order.Pessoa;
    if (resellerId) {
      if (!revenueByReseller[resellerId]) {
        revenueByReseller[resellerId] = { name: order.NomePessoa, value: 0, tier: tierId };
      }
      revenueByReseller[resellerId].value += v;
    }

    const modelo = order.ModeloComercial || 'Não informado';
    revenueByModeloComercial[modelo] = (revenueByModeloComercial[modelo] ?? 0) + v;

    const meio = order.MeioCaptacao || 'Não informado';
    revenueByMeioCaptacao[meio] = (revenueByMeioCaptacao[meio] ?? 0) + v;
  }

  return {
    grossRevenue,
    netRevenue,
    avgTicket,
    totalOrders,
    revenueByTier,
    ordersByTier,
    revenueByCycle,
    revenueBySupervisor,
    revenueByReseller,
    revenueByModeloComercial,
    revenueByMeioCaptacao,
  };
}
