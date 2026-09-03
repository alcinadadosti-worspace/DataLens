import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  LojaDimension, LojaDataset, LojaMetricRow, LojaParseResult, LOJA_DIMENSIONS, LOJA_DIMENSION_LABELS,
  LojaOptionalFile, AbcRow, VendaHoraRow, PedidoVisaoGeralRow, PedidoGiroCanalRow, PedidoHistoricoRow,
} from '../types/loja';
import { parseResumoPerformanceXlsx, parseReceitaCanalXlsx, parseReceitaCategoriaXlsx } from './lojaXlsxParser';
import { toNum, toPct } from './lojaNumberUtils';

const FILENAME_HINTS: Record<LojaDimension, string> = {
  lojas: 'LOJAS',
  forma: 'FORMA',
  consultor: 'CONSULTOR',
  operador: 'OPERADOR',
  data: 'DATA',
  canal: 'CANAL',
  gestao: 'GESTAO',
};

const HEADER_HINTS: Record<LojaDimension, string> = {
  lojas: 'QUEBRAR POR LOJAS',
  forma: 'QUEBRAR POR FORMA',
  consultor: 'QUEBRAR POR CONSULTOR',
  operador: 'QUEBRAR POR OPERADOR',
  data: 'QUEBRAR POR DATA',
  canal: 'QUEBRAR POR CANAL',
  gestao: 'QUEBRAR POR GEST',
};

// Padrões de nome para os arquivos opcionais (CSV). xlsx (resumoPerformance/receitaCanal/receitaCategoria)
// são detectados separadamente pela extensão + hint de nome em detectOptionalXlsx.
const OPTIONAL_CSV_FILENAME_HINTS: Partial<Record<LojaOptionalFile, string>> = {
  abc: 'ABCVENDA',
  vendaPorHora: 'VENDAPORHORA',
  pedidosVisaoGeral: 'GESTAOPEDIDOS_VISAO_GERAL',
  pedidosGiroCanais: 'GESTAOPEDIDOS_GIRO_PEDIDOS_CANAIS',
  pedidosHistorico: 'GESTAOPEDIDOS_HISTORICO_COLOCACAO',
};

const XLSX_FILENAME_HINTS: Record<'resumoPerformance' | 'receitaCanal' | 'receitaCategoria', string> = {
  resumoPerformance: 'RESUMO_DE_PERFORMANCE',
  receitaCanal: 'RECEITA_POR_CANAL',
  receitaCategoria: 'RECEITA_POR_CAT',
};

function stripBOM(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function normalizeName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function splitCodeName(raw: string): { codigo: string | null; nome: string } {
  const s = (raw ?? '').trim();
  const m = s.match(/^(\d+)\s*-\s*(.+)$/);
  if (m) return { codigo: m[1], nome: m[2].trim() };
  return { codigo: null, nome: s };
}

export function detectDimension(fileName: string, headerCol1?: string): LojaDimension | null {
  const upperName = fileName.toUpperCase();
  for (const dim of LOJA_DIMENSIONS) {
    if (upperName.includes(FILENAME_HINTS[dim])) return dim;
  }
  if (headerCol1) {
    const upperHeader = headerCol1.toUpperCase();
    for (const dim of LOJA_DIMENSIONS) {
      if (upperHeader.includes(HEADER_HINTS[dim])) return dim;
    }
  }
  return null;
}

function detectOptionalCsv(fileName: string): LojaOptionalFile | null {
  const upperName = normalizeName(fileName);
  for (const [key, hint] of Object.entries(OPTIONAL_CSV_FILENAME_HINTS)) {
    if (upperName.includes(normalizeName(hint!))) return key as LojaOptionalFile;
  }
  return null;
}

function detectOptionalXlsx(fileName: string): 'resumoPerformance' | 'receitaCanal' | 'receitaCategoria' | null {
  const upperName = normalizeName(fileName);
  for (const [key, hint] of Object.entries(XLSX_FILENAME_HINTS)) {
    if (upperName.includes(normalizeName(hint))) return key as 'resumoPerformance' | 'receitaCanal' | 'receitaCategoria';
  }
  return null;
}

function parseCSVText(text: string, delimiter?: string): string[][] {
  const result = Papa.parse<string[]>(stripBOM(text), {
    skipEmptyLines: true,
    dynamicTyping: false,
    delimiter,
  });
  return result.data as string[][];
}

async function readText(file: File, encoding: 'utf-8' | 'iso-8859-1'): Promise<string> {
  if (encoding === 'utf-8') return file.text();
  const buffer = await file.arrayBuffer();
  return new TextDecoder('iso-8859-1').decode(buffer);
}

function rowsToLojaMetrics(rows: string[][]): LojaMetricRow[] {
  if (rows.length < 2) return [];
  const dataRows = rows.slice(1); // skip header
  return dataRows
    .filter(r => r.length >= 26 && (r[0] ?? '').trim() !== '')
    .map(r => {
      const loja = splitCodeName(r[0]);
      const quebra = splitCodeName(r[1]);
      return {
        lojaCodigo: loja.codigo,
        lojaNome: loja.nome,
        quebraCodigo: quebra.codigo,
        quebraNome: quebra.nome,
        gmv: toNum(r[2]),
        boletoMedio: toNum(r[3]),
        qtdBoletos: toNum(r[4]),
        itensPorBoleto: toNum(r[5]),
        receitaLiquida: toNum(r[16]),
        receitaLiquidaSemTrocas: toNum(r[17]),
        vendasB1: toNum(r[18]),
        fidelidadeQtdBoletos: toNum(r[19]),
        fidelidadePenetracao: toNum(r[20]),
        totalDescontos: toNum(r[21]),
        trocasValor: toNum(r[22]),
        qtdTrocas: toNum(r[23]),
        cartaoRecarga: toNum(r[24]),
        quantitativoB1: toNum(r[25]),
      } as LojaMetricRow;
    });
}

// --- Curva ABC (relatorioABCVenda*.csv, Latin-1, `;`) ---
// Colunas esperadas (índice pode variar por exportação, então localizamos por header):
// Quebra (data), Quebra2 (loja, se aberto), Código, Descrição, Quantidade, Faturamento, Custo, Lucro, Margem, Markup, Classificação
function findCol(header: string[], ...names: string[]): number {
  const norm = header.map(h => normalizeName(h ?? ''));
  for (const name of names) {
    const idx = norm.indexOf(normalizeName(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

function rowsToAbc(rows: string[][]): AbcRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iQuebra = findCol(header, 'Quebra');
  const iQuebra2 = findCol(header, 'Quebra2');
  const iCodigo = findCol(header, 'Código', 'Codigo');
  const iDescricao = findCol(header, 'Descrição', 'Descricao');
  const iQtd = findCol(header, 'Quantidade', 'Qtd');
  const iFat = findCol(header, 'Faturamento');
  const iCusto = findCol(header, 'Custo');
  const iLucro = findCol(header, 'Lucro');
  const iMargem = findCol(header, 'Margem');
  const iMarkup = findCol(header, 'Markup');
  const iClass = findCol(header, 'Classificação', 'Classificacao', 'Classe');

  return rows.slice(1)
    .filter(r => (r[iCodigo] ?? '').trim() !== '')
    .map(r => {
      const quebra2Raw = iQuebra2 >= 0 ? (r[iQuebra2] ?? '').trim() : '';
      const loja = quebra2Raw ? splitCodeName(quebra2Raw) : null;
      return {
        data: iQuebra >= 0 ? (r[iQuebra] ?? '').trim() : '',
        lojaCodigo: loja?.codigo ?? null,
        lojaNome: loja?.nome ?? null,
        codigo: (r[iCodigo] ?? '').trim(),
        descricao: iDescricao >= 0 ? (r[iDescricao] ?? '').trim() : '',
        quantidade: toNum(r[iQtd]),
        faturamento: toNum(r[iFat]),
        custo: toNum(r[iCusto]),
        lucro: toNum(r[iLucro]),
        margem: toPct(r[iMargem]),
        markup: toNum(r[iMarkup]),
        classificacao: iClass >= 0 ? (r[iClass] ?? '').trim() : '',
      } as AbcRow;
    });
}

// --- Venda por hora (relatorioVendaPorHora.csv, `;`) ---
function rowsToVendaHora(rows: string[][]): VendaHoraRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iLoja = findCol(header, 'Loja');
  const iData = findCol(header, 'Data');
  const iHora = findCol(header, 'Hora', 'Faixa Horária', 'Faixa Horaria');
  const iReceita = findCol(header, 'Receita líquida', 'Receita Liquida', 'Receita');
  const iBoletos = findCol(header, 'Boletos', 'Qtd Boletos');

  return rows.slice(1)
    .filter(r => (r[iLoja] ?? '').trim() !== '')
    .map(r => {
      const loja = splitCodeName((r[iLoja] ?? '').trim());
      return {
        lojaCodigo: loja.codigo,
        lojaNome: loja.nome,
        data: iData >= 0 ? (r[iData] ?? '').trim() : '',
        faixaHoraria: iHora >= 0 ? (r[iHora] ?? '').trim() : '',
        receitaLiquida: toNum(r[iReceita]),
        qtdBoletos: toNum(r[iBoletos]),
      } as VendaHoraRow;
    });
}

// --- GestaoPedidos_Visao_Geral_por_Ciclo ---
function rowsToPedidosVisaoGeral(rows: string[][]): PedidoVisaoGeralRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iLabel = 0;
  const iMeta = findCol(header, 'Meta Sugestão', 'Meta de Sugestão', 'Volume Pedido Sugestão');
  const iColocado = findCol(header, 'Pedido Colocado', 'Volume Colocado', 'Colocado');
  const iFaturado = findCol(header, 'Pedido Faturado', 'Volume Faturado', 'Faturado');
  const iVendaReal = findCol(header, 'Venda Real');
  const iGiro = findCol(header, 'Giro');

  return rows.slice(1)
    .filter(r => (r[iLabel] ?? '').trim() !== '')
    .map(r => ({
      label: (r[iLabel] ?? '').trim(),
      metaSugestao: toNum(r[iMeta]),
      volumeColocado: toNum(r[iColocado]),
      volumeFaturado: toNum(r[iFaturado]),
      vendaReal: toNum(r[iVendaReal]),
      giro: toPct(r[iGiro]),
    } as PedidoVisaoGeralRow));
}

// --- GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo ---
function rowsToPedidosGiroCanal(rows: string[][]): PedidoGiroCanalRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCanal = findCol(header, 'Canal');
  const iGeral = findCol(header, 'Geral', 'Giro Geral');
  const iLoja = findCol(header, 'Loja', 'Giro Loja');

  return rows.slice(1)
    .filter(r => (r[iCanal] ?? '').trim() !== '')
    .map(r => ({
      canal: (r[iCanal] ?? '').trim(),
      giroGeral: toPct(r[iGeral]),
      giroLoja: toPct(r[iLoja]),
    } as PedidoGiroCanalRow));
}

// --- GestaoPedidos_Historico_Colocacao_Pedido (linha a linha por loja/SKU) ---
function rowsToPedidosHistorico(rows: string[][]): PedidoHistoricoRow[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const iLoja = findCol(header, 'Loja');
  const iSku = findCol(header, 'SKU', 'Código', 'Codigo');
  const iCategoria = findCol(header, 'Categoria');
  const iSugestao = findCol(header, 'Volume Pedido Sugestão', 'Sugestão', 'Sugestao');
  const iColocado = findCol(header, 'Volume Colocado', 'Colocado');
  const iFaturado = findCol(header, 'Volume Faturado', 'Faturado');

  return rows.slice(1)
    .filter(r => (r[iLoja] ?? '').trim() !== '')
    .map(r => {
      const loja = splitCodeName((r[iLoja] ?? '').trim());
      return {
        lojaCodigo: loja.codigo,
        lojaNome: loja.nome,
        sku: iSku >= 0 ? (r[iSku] ?? '').trim() : '',
        categoria: iCategoria >= 0 ? (r[iCategoria] ?? '').trim() || null : null,
        volumeSugestao: toNum(r[iSugestao]),
        volumeColocado: toNum(r[iColocado]),
        volumeFaturado: toNum(r[iFaturado]),
      } as PedidoHistoricoRow;
    });
}

export async function parseLojaFiles(files: File[]): Promise<LojaParseResult> {
  const errors: string[] = [];
  const detected: LojaParseResult['detected'] = {};
  const detectedOptional: LojaParseResult['detectedOptional'] = {};
  const byDimension: Partial<Record<LojaDimension, LojaMetricRow[]>> = {};
  const fileNames: Partial<Record<LojaDimension, string>> = {};
  const optionalFileNames: LojaDataset['optionalFileNames'] = {};

  const optional: Partial<Pick<LojaDataset,
    'abc' | 'vendaPorHora' | 'pedidosVisaoGeral' | 'pedidosGiroCanais' | 'pedidosHistorico' |
    'resumoPerformance' | 'receitaCanal' | 'receitaCategoria'>> = {};

  for (const file of files) {
    const isXlsx = /\.xlsx?$/i.test(file.name);

    try {
      if (isXlsx) {
        const xlsxKind = detectOptionalXlsx(file.name);
        if (!xlsxKind) {
          errors.push(`${file.name}: arquivo xlsx não reconhecido (esperado Resumo de Performance, Receita por Canal ou Receita por Categoria)`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

        if (xlsxKind === 'resumoPerformance') {
          optional.resumoPerformance = parseResumoPerformanceXlsx(workbook);
          detectedOptional.resumoPerformance = { fileName: file.name, rowCount: optional.resumoPerformance.cp.length + optional.resumoPerformance.pdv.length };
        } else if (xlsxKind === 'receitaCanal') {
          optional.receitaCanal = parseReceitaCanalXlsx(workbook);
          detectedOptional.receitaCanal = { fileName: file.name, rowCount: optional.receitaCanal.length };
        } else {
          optional.receitaCategoria = parseReceitaCategoriaXlsx(workbook);
          detectedOptional.receitaCategoria = { fileName: file.name, rowCount: optional.receitaCategoria.categoria.length };
        }
        optionalFileNames![xlsxKind] = file.name;
        continue;
      }

      // CSV path
      const optKind = detectOptionalCsv(file.name);
      const encoding: 'utf-8' | 'iso-8859-1' = (optKind === 'abc' || optKind === 'vendaPorHora') ? 'iso-8859-1' : 'utf-8';
      const text = await readText(file, encoding);
      // Sem delimiter explícito: Papa Parse auto-detecta (LOJAS.csv costuma vir com `,`, os demais com `;`).
      const rows = parseCSVText(text);
      if (rows.length === 0) {
        errors.push(`${file.name}: arquivo vazio`);
        continue;
      }

      if (optKind) {
        switch (optKind) {
          case 'abc': {
            optional.abc = rowsToAbc(rows);
            detectedOptional.abc = { fileName: file.name, rowCount: optional.abc.length };
            break;
          }
          case 'vendaPorHora': {
            optional.vendaPorHora = rowsToVendaHora(rows);
            detectedOptional.vendaPorHora = { fileName: file.name, rowCount: optional.vendaPorHora.length };
            break;
          }
          case 'pedidosVisaoGeral': {
            optional.pedidosVisaoGeral = rowsToPedidosVisaoGeral(rows);
            detectedOptional.pedidosVisaoGeral = { fileName: file.name, rowCount: optional.pedidosVisaoGeral.length };
            break;
          }
          case 'pedidosGiroCanais': {
            optional.pedidosGiroCanais = rowsToPedidosGiroCanal(rows);
            detectedOptional.pedidosGiroCanais = { fileName: file.name, rowCount: optional.pedidosGiroCanais.length };
            break;
          }
          case 'pedidosHistorico': {
            optional.pedidosHistorico = rowsToPedidosHistorico(rows);
            detectedOptional.pedidosHistorico = { fileName: file.name, rowCount: optional.pedidosHistorico.length };
            break;
          }
        }
        optionalFileNames![optKind] = file.name;
        continue;
      }

      const headerCol1 = rows[0]?.[1];
      const dim = detectDimension(file.name, headerCol1);
      if (!dim) {
        errors.push(`${file.name}: dimensão não reconhecida (esperado: ${LOJA_DIMENSIONS.map(d => LOJA_DIMENSION_LABELS[d]).join(', ')}, ou um dos arquivos opcionais)`);
        continue;
      }
      const metrics = rowsToLojaMetrics(rows);
      byDimension[dim] = metrics;
      fileNames[dim] = file.name;
      detected[dim] = { fileName: file.name, rowCount: metrics.length };
    } catch (e) {
      errors.push(`${file.name}: erro ao processar (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  const missing = LOJA_DIMENSIONS.filter(d => !byDimension[d]);
  if (missing.length > 0) {
    errors.push(`Faltando: ${missing.map(d => LOJA_DIMENSION_LABELS[d]).join(', ')}`);
  }

  if (missing.length > 0) {
    return { dataset: null, detected, detectedOptional, errors };
  }

  const dataset: LojaDataset = {
    lojas: byDimension.lojas!,
    forma: byDimension.forma!,
    consultor: byDimension.consultor!,
    operador: byDimension.operador!,
    data: byDimension.data!,
    canal: byDimension.canal!,
    gestao: byDimension.gestao!,
    fileNames,
    importedAt: new Date(),
    ...optional,
    optionalFileNames,
  };

  return { dataset, detected, detectedOptional, errors };
}
