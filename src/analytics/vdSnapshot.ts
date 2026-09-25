import { Order } from '../types/order';
import { VDCorporateDataset } from '../types/vdCorporate';
import { isRevenueEligible } from './financialMetrics';

export interface VDCycleSnapshot {
  ciclo: string;
  importedAt: string; // ISO
  totalOrders: number;
  grossRevenue: number;
  fvcCount: number;
  baseAtiva: number | null;
  rupturaTotalPct: number | null;
  sellInAtingimentoPct: number | null;
}

/** Valor mais frequente de `CicloMarketing` no lote — usado como "o ciclo desse snapshot". */
function dominantCiclo(orders: Order[]): string | null {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    if (!o.CicloMarketing) continue;
    counts[o.CicloMarketing] = (counts[o.CicloMarketing] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

/**
 * Monta um snapshot leve do import atual, pra alimentar `useVDHistoryStore` e permitir comparação
 * entre ciclos ao longo do tempo (o lote de hoje só tem 1 ciclo — esse snapshot é o que dá início
 * ao histórico, que cresce a cada reimportação de um ciclo novo). `null` se não houver pedidos.
 */
export function buildVDSnapshot(orders: Order[], corporate: VDCorporateDataset | null): VDCycleSnapshot | null {
  if (orders.length === 0) return null;
  const ciclo = dominantCiclo(orders);
  if (!ciclo) return null;

  const grossRevenue = orders.filter(isRevenueEligible).reduce((s, o) => s + o.ValorPraticado, 0);
  const fvcCount = orders.filter(o => o.Estrutura.trimStart().toUpperCase().startsWith('FVC')).length;

  const baseAtiva = corporate?.evolucaoBase?.[0]?.baseAtiva
    ?? corporate?.monitoramentoBase?.porPdv.find(r => r.chave.trim().toUpperCase() === 'TOTAL')?.baseAtiva
    ?? null;

  const rupturaTotalPct = corporate?.rupturaDetalhada?.rupturaTotalPct
    ?? corporate?.rupturaCausaFranqueado?.rupturaCausaFranqueadoPct
    ?? null;

  const sellInMeta = corporate?.sellInMeta?.[0];
  const sellInAtingimentoPct = sellInMeta && sellInMeta.sugestaoComercial > 0
    ? (sellInMeta.pedidoRealizado / sellInMeta.sugestaoComercial) * 100
    : null;

  return {
    ciclo,
    importedAt: new Date().toISOString(),
    totalOrders: orders.length,
    grossRevenue,
    fvcCount,
    baseAtiva,
    rupturaTotalPct,
    sellInAtingimentoPct,
  };
}
