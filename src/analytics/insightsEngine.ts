import { FinancialMetrics, OperationalMetrics, CommercialMetrics, InsightItem } from '../types/analytics';
import { fmtBRLshort, fmtMinutes, fmtPct } from '../utils/formatters';

export function generateInsights(
  financial: FinancialMetrics,
  operational: OperationalMetrics,
  commercial: CommercialMetrics
): InsightItem[] {
  const insights: InsightItem[] = [];

  // Top supervisor by revenue
  const supervisors = Object.entries(financial.revenueBySupervisor)
    .sort((a, b) => b[1] - a[1]);
  if (supervisors.length > 0) {
    const [name, value] = supervisors[0];
    insights.push({
      id: 'top-supervisor',
      type: 'positive',
      icon: 'ph-trophy',
      title: `${name} lidera em receita`,
      description: `O supervisor ${name} gerou ${fmtBRLshort(value)} em receita neste período.`,
    });
  }

  // Top cycle by revenue
  const cycles = Object.entries(financial.revenueByCycle)
    .sort((a, b) => b[1] - a[1]);
  if (cycles.length >= 2) {
    const [topCycle, topValue] = cycles[0];
    const [, secondValue] = cycles[1];
    const pctDiff = secondValue > 0 ? ((topValue - secondValue) / secondValue) * 100 : 0;
    insights.push({
      id: 'top-cycle',
      type: 'positive',
      icon: 'ph-calendar',
      title: `Ciclo ${topCycle} é o mais rentável`,
      description: `O ciclo ${topCycle} gerou ${fmtPct(pctDiff)} a mais de receita que o segundo colocado.`,
    });
  }

  // Best commercial model
  const modelos = Object.entries(financial.revenueByModeloComercial)
    .sort((a, b) => b[1] - a[1]);
  if (modelos.length > 0) {
    const [modelo, value] = modelos[0];
    const total = modelos.reduce((s, [, v]) => s + v, 0);
    const pct = total > 0 ? (value / total) * 100 : 0;
    insights.push({
      id: 'best-modelo',
      type: 'neutral',
      icon: 'ph-storefront',
      title: `Pedidos ${modelo} dominam`,
      description: `O modelo ${modelo} representa ${pct.toFixed(1).replace('.', ',')}% da receita total.`,
    });
  }

  // Cancellation alert
  if (commercial.cancellationRate > 10) {
    insights.push({
      id: 'cancellation-rate',
      type: 'negative',
      icon: 'ph-warning',
      title: `Taxa de cancelamento elevada`,
      description: `${commercial.cancellationRate.toFixed(1).replace('.', ',')}% dos pedidos foram cancelados. Atenção requerida.`,
    });
  } else if (commercial.cancellationRate > 0) {
    insights.push({
      id: 'cancellation-rate-ok',
      type: 'positive',
      icon: 'ph-check-circle',
      title: `Baixa taxa de cancelamento`,
      description: `Apenas ${commercial.cancellationRate.toFixed(1).replace('.', ',')}% dos pedidos foram cancelados.`,
    });
  }

  // High SLA user
  const slaUsers = Object.entries(operational.slaByUser)
    .filter(([, d]) => d.count >= 3)
    .sort((a, b) => b[1].avg - a[1].avg);
  if (slaUsers.length > 0) {
    const [user, data] = slaUsers[0];
    insights.push({
      id: 'high-sla-user',
      type: 'negative',
      icon: 'ph-clock',
      title: `${user} tem maior tempo médio de aprovação`,
      description: `Média de ${fmtMinutes(data.avg)} por pedido (${data.count} pedidos).`,
    });
  }

  // Average SLA
  if (operational.avgSLAMinutes > 0) {
    const type = operational.avgSLAMinutes < 480 ? 'positive' : operational.avgSLAMinutes < 1440 ? 'neutral' : 'negative';
    insights.push({
      id: 'avg-sla',
      type,
      icon: 'ph-hourglass',
      title: `SLA médio de ${fmtMinutes(operational.avgSLAMinutes)}`,
      description: `Tempo médio entre aprovação e autorização de faturamento.`,
    });
  }

  // Top tier by revenue
  const tierRevenues = Object.entries(financial.revenueByTier)
    .sort((a, b) => b[1] - a[1]);
  if (tierRevenues.length > 0) {
    const [tierId, value] = tierRevenues[0];
    insights.push({
      id: 'top-tier-revenue',
      type: 'positive',
      icon: 'ph-medal',
      title: `Tier ${tierId} lidera em receita`,
      description: `Gerou ${fmtBRLshort(value)} no período selecionado.`,
    });
  }

  // Active resellers
  if (commercial.activeResellers > 0) {
    insights.push({
      id: 'active-resellers',
      type: 'neutral',
      icon: 'ph-users',
      title: `${commercial.activeResellers} revendedores ativos`,
      description: `Frequência média de ${commercial.repurchaseFrequency.toFixed(1).replace('.', ',')} pedidos por revendedor.`,
    });
  }

  return insights.slice(0, 8);
}
