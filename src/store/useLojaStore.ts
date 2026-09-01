import { create } from 'zustand';
import { LojaDataset } from '../types/loja';

interface LojaStore {
  dataset: LojaDataset | null;
  setDataset: (dataset: LojaDataset) => void;
  clearDataset: () => void;
}

export const useLojaStore = create<LojaStore>((set) => ({
  dataset: null,
  setDataset: (dataset) => set({ dataset }),
  clearDataset: () => set({ dataset: null }),
}));
