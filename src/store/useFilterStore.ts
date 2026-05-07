import { create } from 'zustand';
import { FilterState } from '../types/analytics';

interface FilterStore extends FilterState {
  setFilter: (key: keyof FilterState, value: string | null) => void;
  setSearch: (q: string) => void;
  clearFilters: () => void;
}

const defaultState: FilterState = {
  cycle: null,
  supervisor: null,
  structure: null,
  city: null,
  state: null,
  modeloComercial: null,
  meioCaptacao: null,
  situacaoComercial: null,
  tier: null,
  searchQuery: '',
  dateFrom: null,
  dateTo: null,
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...defaultState,
  setFilter: (key, value) => set({ [key]: value }),
  setSearch: (q) => set({ searchQuery: q }),
  clearFilters: () => set(defaultState),
}));
