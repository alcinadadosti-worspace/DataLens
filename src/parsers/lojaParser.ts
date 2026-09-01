import Papa from 'papaparse';
import { LojaDimension, LojaDataset, LojaMetricRow, LojaParseResult, LOJA_DIMENSIONS, LOJA_DIMENSION_LABELS } from '../types/loja';

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

function stripBOM(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.trim();
  if (s === '') return 0;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
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

function parseCSVText(text: string): string[][] {
  const result = Papa.parse<string[]>(stripBOM(text), {
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return result.data as string[][];
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

export async function parseLojaFiles(files: File[]): Promise<LojaParseResult> {
  const errors: string[] = [];
  const detected: LojaParseResult['detected'] = {};
  const byDimension: Partial<Record<LojaDimension, LojaMetricRow[]>> = {};
  const fileNames: Partial<Record<LojaDimension, string>> = {};

  for (const file of files) {
    try {
      const text = await file.text();
      const rows = parseCSVText(text);
      if (rows.length === 0) {
        errors.push(`${file.name}: arquivo vazio`);
        continue;
      }
      const headerCol1 = rows[0]?.[1];
      const dim = detectDimension(file.name, headerCol1);
      if (!dim) {
        errors.push(`${file.name}: dimensão não reconhecida (esperado: ${LOJA_DIMENSIONS.map(d => LOJA_DIMENSION_LABELS[d]).join(', ')})`);
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
    return { dataset: null, detected, errors };
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
  };

  return { dataset, detected, errors };
}
