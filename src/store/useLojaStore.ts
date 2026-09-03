import { create } from 'zustand';
import { LojaDataset } from '../types/loja';

export interface SelectedConsultor {
  nome: string;
  view: 'consultor' | 'operador';
}

interface LojaStore {
  dataset: LojaDataset | null;
  setDataset: (dataset: LojaDataset) => void;
  clearDataset: () => void;
  selectedConsultor: SelectedConsultor | null;
  setSelectedConsultor: (c: SelectedConsultor | null) => void;
}

export const useLojaStore = create<LojaStore>((set) => ({
  dataset: null,
  setDataset: (dataset) => set({ dataset }),
  clearDataset: () => set({ dataset: null }),
  selectedConsultor: null,
  setSelectedConsultor: (selectedConsultor) => set({ selectedConsultor }),
}));
