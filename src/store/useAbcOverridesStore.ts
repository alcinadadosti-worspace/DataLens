import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Classificação comercial/não-comercial por SKU, mantida manualmente pelo usuário (toggle na
 * tela de Curva ABC, ou importação em lote de uma lista de referência). Sobrepõe a heurística de
 * texto/preço em `isItemNaoComercial` sempre que o código do produto estiver aqui.
 * Persistido em localStorage — sobrevive a reimportações de arquivo e a fechar o navegador.
 */
interface AbcOverridesStore {
  overrides: Record<string, boolean>; // codigo -> isComercial
  setOverride: (codigo: string, isComercial: boolean) => void;
  clearOverride: (codigo: string) => void;
  importOverrides: (entries: Record<string, boolean>) => void;
  clearAll: () => void;
}

export const useAbcOverridesStore = create<AbcOverridesStore>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (codigo, isComercial) =>
        set(s => ({ overrides: { ...s.overrides, [codigo]: isComercial } })),
      clearOverride: (codigo) =>
        set(s => {
          const next = { ...s.overrides };
          delete next[codigo];
          return { overrides: next };
        }),
      importOverrides: (entries) =>
        set(s => ({ overrides: { ...s.overrides, ...entries } })),
      clearAll: () => set({ overrides: {} }),
    }),
    { name: 'datalens.loja.abcOverrides' }
  )
);
