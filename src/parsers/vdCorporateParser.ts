import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  VDCorporateDataset, VDCorporateParseResult, VDCorporateFile, VD_CORPORATE_FILE_LABELS,
} from '../types/vdCorporate';
import { VDSellInMetaRow, VDSellInDetalheSkuRow } from '../types/vdSellIn';
import { VDPedidosVisaoGeralRow, VDPedidosGiroRow, VDPedidosColocacaoRow } from '../types/vdCorporate';
import {
  readReportContext, parseReceitaCanalVDUnXlsx, parseReceitaCanalVDPeriodoXlsx,
  parseReceitaPeriodoXlsx, parseReceitaCanalUnXlsx, parseReceitaCategoriaXlsx,
  parseRupturaCausaFranqueadoXlsx, parseRupturaDetalhadaXlsx, parseRupturaPorItemXlsx,
  parseEvolucaoBaseXlsx, parseMonitoramentoBaseXlsx, parsePenetracaoBaseXlsx,
  parsePenetracaoAtivosDetalhadaXlsx, parseAtivasPorTierXlsx, parseSegmentacaoBaseXlsx,
  parseDetalhamentoCategoriasUnXlsx, parseReceitaCanalVDPdvXlsxComLayout, parseReceitaCanalVDCicloXlsx,
  parseVDReceitaCicloXlsx, parseDistribuicaoReceitaXlsx, parseReceitaCategoriaMixXlsx, parseArvorePedidosXlsx,
  parsePerformancePdvSupervisorXlsx, parseReceitaUnGmvXlsx, parseAtivasUmaCompraXlsx,
  parseFerramentasDigitaisPdvXlsx, parseOptOutBaseXlsx, parseOptOutDetalheXlsx, parseOptOutPdvXlsx,
} from './vdXlsxParser';
import { parseAderenciaXlsx, mergeAderencia } from './lojaXlsxParser';
import { toNum, toPct, toPctOrNull } from './vdNumberUtils';

type CsvKind = 'sellInMeta' | 'sellInDetalheSku' | 'pedidosVisaoGeral' | 'pedidosGiro' | 'pedidosColocacao';
type XlsxKind = Exclude<VDCorporateFile, CsvKind | 'rankingVendas'>;

// Ordem importa: hints mais específicos primeiro, para não colidir com substrings de hints mais genéricos
// (ex. "Receita_por_Cat_Sub_Mar" não pode casar com o hint de "Receita_por_Canal_UN", e
// "VendaDireta_Distribuicao_da_receita_por_categoria" contém "RECEITA_POR_CAT" — por isso vem antes).
const XLSX_FILENAME_HINTS: [XlsxKind, string][] = [
  ['receitaCanalVDPdv', 'RECEITACANALVD_PERFORMANCE_POR_PDV'],
  ['receitaCanalVDPeriodo', 'RECEITACANALVD_POR_PERIODO'],
  ['receitaCanalVDCiclo', 'RECEITACANALVD_POR_CICLO'],
  ['receitaCanalVDUn', 'RECEITACANALVD_POR_UN'],
  ['receitaCategoriaMix', 'VENDADIRETA_DISTRIBUICAO_DA_RECEITA_POR_CATEGORIA'],
  ['distribuicaoReceita', 'VENDADIRETA_DISTRIBUICAO_DA_RECEITA'],
  ['vdReceitaCiclo', 'VENDADIRETA_RECEITA_POR_CICLO'],
  ['receitaUnGmv', 'VENDADIRETA_RECEITA_POR_UN'],
  ['arvorePedidos', 'VENDADIRETA_ARVORE_DE_PEDIDOS'],
  ['performancePdvSupervisor', 'VENDADIRETA_PERFORMANCE_PDV_SUPERVISOR'],
  ['receitaCategoria', 'RECEITA_POR_CAT'],
  ['receitaPeriodo', 'RECEITA_POR_PERIODO'],
  // Ciclo 14+: "Receita_por_Periodo" virou "Receita_por_Ciclo" (aba CICLO no lugar de DIA/MÊS).
  ['receitaPeriodo', 'RECEITA_POR_CICLO'],
  ['receitaCanalUn', 'RECEITA_POR_CANAL_UN'],
  ['ativasCanaisDigitais', 'ATIVAS_UMA_COMPRA_CANAIS_DIGITAIS'],
  ['ativasEspacoRevendedor', 'ATIVAS_UMA_COMPRA_ER'],
  ['ferramentasDigitaisPdv', 'MONITORAMENTO_BASE_COM_PENETRACAO_EM_FERRAMENTAS_DIGITAIS'],
  ['optOutBase', 'BASECOMOPTOUTDECATALOGO_BASE_TOTAL_COM_E_SEM_OPT_OUT'],
  ['optOutDetalhe', 'BASECOMOPTOUTDECATALOGO_DET_BASE_TOTAL'],
  ['optOutPdv', 'BASECOMOPTOUTDECATALOGO_OPT_OUT_DE_CATALOGOS_BOT_POR_PDV'],
  ['aderencia', 'GESTAOPEDIDOS_ADERENCIA_POR_CATEGORIA'],
  ['aderencia', 'GESTAOPEDIDOS_HISTORICO_DE_ADERENCIA'],
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

const CSV_FILENAME_HINTS: [CsvKind, string][] = [
  // "Detalhamento_por_Sku" precisa vir antes de "Meta_Sell_In": o nome de arquivo de sell-in por
  // SKU também contém "META_SELL_IN" (ex. "..._Detalhamento_por_Sku_meta_Sell_In_por_Ciclo_...").
  ['sellInDetalheSku', 'GESTAOPEDIDOS_DETALHAMENTO_POR_SKU'],
  ['sellInMeta', 'GESTAOPEDIDOS_META_SELL_IN'],
  ['pedidosVisaoGeral', 'GESTAOPEDIDOS_VISAO_GERAL'],
  ['pedidosGiro', 'GESTAOPEDIDOS_GIRO_PEDIDOS'],
  ['pedidosColocacao', 'GESTAOPEDIDOS_HISTORICO_COLOCACAO'],
];

/** Remove acento antes de tirar o resto — senão "Aderência" vira "ADERNCIA" e não casa com o hint. */
function normalizeName(fileName: string): string {
  return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function detectXlsxKind(fileName: string): XlsxKind | null {
  const norm = normalizeName(fileName);
  for (const [kind, hint] of XLSX_FILENAME_HINTS) {
    if (norm.includes(hint.replace(/_/g, ''))) return kind;
  }
  return null;
}

function detectCsvKind(fileName: string): CsvKind | null {
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
  const norm = header.map(h => (h ?? '').toUpperCase().trim());
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

// --- Gestão de pedidos (CSV, Ciclo 14+) ---

function rowsToPedidosVisaoGeral(rows: string[][]): VDPedidosVisaoGeralRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findCol(header, 'CICLO');
  const iMeta = findCol(header, 'META SUGESTÃO DE PEDIDOS', 'META SUGESTAO DE PEDIDOS', 'META SUGESTÃO');
  const iRealizado = findCol(header, 'PEDIDO REALIZADO');
  const iFaturado = findCol(header, 'PEDIDO FATURADO');
  const iVendaReal = findCol(header, 'VENDA REAL');
  const iGiro = findCol(header, 'GIRO');
  return rows.slice(1)
    .filter(r => (r[iCiclo] ?? '').trim() !== '')
    .map(r => ({
      ciclo: r[iCiclo].trim(),
      metaSugestao: toNum(r[iMeta]),
      pedidoRealizado: toNum(r[iRealizado]),
      pedidoFaturado: toNum(r[iFaturado]),
      vendaReal: toNum(r[iVendaReal]),
      giroPct: toPct(r[iGiro]),
    }));
}

function rowsToPedidosGiro(rows: string[][]): VDPedidosGiroRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findCol(header, 'CICLO');
  const iCanal = findCol(header, 'CANAL');
  const iPedido = findCol(header, 'VOLUME PEDIDO');
  const iFaturado = findCol(header, 'VOLUME FATURADO');
  const iGiro = findCol(header, 'GIRO');
  return rows.slice(1)
    .filter(r => (r[iCanal] ?? '').trim() !== '')
    .map(r => ({
      ciclo: (r[iCiclo] ?? '').trim(),
      canal: r[iCanal].trim(),
      volumePedido: toNum(r[iPedido]),
      volumeFaturado: toNum(r[iFaturado]),
      giroPct: toPct(r[iGiro]),
    }));
}

/** Números deste CSV vêm em formato en-US sem milhar ("3", "0.00%"); toNum (BR) leria "1.5" como 15 — por isso parseFloat direto. */
function numEn(v: string | undefined): number {
  const n = parseFloat(String(v ?? '').replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}

function rowsToPedidosColocacao(rows: string[][]): VDPedidosColocacaoRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const col = (...n: string[]) => findCol(header, ...n);
  const iCiclo = col('CICLO'), iLoja = col('LOJA', 'PDV'), iSku = col('SKU'), iProduto = col('PRODUTO');
  const iUn = col('UN DO MATERIAL'), iCategoria = col('CATEGORIA'), iSub = col('SUB CATEGORIA');
  const iCampanha = col('CAMPANHA'), iMarca = col('MARCA');
  const iSugestao = col('VOLUME PEDIDO SUGESTÃO', 'VOLUME PEDIDO SUGESTAO');
  const iColocado = col('VOLUME PEDIDO COLOCADO');
  const iFaturado = col('VOLUME PEDIDO FATURADO');
  const iGiro = col('GIRO (%)', 'GIRO');
  const txt = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return rows.slice(1)
    .filter(r => txt(r, iLoja) !== '')
    .map(r => ({
      ciclo: txt(r, iCiclo),
      pdv: txt(r, iLoja),
      sku: txt(r, iSku),
      produto: txt(r, iProduto),
      un: txt(r, iUn),
      categoria: txt(r, iCategoria),
      subcategoria: txt(r, iSub),
      campanha: txt(r, iCampanha),
      marca: txt(r, iMarca),
      volumeSugestao: numEn(r[iSugestao]),
      volumeColocado: numEn(r[iColocado]),
      volumeFaturado: numEn(r[iFaturado]),
      giroPct: iGiro >= 0 && txt(r, iGiro) !== '' ? numEn(r[iGiro]) : null,
    }));
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
        } else if (kind === 'sellInDetalheSku') {
          dataset.sellInDetalheSku = rowsToSellInDetalheSku(rows);
          detected.sellInDetalheSku = { fileName: file.name, rowCount: dataset.sellInDetalheSku.length };
        } else if (kind === 'pedidosVisaoGeral') {
          dataset.pedidosVisaoGeral = rowsToPedidosVisaoGeral(rows);
          detected.pedidosVisaoGeral = { fileName: file.name, rowCount: dataset.pedidosVisaoGeral.length };
        } else if (kind === 'pedidosGiro') {
          dataset.pedidosGiro = rowsToPedidosGiro(rows);
          detected.pedidosGiro = { fileName: file.name, rowCount: dataset.pedidosGiro.length };
        } else {
          dataset.pedidosColocacao = rowsToPedidosColocacao(rows);
          detected.pedidosColocacao = { fileName: file.name, rowCount: dataset.pedidosColocacao.length };
        }
        fileNames[kind] = file.name;
        continue;
      }

      const kind = detectXlsxKind(file.name);
      if (!kind) continue;
      const workbook = await readWorkbook(file);
      reportContexts[kind] = readReportContext(workbook);
      // Aderência vem em 2 arquivos (por categoria + histórico) que se completam: guarda os dois nomes.
      fileNames[kind] = kind === 'aderencia' && fileNames.aderencia ? `${fileNames.aderencia} + ${file.name}` : file.name;

      switch (kind) {
        case 'receitaCanalVDPdv': {
          const { rows, layout } = parseReceitaCanalVDPdvXlsxComLayout(workbook);
          dataset.receitaCanalVDPdv = rows;
          dataset.receitaCanalVDPdvLayout = layout;
          detected.receitaCanalVDPdv = { fileName: file.name, rowCount: rows.length };
          break;
        }
        case 'receitaCanalVDCiclo': {
          dataset.receitaCanalVDCiclo = parseReceitaCanalVDCicloXlsx(workbook);
          detected.receitaCanalVDCiclo = { fileName: file.name, rowCount: dataset.receitaCanalVDCiclo.length };
          break;
        }
        case 'vdReceitaCiclo': {
          dataset.vdReceitaCiclo = parseVDReceitaCicloXlsx(workbook);
          detected.vdReceitaCiclo = { fileName: file.name, rowCount: dataset.vdReceitaCiclo.length };
          break;
        }
        case 'distribuicaoReceita': {
          dataset.distribuicaoReceita = parseDistribuicaoReceitaXlsx(workbook);
          detected.distribuicaoReceita = { fileName: file.name, rowCount: dataset.distribuicaoReceita.pdv.length };
          break;
        }
        case 'receitaCategoriaMix': {
          dataset.receitaCategoriaMix = parseReceitaCategoriaMixXlsx(workbook);
          detected.receitaCategoriaMix = { fileName: file.name, rowCount: dataset.receitaCategoriaMix.pdv.length };
          break;
        }
        case 'arvorePedidos': {
          dataset.arvorePedidos = parseArvorePedidosXlsx(workbook);
          detected.arvorePedidos = { fileName: file.name, rowCount: dataset.arvorePedidos.faixas.length };
          break;
        }
        case 'performancePdvSupervisor': {
          dataset.performancePdvSupervisor = parsePerformancePdvSupervisorXlsx(workbook);
          detected.performancePdvSupervisor = { fileName: file.name, rowCount: dataset.performancePdvSupervisor.supervisor.length };
          break;
        }
        case 'receitaUnGmv': {
          dataset.receitaUnGmv = parseReceitaUnGmvXlsx(workbook);
          detected.receitaUnGmv = { fileName: file.name, rowCount: dataset.receitaUnGmv.length };
          break;
        }
        case 'ativasCanaisDigitais':
        case 'ativasEspacoRevendedor': {
          const r = parseAtivasUmaCompraXlsx(workbook);
          if (r) {
            dataset[kind] = r;
            detected[kind] = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'ferramentasDigitaisPdv': {
          dataset.ferramentasDigitaisPdv = parseFerramentasDigitaisPdvXlsx(workbook);
          detected.ferramentasDigitaisPdv = { fileName: file.name, rowCount: dataset.ferramentasDigitaisPdv.length };
          break;
        }
        case 'optOutBase': {
          const r = parseOptOutBaseXlsx(workbook);
          if (r) {
            dataset.optOutBase = r;
            detected.optOutBase = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'optOutDetalhe': {
          const r = parseOptOutDetalheXlsx(workbook);
          if (r) {
            dataset.optOutDetalhe = r;
            detected.optOutDetalhe = { fileName: file.name, rowCount: 1 };
          }
          break;
        }
        case 'optOutPdv': {
          dataset.optOutPdv = parseOptOutPdvXlsx(workbook);
          detected.optOutPdv = { fileName: file.name, rowCount: dataset.optOutPdv.length };
          break;
        }
        case 'aderencia': {
          dataset.aderencia = mergeAderencia(dataset.aderencia, parseAderenciaXlsx(workbook));
          detected.aderencia = { fileName: fileNames.aderencia!, rowCount: dataset.aderencia.pdv.length };
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
