import { create } from 'zustand';

export type VDTheme = 'light' | 'dark';

const STORAGE_KEY = 'datalens-vd-theme';

function readInitialTheme(): VDTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage indisponível (modo privado etc.) — cai pra preferência do sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface VDThemeStore {
  theme: VDTheme;
  setTheme: (theme: VDTheme) => void;
}

export const useVDThemeStore = create<VDThemeStore>((set) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // idem — segue só em memória se não der pra persistir.
    }
    set({ theme });
  },
}));
