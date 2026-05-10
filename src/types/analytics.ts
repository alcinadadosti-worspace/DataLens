export interface FinancialMetrics {
  grossRevenue: number;
  netRevenue: number;
  avgTicket: number;
  totalOrders: number;
  finalizados: number;
  cancelados: number;
  activeResellers: number;
  revenueByTier: Record<string, number>;
  ordersByTier: Record<string, number>;
  revenueByCycle: Record<string, number>;
  revenueBySupervisor: Record<string, number>;
  revenueByReseller: Record<string, { name: string; value: number; tier: string }>;
  revenueByModeloComercial: Record<string, number>;
  revenueByMeioCaptacao: Record<string, number>;
  topResellersByTier: Record<string, { name: string; value: number }[]>;
  revenueByDayAndTier: Record<string, Record<string, number>>;
  topResellersByDay: Record<string, { name: string; tierId: string; value: number }[]>;
}

export interface OperationalMetrics {
  avgSLAMinutes: number;
  minSLAMinutes: number;
  maxSLAMinutes: number;
  delayedOrders: number;
  ordersByStatus: Record<string, number>;
  ordersByDetail: Record<string, number>;
  slaByUser: Record<string, { avg: number; count: number }>;
  slaDistribution: { bucket: string; count: number }[];
}

export interface CommercialMetrics {
  activeResellers: number;
  cancellationRate: number;
  repurchaseFrequency: number;
  tierDistribution: Record<string, number>;
  topResellers: { id: string; name: string; tier: string; value: number; orders: number }[];
  resellersByTier: Record<string, number>;
}

export interface TierMetrics {
  tierId: string;
  name: string;
  orderCount: number;
  resellerCount: number;
  totalRevenue: number;
  avgTicket: number;
  growth: number;
}

export interface SupervisorMetrics {
  name: string;
  structure: string;
  codEstrutura: string;
  codEstruturaPai: string;
  orderCount: number;
  totalRevenue: number;
  avgSLAMinutes: number;
  resellerCount: number;
}

export interface InsightItem {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  icon: string;
  title: string;
  description: string;
}

export interface FilterState {
  cycle: string | null;
  supervisor: string | null;
  structure: string | null;
  city: string | null;
  state: string | null;
  modeloComercial: string | null;
  meioCaptacao: string | null;
  situacaoComercial: string | null;
  tier: string | null;
  searchQuery: string;
  dateFrom: string | null;
  dateTo: string | null;
}
