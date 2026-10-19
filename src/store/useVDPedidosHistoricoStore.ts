import { create } from 'zustand';
import { ResumoCiclo } from '../analytics/vdInatividade';
import type { HistoricoMessage, HistoricoRequest } from '../workers/historicoPedidos.worker';

type Status = 'vazio' | 'carregando' | 'pronto';

interface VDPedidosHistoricoStore {
  status: Status;
  feitos: number;
  total: number;
  /** Resumo dos ciclos da janela de inatividade (os 6 anteriores ao atual). */
  ciclos: ResumoCiclo[];
  /** Arquivos lidos que ficaram fora da janela — informativo, pra tela de importação. */
  foraDaJanela: string[];
  erros: string[];
  carregar: (files: File[], cicloAtual: string) => void;
  limpar: () => void;
}

const VAZIO = { status: 'vazio' as Status, feitos: 0, total: 0, ciclos: [], foraDaJanela: [], erros: [] };

let workerAtual: Worker | null = null;

/**
 * ConsultaPedidos de ciclos anteriores ("Ciclo 13.xlsx"...), lidos em segundo plano depois do import.
 * Não persiste e não entra no `useOrderStore`: as outras telas continuam olhando só o ciclo atual.
 */
export const useVDPedidosHistoricoStore = create<VDPedidosHistoricoStore>((set) => ({
  ...VAZIO,
  carregar: (files, cicloAtual) => {
    workerAtual?.terminate();
    workerAtual = null;
    if (files.length === 0) { set(VAZIO); return; }

    const worker = new Worker(new URL('../workers/historicoPedidos.worker.ts', import.meta.url), { type: 'module' });
    workerAtual = worker;
    set({ ...VAZIO, status: 'carregando' });
    worker.onmessage = (e: MessageEvent<HistoricoMessage>) => {
      // Um import novo pode ter começado enquanto este rodava — resultado velho é descartado.
      if (workerAtual !== worker) return;
      const msg = e.data;
      if (msg.tipo === 'progresso') {
        set({ feitos: msg.feitos, total: msg.total });
      } else {
        set({ status: 'pronto', ciclos: msg.ciclos, foraDaJanela: msg.foraDaJanela, erros: msg.erros });
        worker.terminate();
        workerAtual = null;
      }
    };
    worker.onerror = (e) => {
      if (workerAtual !== worker) return;
      set({ ...VAZIO, status: 'pronto', erros: [`Erro ao ler o histórico de pedidos: ${e.message}`] });
      worker.terminate();
      workerAtual = null;
    };
    worker.postMessage({ files, cicloAtual } satisfies HistoricoRequest);
  },
  limpar: () => {
    workerAtual?.terminate();
    workerAtual = null;
    set(VAZIO);
  },
}));
