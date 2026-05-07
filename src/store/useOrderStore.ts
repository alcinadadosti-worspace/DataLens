import { create } from 'zustand';
import { Order } from '../types/order';

interface OrderStore {
  orders: Order[];
  fileName: string | null;
  rowCount: number;
  importedAt: Date | null;
  setOrders: (orders: Order[], fileName: string) => void;
  clearOrders: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  fileName: null,
  rowCount: 0,
  importedAt: null,
  setOrders: (orders, fileName) =>
    set({ orders, fileName, rowCount: orders.length, importedAt: new Date() }),
  clearOrders: () =>
    set({ orders: [], fileName: null, rowCount: 0, importedAt: null }),
}));
