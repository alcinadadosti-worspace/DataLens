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
  const finalizados = eligible.length;
  const cancelados = totalOrders - finalizados;
  const avgTicket = eligible.length > 0 ? grossRevenue / eligible.length : 0;
  const activeResellers = new Set(eligible.map(o => o.Pessoa).filter(Boolean)).size;

  const revenueByTier: Record<string, number> = {};
  const ordersByTier: Record<string, number> = {};
  const revenueByCycle: Record<string, number> = {};
  const revenueBySupervisor: Record<string, number> = {};
  const revenueByReseller: Record<string, { name: string; value: number; tier: string }> = {};
  const revenueByModeloComercial: Record<string, number> = {};
  const revenueByMeioCaptacao: Record<string, number> = {};
  const revenueByDayAndTier: Record<string, Record<string, number>> = {};

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

    const day = order.DiaDoCiclo || '?';
    if (!revenueByDayAndTier[day]) revenueByDayAndTier[day] = {};
    revenueByDayAndTier[day][tierId] = (revenueByDayAndTier[day][tierId] ?? 0) + v;
  }

  // top 3 resellers per day
  const resellersByDay: Record<string, Record<string, { name: string; tierId: string; value: number }>> = {};
  for (const order of eligible) {
    const day = order.DiaDoCiclo || '?';
    const resellerId = order.Pessoa;
    if (!resellerId) continue;
    if (!resellersByDay[day]) resellersByDay[day] = {};
    if (!resellersByDay[day][resellerId]) {
      resellersByDay[day][resellerId] = { name: order.NomePessoa, tierId: order.tierId || 'cf', value: 0 };
    }
    resellersByDay[day][resellerId].value += order.ValorPraticado;
  }
  const topResellersByDay: Record<string, { name: string; tierId: string; value: number }[]> = {};
  for (const [day, sellers] of Object.entries(resellersByDay)) {
    topResellersByDay[day] = Object.values(sellers).sort((a, b) => b.value - a.value).slice(0, 3);
  }

  const topResellersByTier: Record<string, { name: string; value: number }[]> = {};
  for (const data of Object.values(revenueByReseller)) {
    if (!topResellersByTier[data.tier]) topResellersByTier[data.tier] = [];
    topResellersByTier[data.tier].push({ name: data.name, value: data.value });
  }
  for (const tier of Object.keys(topResellersByTier)) {
    topResellersByTier[tier].sort((a, b) => b.value - a.value);
    topResellersByTier[tier] = topResellersByTier[tier].slice(0, 3);
  }

  return {
    grossRevenue,
    netRevenue,
    avgTicket,
    totalOrders,
    finalizados,
    cancelados,
    activeResellers,
    revenueByTier,
    ordersByTier,
    revenueByCycle,
    revenueBySupervisor,
    revenueByReseller,
    revenueByModeloComercial,
    revenueByMeioCaptacao,
    topResellersByTier,
    revenueByDayAndTier,
    topResellersByDay,
  };
}
