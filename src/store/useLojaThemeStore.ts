import { create } from 'zustand';

export type LojaTheme = 'light' | 'dark';

const STORAGE_KEY = 'datalens-loja-theme';

function readInitialTheme(): LojaTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage indisponível (modo privado etc.) — cai pra preferência do sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface LojaThemeStore {
  theme: LojaTheme;
  setTheme: (theme: LojaTheme) => void;
}

export const useLojaThemeStore = create<LojaThemeStore>((set) => ({
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
