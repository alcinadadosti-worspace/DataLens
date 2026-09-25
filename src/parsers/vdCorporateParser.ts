import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  VDCorporateDataset, VDCorporateParseResult, VDCorporateFile, VD_CORPORATE_FILE_LABELS,
} from '../types/vdCorporate';
import { VDSellInMetaRow, VDSellInDetalheSkuRow } from '../types/vdSellIn';
import {
  readReportContext, parseReceitaCanalVDPdvXlsx, parseReceitaCanalVDUnXlsx, parseReceitaCanalVDPeriodoXlsx,
  parseReceitaPeriodoXlsx, parseReceitaCanalUnXlsx, parseReceitaCategoriaXlsx,
  parseRupturaCausaFranqueadoXlsx, parseRupturaDetalhadaXlsx, parseRupturaPorItemXlsx,
  parseEvolucaoBaseXlsx, parseMonitoramentoBaseXlsx, parsePenetracaoBaseXlsx,
  parsePenetracaoAtivosDetalhadaXlsx, parseAtivasPorTierXlsx, parseSegmentacaoBaseXlsx,
  parseDetalhamentoCategoriasUnXlsx,
} from './vdXlsxParser';
import { toNum, toPctOrNull } from './vdNumberUtils';

type XlsxKind = Exclude<VDCorporateFile, 'sellInMeta' | 'sellInDetalheSku' | 'rankingVendas'>;

// Ordem importa: hints mais específicos primeiro, para não colidir com substrings de hints mais genéricos
// (ex. "Receita_por_Cat_Sub_Mar" não pode casar com o hint de "Receita_por_Canal_UN").
const XLSX_FILENAME_HINTS: [XlsxKind, string][] = [
  ['receitaCanalVDPdv', 'RECEITACANALVD_PERFORMANCE_POR_PDV'],
  ['receitaCanalVDPeriodo', 'RECEITACANALVD_POR_PERIODO'],
  ['receitaCanalVDUn', 'RECEITACANALVD_POR_UN'],
  ['receitaCategoria', 'RECEITA_POR_CAT'],
  ['receitaPeriodo', 'RECEITA_POR_PERIODO'],
  ['receitaCanalUn', 'RECEITA_POR_CANAL_UN'],
  ['rupturaPorItem', 'RUPTURAVD_DETALHAMENTO'],
  ['rupturaCausaFranqueado', 'RUPTURAVD_RUPTURA_CAUSA_FRANQUEADO'],
  ['rupturaDetalhada', 'RUPTURAVD_RUPTURA_DETALHADA'],
  ['ativasPorTier', 'VENDADIRETA_ATIVAS_POR_TIER'],
  ['detalhamentoCategoriasUn', 'VENDADIRETA_DETALHAMENTO_DE_CATEGORIAS'],
  ['evolucaoBase', 'VENDADIRETA_EVOLUCAO_DA_BASE'],
  ['monitoramentoBase', 'VENDADIRETA_MONITORAMENTO_BASE'],
  ['penetracaoAtivosDetalhada', 'VENDADIRETA_PENETRACAO_DE_ATIVOS'],
  ['penetracaoBase', 'VENDADIRETA_PENETRACAO_BASE'],
  ['segmentacaoBase', 'VENDADIRETA_SEGMENTACAO_DA_BASE'],
];

const CSV_FILENAME_HINTS: ['sellInDetalheSku' | 'sellInMeta', string][] = [
  // "Detalhamento_por_Sku" precisa vir antes de "Meta_Sell_In": o nome de arquivo de sell-in por
  // SKU também contém "META_SELL_IN" (ex. "..._Detalhamento_por_Sku_meta_Sell_In_por_Ciclo_...").
  ['sellInDetalheSku', 'GESTAOPEDIDOS_DETALHAMENTO_POR_SKU'],
  ['sellInMeta', 'GESTAOPEDIDOS_META_SELL_IN'],
];

function normalizeName(fileName: string): string {
  return fileName.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function detectXlsxKind(fileName: string): XlsxKind | null {
  const norm = normalizeName(fileName);
  for (const [kind, hint] of XLSX_FILENAME_HINTS) {
    if (norm.includes(hint.replace(/_/g, ''))) return kind;
  }
  return null;
}

function detectCsvKind(fileName: string): 'sellInDetalheSku' | 'sellInMeta' | null {
  const norm = normalizeName(fileName);
  for (const [kind, hint] of CSV_FILENAME_HINTS) {
    if (norm.includes(hint.replace(/_/g, ''))) return kind;
  }
  return null;
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array', cellDates: false });
}

async function readCsvRows(file: File): Promise<string[][]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true });
  return parsed.data;
}

function findCol(header: string[], ...names: string[]): number {
  const norm = header.map(h => h.toUpperCase().trim());
  for (const name of names) {
    const idx = norm.indexOf(name.toUpperCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/** "88295 - ZAAD EDP INFINITY 95ml" → { codigo: "88295", nome: "ZAAD EDP INFINITY 95ml" } */
function splitCodeName(raw: string): { codigo: string | null; nome: string } {
  const m = raw.match(/^(\S+)\s*-\s*(.+)$/);
  return m ? { codigo: m[1], nome: m[2].trim() } : { codigo: null, nome: raw };
}

function rowsToSellInMeta(rows: string[][]): VDSellInMetaRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findCol(header, 'CICLO');
  const iSugestao = findCol(header, 'SUGESTÃO COMERCIAL', 'SUGESTAO COMERCIAL');
  const iRealizado = findCol(header, 'PEDIDO REALIZADO');
  return rows.slice(1)
    .filter(r => (r[iCiclo] ?? '').trim() !== '')
    .map(r => ({
      ciclo: (r[iCiclo] ?? '').trim(),
      sugestaoComercial: toNum(r[iSugestao]),
      pedidoRealizado: toNum(r[iRealizado]),
    }));
}

function rowsToSellInDetalheSku(rows: string[][]): VDSellInDetalheSkuRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findCol(header, 'CICLO');
  const iPdv = findCol(header, 'PDV');
  const iSku = findCol(header, 'SKU');
  const iMarca = findCol(header, 'MARCA');
  const iDataLimite = findCol(header, 'DATA LIMITE DE CAPTAÇÃO', 'DATA LIMITE DE CAPTACAO');
  const iSugestao = findCol(header, 'SUGESTÃO COMERCIAL', 'SUGESTAO COMERCIAL');
  const iRealizado = findCol(header, 'PEDIDO REALIZADO');
  const iAtingimento = findCol(header, '% ATINGIMENTO DA META', '% ATINGIMNETO DA META');
  return rows.slice(1)
    .filter(r => (r[iPdv] ?? '').trim() !== '')
    .map(r => {
      const skuRaw = (r[iSku] ?? '').trim();
      const split = splitCodeName(skuRaw);
      return {
        ciclo: iCiclo >= 0 ? (r[iCiclo] ?? '').trim() : '',
        pdvCodigo: (r[iPdv] ?? '').trim(),
        skuCodigo: split.codigo ?? skuRaw,
        skuDescricao: split.nome,
        marca: iMarca >= 0 ? (r[iMarca] ?? '').trim() : '',
        dataLimiteCaptacao: iDataLimite >= 0 ? (r[iDataLimite] ?? '').trim() : '',
        sugestaoComercial: toNum(r[iSugestao]),
        pedidoRealizado: toNum(r[iRealizado]),
        atingimentoMetaPct: toPctOrNull(r[iAtingimento]) ?? 0,
      };
    });
}

export async function parseVDCorporateFiles(files: File[]): Promise<VDCorporateParseResult> {
  const errors: string[] = [];
  const detected: VDCorporateParseResult['detected'] = {};
  const fileNames: VDCorporateDataset['fileNames'] = {};
  const reportContexts: VDCorporateDataset['reportContexts'] = {};
  const dataset: Partial<VDCorporateDataset> = {};

  for (const file of files) {
    const isCsv = /\.csv$/i.test(file.name);
    try {
      if (isCsv) {
        const kind = detectCsvKind(file.name);
        if (!kind) continue;
        const rows = await readCsvRows(file);
        if (kind === 'sellInMeta') {
          dataset.sellInMeta = rowsToSellInMeta(rows);
          detected.sellInMeta = { fileName: file.name, rowCount: dataset.sellInMeta.length };
        } else {
          dataset.sellInDetalheSku = rowsToSellInDetalheSku(rows);
          detected.sellInDetalheSku = { fileName: file.name, rowCount: dataset.sellInDetalheSku.length };
        }
        fileNames[kind] = file.name;
        continue;
      }

      const kind = detectXlsxKind(file.name);
      if (!kind) continue;
      const workbook = await readWorkbook(file);
      reportContexts[kind] = readReportContext(workbook);
      fileNames[kind] = file.name;

      switch (kind) {
        case 'receitaCanalVDPdv': {
          dataset.receitaCanalVDPdv = parseReceitaCanalVDPdvXlsx(workbook);
          detected.receitaCanalVDPdv = { fileName: file.name, rowCount: dataset.receitaCanalVDPdv.length };
          break;
        }
        case 'receitaCanalVDUn': {
          const un = parseReceitaCanalVDUnXlsx(workbook);
          if (un) {
            dataset.receitaCanalVDUn = un;
            detected.receitaCanalVDUn = { fileName: file.name, rowCount: un.porUn.length };
          }
          break;
        }
        case 'receitaCanalVDPeriodo': {
          dataset.receitaCanalVDPeriodo = parseReceitaCanalVDPeriodoXlsx(workbook);
          detected.receitaCanalVDPeriodo = { fileName: file.name, rowCount: dataset.receitaCanalVDPeriodo.length };
          break;
        }
        case 'receitaPeriodo': {
          dataset.receitaPeriodo = parseReceitaPeriodoXlsx(workbook);
          detected.receitaPeriodo = { fileName: file.name, rowCount: dataset.receitaPeriodo.dia.length };
          break;
        }
        case 'receitaCanalUn': {
          dataset.receitaCanalUn = parseReceitaCanalUnXlsx(workbook);
          detected.receitaCanalUn = { fileName: file.name, rowCount: dataset.receitaCanalUn.length };
          break;
        }
        case 'receitaCategoria': {
          dataset.receitaCategoria = parseReceitaCategoriaXlsx(workbook);
          detected.receitaCategoria = { fileName: file.name, rowCount: dataset.receitaCategoria.categoria.length };
          break;
        }
        case 'rupturaCausaFranqueado': {
          const r = parseRupturaCausaFranqueadoXlsx(workbook);
          if (r) {
            dataset.rupturaCausaFranqueado = r;
            detected.rupturaCausaFranqueado = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'rupturaDetalhada': {
          const r = parseRupturaDetalhadaXlsx(workbook);
          if (r) {
            dataset.rupturaDetalhada = r;
            detected.rupturaDetalhada = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'rupturaPorItem': {
          dataset.rupturaPorItem = parseRupturaPorItemXlsx(workbook);
          detected.rupturaPorItem = { fileName: file.name, rowCount: dataset.rupturaPorItem.length };
          break;
        }
        case 'evolucaoBase': {
          dataset.evolucaoBase = parseEvolucaoBaseXlsx(workbook);
          detected.evolucaoBase = { fileName: file.name, rowCount: dataset.evolucaoBase.length };
          break;
        }
        case 'monitoramentoBase': {
          dataset.monitoramentoBase = parseMonitoramentoBaseXlsx(workbook);
          detected.monitoramentoBase = { fileName: file.name, rowCount: dataset.monitoramentoBase.porPdv.length };
          break;
        }
        case 'penetracaoBase': {
          dataset.penetracaoBase = parsePenetracaoBaseXlsx(workbook);
          detected.penetracaoBase = { fileName: file.name, rowCount: dataset.penetracaoBase.length };
          break;
        }
        case 'penetracaoAtivosDetalhada': {
          const r = parsePenetracaoAtivosDetalhadaXlsx(workbook);
          if (r) {
            dataset.penetracaoAtivosDetalhada = r;
            detected.penetracaoAtivosDetalhada = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'ativasPorTier': {
          dataset.ativasPorTier = parseAtivasPorTierXlsx(workbook);
          detected.ativasPorTier = { fileName: file.name, rowCount: dataset.ativasPorTier.length };
          break;
        }
        case 'segmentacaoBase': {
          const r = parseSegmentacaoBaseXlsx(workbook);
          if (r) {
            dataset.segmentacaoBase = r;
            detected.segmentacaoBase = { fileName: file.name, rowCount: r.linhas.length };
          }
          break;
        }
        case 'detalhamentoCategoriasUn': {
          dataset.detalhamentoCategoriasUn = parseDetalhamentoCategoriasUnXlsx(workbook);
          detected.detalhamentoCategoriasUn = { fileName: file.name, rowCount: dataset.detalhamentoCategoriasUn.un.length };
          break;
        }
      }
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    dataset: { importedAt: new Date(), fileNames, reportContexts, ...dataset },
    detected,
    errors,
  };
}

export { VD_CORPORATE_FILE_LABELS };
