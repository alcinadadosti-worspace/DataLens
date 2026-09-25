import { parseSpreadsheet } from './spreadsheetParser';
import { parseRankingVendasCSV } from './vdRankingParser';
import { parseVDCorporateFiles } from './vdCorporateParser';
import { Order, ParseResult } from '../types/order';
import { RankingVendaRow } from '../types/vdRanking';
import { VDCorporateDataset, VDCorporateParseResult } from '../types/vdCorporate';

export interface VDImportResult {
  orders: Order[] | null;
  pedidosFileName: string | null;
  pedidosResult: ParseResult | null;
  rankingVendas: RankingVendaRow[] | null;
  rankingFileName: string | null;
  rankingErrors: string[];
  rankingRepairedCount: number;
  corporate: VDCorporateParseResult | null;
  errors: string[];
}

function normalizeName(fileName: string): string {
  return fileName.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Orquestra a importação do lote completo do Modo VD (Ciclo 13): identifica o arquivo de pedidos
 * (ConsultaPedidos) e o de ranking de vendas por nome, processa cada um com seu parser dedicado, e
 * passa o resto dos arquivos (Família B + C) para `parseVDCorporateFiles`.
 */
export async function parseVDFiles(files: File[]): Promise<VDImportResult> {
  const errors: string[] = [];

  const pedidosFile = files.find(f => normalizeName(f.name).includes('CONSULTAPEDIDOS'));
  const rankingFile = files.find(f => normalizeName(f.name).includes('CONSULTARANKINGVENDAS'));
  const restFiles = files.filter(f => f !== pedidosFile && f !== rankingFile);

  let pedidosResult: ParseResult | null = null;
  if (pedidosFile) {
    pedidosResult = await parseSpreadsheet(pedidosFile);
    if (pedidosResult.errors.length > 0 && pedidosResult.orders.length === 0) {
      errors.push(...pedidosResult.errors.map(e => `${pedidosFile.name}: ${e}`));
    }
  }

  let rankingVendas: RankingVendaRow[] | null = null;
  let rankingErrors: string[] = [];
  let rankingRepairedCount = 0;
  if (rankingFile) {
    const r = await parseRankingVendasCSV(rankingFile);
    rankingVendas = r.rows;
    rankingErrors = r.errors;
    rankingRepairedCount = r.repairedCount;
  }

  let corporate: VDCorporateParseResult | null = null;
  if (restFiles.length > 0 || rankingVendas) {
    corporate = await parseVDCorporateFiles(restFiles);
    errors.push(...corporate.errors);
  }
  if (corporate && rankingVendas && rankingFile) {
    corporate.dataset.rankingVendas = rankingVendas;
    corporate.dataset.fileNames = { ...corporate.dataset.fileNames, rankingVendas: rankingFile.name };
    corporate.detected.rankingVendas = { fileName: rankingFile.name, rowCount: rankingVendas.length };
  }

  return {
    orders: pedidosResult?.orders ?? null,
    pedidosFileName: pedidosFile?.name ?? null,
    pedidosResult,
    rankingVendas,
    rankingFileName: rankingFile?.name ?? null,
    rankingErrors,
    rankingRepairedCount,
    corporate,
    errors,
  };
}

export type { VDCorporateDataset };
