import { create } from 'zustand';
import { VDCorporateDataset } from '../types/vdCorporate';

interface VDCorporateStore {
  dataset: VDCorporateDataset | null;
  setDataset: (dataset: VDCorporateDataset) => void;
  clearDataset: () => void;
}

export const useVDCorporateStore = create<VDCorporateStore>((set) => ({
  dataset: null,
  setDataset: (dataset) => set({ dataset }),
  clearDataset: () => set({ dataset: null }),
}));
