import { create } from 'zustand';
import { Order } from '../types/order';

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

function parseBRDate(s: string): Date | null {
  if (!s) return null;
  // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // Excel serial number
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    // Excel epoch: Jan 1 1900 = 1, but has a leap year bug so subtract 1 extra
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  }
  return null;
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
