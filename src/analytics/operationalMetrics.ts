import { Order } from '../types/order';
import { OperationalMetrics } from '../types/analytics';
import { parseBRDate, diffInMinutes } from '../utils/dateUtils';

export function calcOperationalMetrics(orders: Order[]): OperationalMetrics {
  const slaTimes: number[] = [];
  const slaByUser: Record<string, { total: number; count: number }> = {};
  const ordersByStatus: Record<string, number> = {};
  const ordersByDetail: Record<string, number> = {};
  let delayedOrders = 0;

  for (const order of orders) {
    const status = order.SituacaoComercial || 'Não informado';
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;

    const detail = order.DetalheSituacaoComercial || 'Não informado';
    ordersByDetail[detail] = (ordersByDetail[detail] ?? 0) + 1;

    const aprovDate = parseBRDate(order.DataAprovacao);
    const faturDate = parseBRDate(order.DataAutorizacaoFaturamento);
    const sla = diffInMinutes(aprovDate, faturDate);

    if (sla !== null && sla >= 0) {
      slaTimes.push(sla);

      // SLA > 24h = delayed
      if (sla > 1440) delayedOrders++;

      const user = order.UsuarioFinalizacao || order.UsuarioCriacao || 'Desconhecido';
      if (!slaByUser[user]) slaByUser[user] = { total: 0, count: 0 };
      slaByUser[user].total += sla;
      slaByUser[user].count++;
    }
  }

  const avgSLAMinutes = slaTimes.length > 0
    ? slaTimes.reduce((s, v) => s + v, 0) / slaTimes.length
    : 0;
  const minSLAMinutes = slaTimes.length > 0 ? Math.min(...slaTimes) : 0;
  const maxSLAMinutes = slaTimes.length > 0 ? Math.max(...slaTimes) : 0;

  // Build SLA distribution buckets
  const buckets = [
    { label: '< 1h', min: 0, max: 60 },
    { label: '1-4h', min: 60, max: 240 },
    { label: '4-12h', min: 240, max: 720 },
    { label: '12-24h', min: 720, max: 1440 },
    { label: '> 24h', min: 1440, max: Infinity },
  ];
  const slaDistribution = buckets.map(b => ({
    bucket: b.label,
    count: slaTimes.filter(t => t >= b.min && t < b.max).length,
  }));

  // Finalize slaByUser
  const slaByUserResult: Record<string, { avg: number; count: number }> = {};
  for (const [user, data] of Object.entries(slaByUser)) {
    slaByUserResult[user] = {
      avg: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    };
  }

  return {
    avgSLAMinutes,
    minSLAMinutes,
    maxSLAMinutes,
    delayedOrders,
    ordersByStatus,
    ordersByDetail,
    slaByUser: slaByUserResult,
    slaDistribution,
  };
}
