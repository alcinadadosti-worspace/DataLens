import { create } from 'zustand';
import { Order } from '../types/order';
import { parseBRDate } from '../utils/dateUtils';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface OrderStore {
  orders: Order[];
  fileName: string | null;
  rowCount: number;
  importedAt: Date | null;
  dateRange: DateRange;
  setOrders: (orders: Order[], fileName: string) => void;
  clearOrders: () => void;
}

function computeDateRange(orders: Order[]): DateRange {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const o of orders) {
    const d = parseBRDate(o.DataCaptacao);
    if (!d) continue;
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
  }
  return { from, to };
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  fileName: null,
  rowCount: 0,
  importedAt: null,
  dateRange: { from: null, to: null },
  setOrders: (orders, fileName) =>
    set({ orders, fileName, rowCount: orders.length, importedAt: new Date(), dateRange: computeDateRange(orders) }),
  clearOrders: () =>
    set({ orders: [], fileName: null, rowCount: 0, importedAt: null, dateRange: { from: null, to: null } }),
}));
