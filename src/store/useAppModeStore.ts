import { create } from 'zustand';

export type AppMode = 'vd' | 'loja' | null;

interface AppModeStore {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  resetMode: () => void;
}

export const useAppModeStore = create<AppModeStore>((set) => ({
  mode: null,
  setMode: (mode) => set({ mode }),
  resetMode: () => set({ mode: null }),
}));
