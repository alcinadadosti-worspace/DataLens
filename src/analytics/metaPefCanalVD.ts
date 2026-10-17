import { VDCorporateDataset } from '../types/vdCorporate';

/** Meta PEF do canal VD no ciclo, com a quebra Venda Direta x Omni Envio ER. */
export interface MetaPefCanalVD {
  vd: number;
  omni: number;
  total: number;
  /** 'arquivo' = META PEF da linha TOTAL de ReceitaCanalVD_Performance_por_PDV; 'manual' = tabela abaixo. */
  origem: 'arquivo' | 'manual';
}

/**
 * Metas informadas à mão para ciclos em que a Extranet exportou META PEF = 0 (meta não lançada a tempo).
 * Casa pelo CP e pelo período do "CICLO ATUAL" da aba FILTROS de ReceitaCanalVD_Performance_por_PDV.
 * Só existe o total do canal — não há meta por PDV nem por UN.
 */
const METAS_MANUAIS: { cp: string; cicloAtual: string; vd: number; omni: number }[] = [
  // Ciclo 14 - 2026, informada pelo time em 17/10/2026.
  { cp: '10258', cicloAtual: '21/09/2026 - 12/10/2026', vd: 4306411.00, omni: 7648.88 },
];

export function metaPefCanalVD(dataset: VDCorporateDataset | null | undefined): MetaPefCanalVD | null {
  const totalRow = dataset?.receitaCanalVDPdv?.find(r => r.un.trim().toUpperCase() === 'TOTAL');
  if (!totalRow) return null;
  if (totalRow.total.metaPef > 0) {
    return { vd: totalRow.vd.metaPef, omni: totalRow.omni.metaPef, total: totalRow.total.metaPef, origem: 'arquivo' };
  }
  const ctx = dataset?.reportContexts.receitaCanalVDPdv;
  const manual = METAS_MANUAIS.find(m => m.cp === ctx?.cp?.trim() && m.cicloAtual === ctx?.cicloAtual?.trim());
  return manual ? { vd: manual.vd, omni: manual.omni, total: manual.vd + manual.omni, origem: 'manual' } : null;
}
