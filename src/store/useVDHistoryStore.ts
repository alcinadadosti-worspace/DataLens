import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VDCycleSnapshot } from '../analytics/vdSnapshot';
import { cycleSortKey } from '../utils/dateUtils';

interface VDHistoryStore {
  snapshots: VDCycleSnapshot[];
  addSnapshot: (snap: VDCycleSnapshot) => void;
  clearHistory: () => void;
}

/**
 * Persistido em localStorage — sobrevive a fechar o navegador. Cada import bem-sucedido do Modo VD
 * grava/atualiza (por ciclo — reimportar o mesmo ciclo substitui, não duplica) um snapshot leve,
 * permitindo montar uma série ao longo de vários ciclos mesmo o app não tendo um backend histórico.
 */
export const useVDHistoryStore = create<VDHistoryStore>()(
  persist(
    (set, get) => ({
      snapshots: [],
      addSnapshot: (snap) => {
        const rest = get().snapshots.filter(s => s.ciclo !== snap.ciclo);
        const next = [...rest, snap].sort((a, b) => cycleSortKey(a.ciclo).localeCompare(cycleSortKey(b.ciclo)));
        set({ snapshots: next });
      },
      clearHistory: () => set({ snapshots: [] }),
    }),
    { name: 'datalens_vd_history' }
  )
);
