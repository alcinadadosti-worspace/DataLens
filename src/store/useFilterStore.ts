import { create } from 'zustand';
import { FilterState } from '../types/analytics';

type MultiKey = Exclude<keyof FilterState, 'searchQuery' | 'dateFrom' | 'dateTo'>;

interface FilterStore extends FilterState {
  setFilter: (key: MultiKey, value: string | string[] | null) => void;
  toggleFilterValue: (key: MultiKey, value: string) => void;
  setSearch: (q: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
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

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...defaultState,
  setFilter: (key, value) => {
    if (value === null) {
      set({ [key]: null });
    } else if (Array.isArray(value)) {
      set({ [key]: value.length > 0 ? value : null });
    } else {
      set({ [key]: [value] });
    }
  },
  toggleFilterValue: (key, value) => {
    const current = get()[key] as string[] | null;
    if (!current) {
      set({ [key]: [value] });
    } else if (current.includes(value)) {
      const next = current.filter(v => v !== value);
      set({ [key]: next.length > 0 ? next : null });
    } else {
      set({ [key]: [...current, value] });
    }
  },
  setSearch: (q) => set({ searchQuery: q }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  clearFilters: () => set(defaultState),
}));
