import * as XLSX from 'xlsx';
import {
  ReportContext, ReceitaCanalVDBlock, ReceitaCanalVDPdvRow, ReceitaCanalVDUnDataset,
  ReceitaCanalVDPeriodoRow, ReceitaPeriodoDataset, ReceitaPeriodoRow, ReceitaCanalUnRow,
  VDReceitaCategoriaDataset, VDReceitaCategoriaRow, RupturaResumoRow, RupturaItemRow,
  EvolucaoBaseRow, MonitoramentoBaseDataset, MonitoramentoBaseRow, PenetracaoBaseRow,
  PenetracaoAtivosDetalhadaRow, AtivasPorTierRow, SegmentacaoBaseDataset, PenetracaoCategoriaUnRow,
  DetalhamentoCategoriasUnDataset,
} from '../types/vdCorporate';
import { toNum, toPct, toPctOrNull } from './vdNumberUtils';
import { canonicalizeUN } from '../design-system/unCanon';

// --- Helpers genéricos de leitura de pivot (mirror de lojaXlsxParser.ts, duplicado para manter os
// dois modos desacoplados — ver LEITURA_PLANILHAS_VD.md §4 para o porquê da estrutura em múltiplas
// linhas de cabeçalho mescladas ser comum a esses relatórios de BI corporativo). ---

function normalizeCell(v: unknown): string {
  // "%" vira "PCT" antes de remover os demais símbolos — senão "% Base Multimarcas" e "Base
  // Multimarcas" normalizariam para a mesma string (o "%" seria só removido) e colidiriam.
  return String(v ?? '').toUpperCase().replace(/%/g, 'PCT').replace(/[^A-Z0-9]/g, '');
}

function findSheet(workbook: XLSX.WorkBook, ...nameHints: string[]): XLSX.WorkSheet | null {
  const upperNames = workbook.SheetNames.map(n => n.toUpperCase());
  for (const hint of nameHints) {
    const idx = upperNames.findIndex(n => n === hint.toUpperCase());
    if (idx >= 0) return workbook.Sheets[workbook.SheetNames[idx]];
  }
  for (const hint of nameHints) {
    const idx = upperNames.findIndex(n => n.includes(hint.toUpperCase()));
    if (idx >= 0) return workbook.Sheets[workbook.SheetNames[idx]];
  }
  return null;
}

function findFirstDataSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const idx = workbook.SheetNames.findIndex(n => n.toUpperCase() !== 'FILTROS');
  return idx >= 0 ? workbook.Sheets[workbook.SheetNames[idx]] : null;
}

function sheetToRows(sheet: XLSX.WorkSheet | null): unknown[][] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
}

function findColByName(header: unknown[], ...names: string[]): number {
  const norm = header.map(normalizeCell);
  for (const name of names) {
    const idx = norm.indexOf(normalizeCell(name));
    if (idx >= 0) return idx;
  }
  for (const name of names) {
    const target = normalizeCell(name);
    const idx = norm.findIndex(h => h.includes(target));
    if (idx >= 0) return idx;
  }
  return -1;
}

function findHeaderRowIndex(rows: unknown[][], ...mustContainAny: string[]): number {
  const targets = mustContainAny.map(normalizeCell);
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const norm = rows[i].map(normalizeCell);
    if (targets.some(t => norm.some(h => h.includes(t)))) return i;
  }
  return 0;
}

function isTotalRow(nome: string): boolean {
  return nome.trim().toUpperCase() === 'TOTAL';
}

export function readReportContext(workbook: XLSX.WorkBook): ReportContext {
  const sheet = findSheet(workbook, 'FILTROS');
  const rows = sheetToRows(sheet);
  const get = (label: string): string | null => {
    const row = rows.find(r => normalizeCell(r[0]) === normalizeCell(label));
    const v = row ? String(row[1] ?? '').trim() : '';
    return v === '' || v === '-' ? null : v;
  };
  return {
    tipoReceita: get('TIPO DE RECEITA'),
    cicloAtual: get('CICLO ATUAL') ?? get('PERÍODO ATUAL'),
    cicloAnterior: get('CICLO ANTERIOR') ?? get('PERÍODO ANTERIOR'),
    cp: get('CP'),
    pdvFiltro: get('PDV'),
    canalFiltro: get('CANAL'),
    unFiltro: get('UN. DE NEGÓCIO') ?? get('UN DE NEGOCIO'),
  };
}

// --- Receita ---

/** ReceitaCanalVD_Performance_por_PDV.xlsx — blocos VD / OMNI ENVIO ER / TOTAL por linha (PDV ou TOTAL da rede). */
export function parseReceitaCanalVDPdvXlsx(workbook: XLSX.WorkBook): ReceitaCanalVDPdvRow[] {
  const sheet = findSheet(workbook, 'PERFORMANCE POR PDV') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 4) return [];
  const groupRowIdx = findHeaderRowIndex(rows, 'VD', 'OMNI', 'TOTAL');
  const groupRow = rows[groupRowIdx];
  const labelRow = rows[groupRowIdx + 1] ?? [];
  const dataRows = rows.slice(groupRowIdx + 2);

  const vdStart = findColByName(groupRow, 'VD');
  const omniStart = findColByName(groupRow, 'OMNI ENVIO ER', 'OMNI');
  const totalStart = findColByName(groupRow, 'TOTAL');
  const starts = [vdStart, omniStart, totalStart].filter(i => i >= 0);

  function blockEnd(start: number): number {
    const later = starts.filter(i => i > start).sort((a, b) => a - b);
    return later.length > 0 ? later[0] : labelRow.length;
  }
  function colInBlock(start: number, hint: string): number {
    if (start < 0) return -1;
    const end = blockEnd(start);
    const target = normalizeCell(hint);
    for (let i = start; i < end; i++) if (normalizeCell(labelRow[i]) === target) return i;
    for (let i = start; i < end; i++) if (normalizeCell(labelRow[i]).includes(target)) return i;
    return -1;
  }
  // "GAP ACORDADO (%)" e "REALIZADO (%)" já vêm como fração do Excel (0.9335 = 93,35%) — sem a
  // heurística de toPct (fração se |n|<=1), que erraria quando o realizado passa de 100% da meta.
  function fractionToPct(v: unknown): number | null {
    if (typeof v === 'number') return v * 100;
    const s = String(v ?? '').trim();
    if (s === '' || s === '-' || s === '--') return null;
    return toNum(v) * 100;
  }
  function readBlock(start: number, r: unknown[]): ReceitaCanalVDBlock {
    const iAnterior = colInBlock(start, 'RECEITA ANTERIOR (R$)');
    const iAtual = colInBlock(start, 'RECEITA ATUAL (R$)');
    const iMeta = colInBlock(start, 'META PEF (R$)');
    const iGapValor = colInBlock(start, 'GAP ACORDADO (R$)');
    const iGapPct = colInBlock(start, 'GAP ACORDADO (%)');
    const iRealizado = colInBlock(start, 'REALIZADO (%)');
    return {
      receitaAnterior: iAnterior >= 0 ? toNum(r[iAnterior]) : 0,
      receitaAtual: iAtual >= 0 ? toNum(r[iAtual]) : 0,
      metaPef: iMeta >= 0 ? toNum(r[iMeta]) : 0,
      gapAcordadoValor: iGapValor >= 0 ? toNum(r[iGapValor]) : 0,
      gapAcordadoPct: iGapPct >= 0 ? fractionToPct(r[iGapPct]) : null,
      realizadoPct: iRealizado >= 0 ? fractionToPct(r[iRealizado]) : null,
    };
  }

  return dataRows
    .filter(r => String(r[0] ?? '').trim() !== '')
    .map(r => ({
      un: canonicalizeUN(String(r[0] ?? '').trim()).label,
      pdvCodigo: String(r[1] ?? '').trim() || null,
      cidade: String(r[2] ?? '').trim(),
      localPdv: String(r[3] ?? '').trim(),
      vd: readBlock(vdStart, r),
      omni: readBlock(omniStart, r),
      total: readBlock(totalStart, r),
    } as ReceitaCanalVDPdvRow));
}

/** ReceitaCanalVD_por_UN.xlsx — total do CP + bloco META/REALIZADO/ANTERIOR e Composição Receita por UN, repetidos. */
export function parseReceitaCanalVDUnXlsx(workbook: XLSX.WorkBook): ReceitaCanalVDUnDataset | null {
  const sheet = findSheet(workbook, 'META POR UN') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return null;

  const totalHeaderIdx = rows.findIndex(r => normalizeCell(String(r[0] ?? '')) === 'META');
  if (totalHeaderIdx < 0) return null;
  const totalHeader = rows[totalHeaderIdx];
  const totalData = rows[totalHeaderIdx + 1] ?? [];
  const iMeta = findColByName(totalHeader, 'META');
  const iRealizado = findColByName(totalHeader, 'REALIZADO');
  const iAnterior = findColByName(totalHeader, 'ANTERIOR');
  const iVar = findColByName(totalHeader, 'VARIAÇÃO PERCENTUAL', 'VARIACAO PERCENTUAL');

  const totalMeta = iMeta >= 0 ? toNum(totalData[iMeta]) : 0;
  const totalRealizado = iRealizado >= 0 ? toNum(totalData[iRealizado]) : 0;
  const totalAnterior = iAnterior >= 0 ? toNum(totalData[iAnterior]) : 0;
  const totalVariacaoPct = iVar >= 0 ? toPct(totalData[iVar]) : 0;

  const isComposicaoRow = (r: unknown[] | undefined) => String(r?.[0] ?? '').trim().toLowerCase().startsWith('composição receita');

  function readComposicao(startIdx: number): { list: { nome: string; realizado: number; anterior: number }[]; nextIdx: number } {
    const header = rows[startIdx + 1] ?? [];
    const iNome = findColByName(header, 'NOME');
    const iCompRealizado = findColByName(header, 'REALIZADO');
    const iCompAnterior = findColByName(header, 'ANTERIOR');
    const list: { nome: string; realizado: number; anterior: number }[] = [];
    let j = startIdx + 2;
    for (; j < rows.length; j++) {
      const nome = String(rows[j]?.[iNome >= 0 ? iNome : 0] ?? '').trim();
      if (!nome) break; // linha em branco fecha o bloco de composição
      list.push({
        nome,
        realizado: iCompRealizado >= 0 ? toNum(rows[j][iCompRealizado]) : 0,
        anterior: iCompAnterior >= 0 ? toNum(rows[j][iCompAnterior]) : 0,
      });
    }
    return { list, nextIdx: j };
  }

  const porUn: ReceitaCanalVDUnDataset['porUn'] = [];
  let i = totalHeaderIdx + 2;
  while (i < rows.length) {
    const rowLabel = String(rows[i]?.[0] ?? '').trim();
    const nextRow = rows[i + 1];
    const nextIsHeader = !!nextRow && normalizeCell(String(nextRow[0] ?? '')) === 'META';
    if (rowLabel !== '' && normalizeCell(rowLabel) !== 'METAPORUN' && nextIsHeader) {
      const dataRow = rows[i + 2] ?? [];
      let cursor = i + 3;
      let composicao: { nome: string; realizado: number; anterior: number }[] = [];
      // pula linha em branco até achar "Composição Receita:" (ou o próximo bloco de UN, o que vier primeiro)
      while (cursor < rows.length && String(rows[cursor]?.[0] ?? '').trim() === '') cursor++;
      if (isComposicaoRow(rows[cursor])) {
        const res = readComposicao(cursor);
        composicao = res.list;
        cursor = res.nextIdx;
      }
      porUn.push({
        un: canonicalizeUN(rowLabel).label,
        meta: toNum(dataRow[0]),
        realizado: toNum(dataRow[1]),
        anterior: toNum(dataRow[2]),
        variacaoPct: toPct(dataRow[3]),
        composicao,
      });
      i = cursor;
      continue;
    }
    i += 1;
  }

  const composicaoTotal: { nome: string; realizado: number; anterior: number }[] = [];
  for (const un of porUn) {
    for (const c of un.composicao) {
      const existing = composicaoTotal.find(x => x.nome === c.nome);
      if (existing) {
        existing.realizado += c.realizado;
        existing.anterior += c.anterior;
      } else {
        composicaoTotal.push({ ...c });
      }
    }
  }

  return { totalMeta, totalRealizado, totalAnterior, totalVariacaoPct, porUn, composicaoTotal };
}

/** ReceitaCanalVD_por_Periodo.xlsx — neste lote só tem FILTROS; tolera lista vazia. */
export function parseReceitaCanalVDPeriodoXlsx(workbook: XLSX.WorkBook): ReceitaCanalVDPeriodoRow[] {
  const sheet = findFirstDataSheet(workbook);
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'DATA', 'RECEITA');
  const header = rows[headerIdx];
  const iData = findColByName(header, 'DATA', 'DIA');
  const iReceita = findColByName(header, 'RECEITA');
  if (iData < 0 || iReceita < 0) return [];
  return rows.slice(headerIdx + 1)
    .filter(r => String(r[iData] ?? '').trim() !== '')
    .map(r => ({ data: String(r[iData]).trim(), receita: toNum(r[iReceita]) }));
}

/** Receita_por_Periodo.xlsx — abas DIA/MÊS, cabeçalho de grupo + rótulo, inclui linha TOTAL. */
function parsePeriodoSheet(sheet: XLSX.WorkSheet | null): ReceitaPeriodoRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];
  const headerIdx = findHeaderRowIndex(rows, 'ANTERIOR', 'ATUAL');
  const header = rows[headerIdx];
  const iLabel = 0;
  const iAnterior = findColByName(header, 'PERÍODO ANTERIOR', 'PERIODO ANTERIOR', 'ANTERIOR');
  const iAtual = findColByName(header, 'PERÍODO ATUAL', 'PERIODO ATUAL', 'ATUAL');
  const iVar = findColByName(header, 'VARIAÇÃO', 'VARIACAO');
  return rows.slice(headerIdx + 1)
    .filter(r => String(r[iLabel] ?? '').trim() !== '')
    .map(r => ({
      label: String(r[iLabel]).trim(),
      receitaAnterior: iAnterior >= 0 ? toNum(r[iAnterior]) : 0,
      receitaAtual: iAtual >= 0 ? toNum(r[iAtual]) : 0,
      variacaoPct: iVar >= 0 ? toPct(r[iVar]) : 0,
    } as ReceitaPeriodoRow));
}

export function parseReceitaPeriodoXlsx(workbook: XLSX.WorkBook): ReceitaPeriodoDataset {
  return {
    dia: parsePeriodoSheet(findSheet(workbook, 'DIA')),
    mes: parsePeriodoSheet(findSheet(workbook, 'MÊS', 'MES')),
  };
}

/** Receita_por_Canal_UN.xlsx (legado) — canal + sub-linhas de UN indentadas (prefixo de espaços no nome). */
export function parseReceitaCanalUnXlsx(workbook: XLSX.WorkBook): ReceitaCanalUnRow[] {
  const sheet = findSheet(workbook, 'RECEITA POR CANAL', 'CANAL') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'CANAL', 'UN');
  const header = rows[headerIdx];
  const iCanal = findColByName(header, 'CANAL/UN', 'CANAL', 'UN');
  const iAnterior = findColByName(header, 'CICLO ANTERIOR', 'ANTERIOR');
  const iAtual = findColByName(header, 'CICLO ATUAL', 'ATUAL');
  const iVar = findColByName(header, 'VARIAÇÃO', 'VARIACAO');
  if (iCanal < 0) return [];

  return rows.slice(headerIdx + 1)
    .filter(r => String(r[iCanal] ?? '').trim() !== '' && !isTotalRow(String(r[iCanal])))
    .map(r => {
      const raw = String(r[iCanal] ?? '');
      return {
        canal: raw.trim(),
        receitaAnterior: iAnterior >= 0 ? toNum(r[iAnterior]) : 0,
        receitaAtual: iAtual >= 0 ? toNum(r[iAtual]) : 0,
        variacaoPct: iVar >= 0 ? toPct(r[iVar]) : 0,
        indent: /^\s{2,}/.test(raw),
      } as ReceitaCanalUnRow;
    });
}

/**
 * Abas CATEGORIA/SUBCATEGORIA/LINHA/MARCA de Receita_por_Cat_Sub_Mar.xlsx — 2 linhas de header
 * mescladas (grupo "CICLO ANTERIOR"/"CICLO ATUAL"/"VARIAÇÃO" + rótulo "RECEITA (R$)"/"PARTICIPAÇÃO
 * (%)" repetido). Localiza o bloco pela linha de grupo, evitando a ambiguidade de "RECEITA (R$)" se
 * repetir 2x na linha de rótulo sozinha.
 */
function parseCategoriaSheet(sheet: XLSX.WorkSheet | null, canonicalizeNome = false): VDReceitaCategoriaRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];
  const groupRow = rows[0];
  const labelRow = rows[1];
  const dataRows = rows.slice(2);

  const anteriorStart = findColByName(groupRow, 'CICLO ANTERIOR');
  const atualStart = findColByName(groupRow, 'CICLO ATUAL');
  const varStart = findColByName(groupRow, 'VARIAÇÃO', 'VARIACAO');
  const starts = [anteriorStart, atualStart, varStart].filter(i => i >= 0).sort((a, b) => a - b);

  function blockEnd(start: number): number {
    const later = starts.filter(i => i > start);
    return later.length > 0 ? Math.min(...later) : labelRow.length;
  }
  function colInBlock(start: number, hint: string): number {
    if (start < 0) return -1;
    const end = blockEnd(start);
    const target = normalizeCell(hint);
    // Match exato primeiro — "RECEITA (R$)" normaliza para "RECEITAR", que contém "RECEITA" como
    // substring e atropelaria a coluna "RECEITA (%)" (normaliza para "RECEITA" puro) se só
    // fizéssemos substring match.
    for (let i = start; i < end; i++) if (normalizeCell(labelRow[i]) === target) return i;
    for (let i = start; i < end; i++) if (normalizeCell(labelRow[i]).includes(target)) return i;
    return -1;
  }

  const iReceitaAnterior = colInBlock(anteriorStart, 'RECEITA');
  const iPartAnterior = colInBlock(anteriorStart, 'PARTICIPAÇÃO');
  const iReceitaAtual = colInBlock(atualStart, 'RECEITA');
  const iPartAtual = colInBlock(atualStart, 'PARTICIPAÇÃO');
  const iVarPct = colInBlock(varStart, 'RECEITA (%)');

  return dataRows
    .filter(r => String(r[0] ?? '').trim() !== '' && !isTotalRow(String(r[0])))
    .map(r => ({
      nome: canonicalizeNome ? canonicalizeUN(String(r[0]).trim()).label : String(r[0]).trim(),
      receitaAnterior: iReceitaAnterior >= 0 ? toNum(r[iReceitaAnterior]) : 0,
      receitaAtual: iReceitaAtual >= 0 ? toNum(r[iReceitaAtual]) : 0,
      variacaoPct: iVarPct >= 0 ? toPct(r[iVarPct]) : 0,
      participacaoAnteriorPct: iPartAnterior >= 0 ? toPct(r[iPartAnterior]) : 0,
      participacaoAtualPct: iPartAtual >= 0 ? toPct(r[iPartAtual]) : 0,
    } as VDReceitaCategoriaRow))
    .sort((a, b) => b.receitaAtual - a.receitaAtual);
}

export function parseReceitaCategoriaXlsx(workbook: XLSX.WorkBook): VDReceitaCategoriaDataset {
  return {
    categoria: parseCategoriaSheet(findSheet(workbook, 'CATEGORIA')),
    subcategoria: parseCategoriaSheet(findSheet(workbook, 'SUBCATEGORIA')),
    linha: parseCategoriaSheet(findSheet(workbook, 'LINHA')),
    marca: parseCategoriaSheet(findSheet(workbook, 'MARCA'), true),
  };
}

// --- Ruptura ---

export function parseRupturaCausaFranqueadoXlsx(workbook: XLSX.WorkBook): RupturaResumoRow | null {
  const sheet = findSheet(workbook, 'CICLO') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return null;
  const header = rows[0];
  const data = rows[1];
  const iCiclo = findColByName(header, 'CICLO');
  const iRuptura = findColByName(header, '% DE RUPTURA NO CICLO', 'RUPTURA');
  const iMeta = findColByName(header, 'META DE RUPTURA ANUAL', 'META');
  return {
    ciclo: iCiclo >= 0 ? String(data[iCiclo]).trim() : '',
    rupturaTotalPct: null,
    metaRupturaAnual: iMeta >= 0 ? toPctOrNull(data[iMeta]) : null,
    rupturaCausaFranqueadoPct: iRuptura >= 0 ? toPctOrNull(data[iRuptura]) : null,
    rupturaCausaIndustriaPct: null,
  };
}

export function parseRupturaDetalhadaXlsx(workbook: XLSX.WorkBook): RupturaResumoRow | null {
  const sheet = findSheet(workbook, 'CICLO') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return null;
  const header = rows[0];
  const data = rows[1];
  const iCiclo = findColByName(header, 'CICLO');
  const iTotal = findColByName(header, '% RUPTURA TOTAL NO CICLO');
  const iMeta = findColByName(header, 'META');
  const iCF = findColByName(header, '% RUPTURA CF', 'RUPTURA CF');
  const iIndustria = findColByName(header, '% RUPTURA CAUSA INDUSTRIA', 'CAUSA INDUSTRIA');
  return {
    ciclo: iCiclo >= 0 ? String(data[iCiclo]).trim() : '',
    rupturaTotalPct: iTotal >= 0 ? toPctOrNull(data[iTotal]) : null,
    metaRupturaAnual: iMeta >= 0 ? toPctOrNull(data[iMeta]) : null,
    rupturaCausaFranqueadoPct: iCF >= 0 ? toPctOrNull(data[iCF]) : null,
    rupturaCausaIndustriaPct: iIndustria >= 0 ? toPctOrNull(data[iIndustria]) : null,
  };
}

export function parseRupturaPorItemXlsx(workbook: XLSX.WorkBook): RupturaItemRow[] {
  const sheet = findSheet(workbook, 'CICLO') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findColByName(header, 'CICLO');
  const iPdv = findColByName(header, 'PDV');
  const iCanal = findColByName(header, 'CANAL');
  const iSku = findColByName(header, 'SKU');
  const iVolume = findColByName(header, 'VOLUME DE ITENS', 'VOLUME');
  const iCausa = findColByName(header, 'CAUSA RUPTURA', 'CAUSA');
  const iPct = findColByName(header, '% DE RUPTURA', 'RUPTURA');
  return rows.slice(1)
    .filter(r => String(r[iSku] ?? '').trim() !== '')
    .map(r => ({
      ciclo: iCiclo >= 0 ? String(r[iCiclo]).trim() : '',
      pdvCodigo: iPdv >= 0 ? String(r[iPdv]).trim() : '',
      canal: iCanal >= 0 ? String(r[iCanal]).trim() : '',
      sku: String(r[iSku]).trim(),
      volumeItens: iVolume >= 0 ? toNum(r[iVolume]) : 0,
      causaRuptura: iCausa >= 0 ? String(r[iCausa]).trim() : '-',
      rupturaPct: iPct >= 0 ? toPct(r[iPct]) : 0,
    } as RupturaItemRow))
    .sort((a, b) => b.rupturaPct - a.rupturaPct);
}

// --- Base de revendedores ---

export function parseEvolucaoBaseXlsx(workbook: XLSX.WorkBook): EvolucaoBaseRow[] {
  const sheet = findSheet(workbook, 'EVOLUÇÃO DA BASE', 'EVOLUCAO DA BASE') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCiclo = findColByName(header, 'CICLO');
  const iBaseAtiva = findColByName(header, 'BASE ATIVA');
  const iInicios = findColByName(header, 'INICIOS', 'INÍCIOS');
  const iReinicios = findColByName(header, 'REINICIOS', 'REINÍCIOS');
  const iMultimarca = findColByName(header, 'BASE MULTIMARCAS', 'BASE MULTIMARCA');
  const iMultimarcaPct = findColByName(header, '% BASE MULTIMARCAS', '% BASE MULTIMARCA');
  return rows.slice(1)
    .filter(r => String(r[iCiclo] ?? '').trim() !== '')
    .map(r => ({
      ciclo: String(r[iCiclo]).trim(),
      baseAtiva: iBaseAtiva >= 0 ? toNum(r[iBaseAtiva]) : 0,
      inicios: iInicios >= 0 ? toNum(r[iInicios]) : 0,
      reinicios: iReinicios >= 0 ? toNum(r[iReinicios]) : 0,
      baseMultimarca: iMultimarca >= 0 ? toNum(r[iMultimarca]) : 0,
      baseMultimarcaPct: iMultimarcaPct >= 0 ? toPct(r[iMultimarcaPct]) : 0,
    } as EvolucaoBaseRow));
}

function parseMonitoramentoSheet(sheet: XLSX.WorkSheet | null): MonitoramentoBaseRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iChave = 0;
  const iBaseTotal = findColByName(header, 'BASE TOTAL');
  const iBaseAtiva = findColByName(header, 'BASE ATIVA');
  const iAtivosBaseTotal = findColByName(header, 'ATIVOS DA BASE TOTAL');
  const iMultimarca = findColByName(header, 'BASE MULTIMARCA');
  const iRpa = findColByName(header, 'RPA');
  const iInativosI1I3 = findColByName(header, 'INATIVOS I1 A I3', 'INATIVOS I1');
  const iInativosI4I6 = findColByName(header, 'INATIVOS I4 A I6', 'INATIVOS I4');
  const iAtividadePct = findColByName(header, '% ATIVIDADE TOTAL', '% ATIVIDADE');
  const iChurnPct = findColByName(header, '% CHURN');
  const iInicios = findColByName(header, 'INICIOS', 'INÍCIOS');
  const iReinicios = findColByName(header, 'REINICIOS', 'REINÍCIOS');
  const iI6Recuperados = findColByName(header, 'I6 RECUPERADOS');
  const iPerdaBase = findColByName(header, 'PERDA DA BASE');
  return rows.slice(1)
    .filter(r => String(r[iChave] ?? '').trim() !== '')
    .map(r => ({
      chave: String(r[iChave]).trim(),
      baseTotal: iBaseTotal >= 0 ? toNum(r[iBaseTotal]) : 0,
      baseAtiva: iBaseAtiva >= 0 ? toNum(r[iBaseAtiva]) : 0,
      ativosBaseTotal: iAtivosBaseTotal >= 0 ? toNum(r[iAtivosBaseTotal]) : 0,
      baseMultimarca: iMultimarca >= 0 ? toNum(r[iMultimarca]) : 0,
      rpa: iRpa >= 0 ? toNum(r[iRpa]) : 0,
      inativosI1I3: iInativosI1I3 >= 0 ? toNum(r[iInativosI1I3]) : 0,
      inativosI4I6: iInativosI4I6 >= 0 ? toNum(r[iInativosI4I6]) : 0,
      atividadePct: iAtividadePct >= 0 ? toPct(r[iAtividadePct]) : 0,
      churnPct: iChurnPct >= 0 ? toPct(r[iChurnPct]) : 0,
      inicios: iInicios >= 0 ? toNum(r[iInicios]) : 0,
      reinicios: iReinicios >= 0 ? toNum(r[iReinicios]) : 0,
      i6Recuperados: iI6Recuperados >= 0 ? toNum(r[iI6Recuperados]) : 0,
      perdaBase: iPerdaBase >= 0 ? toNum(r[iPerdaBase]) : 0,
    } as MonitoramentoBaseRow));
}

export function parseMonitoramentoBaseXlsx(workbook: XLSX.WorkBook): MonitoramentoBaseDataset {
  return {
    porPdv: parseMonitoramentoSheet(findSheet(workbook, 'MONITORAMENTO POR PDV')),
    porSupervisor: parseMonitoramentoSheet(findSheet(workbook, 'MONITORAMENTO POR SUPERVISOR')),
  };
}

export function parsePenetracaoBaseXlsx(workbook: XLSX.WorkBook): PenetracaoBaseRow[] {
  const sheet = findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iMetrica = 0;
  const iAnterior = findColByName(header, 'PERÍODO ANTERIOR', 'PERIODO ANTERIOR');
  const iPctAnterior = findColByName(header, '% DE PENETRAÇÃO ANTERIOR', 'PENETRAÇÃO ANTERIOR');
  const iAtual = findColByName(header, 'PERÍODO ATUAL', 'PERIODO ATUAL');
  const iPctAtual = findColByName(header, '% DE PENETRAÇÃO ATUAL', 'PENETRAÇÃO ATUAL');
  return rows.slice(1)
    .filter(r => String(r[iMetrica] ?? '').trim() !== '')
    .map(r => ({
      metrica: String(r[iMetrica]).trim(),
      periodoAnterior: iAnterior >= 0 ? toNum(r[iAnterior]) : 0,
      pctPenetracaoAnterior: iPctAnterior >= 0 ? toPct(r[iPctAnterior]) : 0,
      periodoAtual: iAtual >= 0 ? toNum(r[iAtual]) : 0,
      pctPenetracaoAtual: iPctAtual >= 0 ? toPct(r[iPctAtual]) : 0,
    } as PenetracaoBaseRow));
}

/**
 * VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx — 1 linha larga, 32 colunas fixas (ver
 * LEITURA_PLANILHAS_VD.md §4.3 sobre O Boticário/QDB/Eudora/OUI/Make/Cuidados Faciais/FRJ virem
 * misturados no mesmo nível pelo arquivo original). Lido por posição, não por nome, porque o header
 * tem colunas repetidas sem sufixo (dois "" seguidos por grupo qty/pct).
 */
export function parsePenetracaoAtivosDetalhadaXlsx(workbook: XLSX.WorkBook): PenetracaoAtivosDetalhadaRow | null {
  const sheet = findSheet(workbook, 'PENETRAÇÃO DE ATIVOS DETALHADA') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return null;
  const header = rows[1];
  const data = rows[2];
  const n = (i: number) => toNum(data[i]);
  const p = (i: number) => toPct(data[i]);

  const porGrupo: { label: string; ativos: number; pct: number }[] = [];
  for (let i = 18; i + 1 < header.length; i += 2) {
    const rawLabel = String(header[i] ?? '').trim();
    if (!rawLabel) continue;
    // canonicalizeUN só reescreve quando bate com uma marca conhecida (O Boticário/Eudora/OUI/QDB/
    // FRJ) — rótulos de categoria (Make, Cuidados Faciais) passam batido, sem tentar "corrigir".
    porGrupo.push({ label: canonicalizeUN(rawLabel).label, ativos: n(i), pct: p(i + 1) });
  }

  return {
    ciclo: String(data[0] ?? '').trim(),
    cicloAnteriorPct: p(1),
    cicloAtualPct: p(2),
    baseTotal: n(3),
    baseAtiva: n(4),
    ativos: n(5),
    baseTotalMultimarca: n(6),
    baseTotalMultimarcaPct: p(7),
    ativosMultimarca: n(8),
    ativosMultimarcaPct: p(9),
    baseTotalMonomarca: n(10),
    baseTotalMonomarcaPct: p(11),
    ativosMonomarca: n(12),
    ativosMonomarcaPct: p(13),
    baseAtivaMultimarca: n(14),
    baseAtivaMultimarcaPct: p(15),
    baseAtivaMonomarca: n(16),
    baseAtivaMonomarcaPct: p(17),
    porGrupo,
  };
}

/** VendaDireta_Ativas_por_tier.xlsx — I1..I6 são segmento de recência (ver aviso no tipo `AtivasPorTierRow`). */
export function parseAtivasPorTierXlsx(workbook: XLSX.WorkBook): AtivasPorTierRow[] {
  const sheet = findSheet(workbook, 'ATIVAS POR TIER') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];
  // linha0 = grupo ("ATIVAS POR TIER" / "PARTICIPAÇÃO (%)"), linha1 = rótulo (CICLO ANTERIOR/ATUAL x2)
  const dataRows = rows.slice(2);
  return dataRows
    .filter(r => /^I[1-6]$/i.test(String(r[0] ?? '').trim()))
    .map(r => ({
      segmentoRecencia: String(r[0]).trim().toUpperCase(),
      cicloAnterior: toNum(r[1]),
      cicloAtual: toNum(r[2]),
      participacaoAnteriorPct: toPct(r[3]),
      participacaoAtualPct: toPct(r[4]),
    } as AtivasPorTierRow));
}

/** VendaDireta_Segmentacao_da_Base.xlsx — matriz recência (A0, I1-I6) × tier do BI, header mesclado por grupo de 2 colunas (Quantidade/Participação). */
export function parseSegmentacaoBaseXlsx(workbook: XLSX.WorkBook): SegmentacaoBaseDataset | null {
  const sheet = findSheet(workbook, 'SEGMENTAÇÃO DA BASE') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 4) return null;
  const groupRow = rows[1]; // categorias, uma a cada 2 colunas a partir do índice 1
  const dataRows = rows.slice(3);

  const categorias: string[] = [];
  const categoriaColStart: number[] = [];
  for (let i = 1; i < groupRow.length; i += 2) {
    const label = String(groupRow[i] ?? '').trim();
    if (!label) continue;
    categorias.push(label);
    categoriaColStart.push(i);
  }

  const linhas = dataRows
    .filter(r => String(r[0] ?? '').trim() !== '')
    .map(r => {
      const valores: Record<string, { quantidade: number; participacaoPct: number }> = {};
      categorias.forEach((cat, idx) => {
        const col = categoriaColStart[idx];
        valores[cat] = { quantidade: toNum(r[col]), participacaoPct: toPct(r[col + 1]) };
      });
      return { segmento: String(r[0]).trim().toUpperCase(), valores };
    });

  return { categorias, linhas };
}

function parsePenetracaoCategoriaUnSheet(sheet: XLSX.WorkSheet | null, canonicalizeNome = false): PenetracaoCategoriaUnRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iNome = 0;
  const iAnterior = findColByName(header, 'PENETRAÇÃO DE ATIVOS PERÍODO ANTERIOR', 'PERÍODO ANTERIOR');
  const iPctAnterior = findColByName(header, '% DE PENETRAÇÃO ANTERIOR');
  const iAtual = findColByName(header, 'PENETRAÇÃO DE ATIVOS PERÍODO ATUAL', 'PERÍODO ATUAL');
  const iPctAtual = findColByName(header, '% DE PENETRAÇÃO ATUAL');
  return rows.slice(1)
    .filter(r => String(r[iNome] ?? '').trim() !== '')
    .map(r => ({
      nome: canonicalizeNome ? canonicalizeUN(String(r[iNome]).trim()).label : String(r[iNome]).trim(),
      ativosPeriodoAnterior: iAnterior >= 0 ? toNum(r[iAnterior]) : 0,
      pctPenetracaoAnterior: iPctAnterior >= 0 ? toPctOrNull(r[iPctAnterior]) : null,
      ativosPeriodoAtual: iAtual >= 0 ? toNum(r[iAtual]) : 0,
      pctPenetracaoAtual: iPctAtual >= 0 ? toPctOrNull(r[iPctAtual]) : null,
    } as PenetracaoCategoriaUnRow));
}

export function parseDetalhamentoCategoriasUnXlsx(workbook: XLSX.WorkBook): DetalhamentoCategoriasUnDataset {
  return {
    un: parsePenetracaoCategoriaUnSheet(findSheet(workbook, 'UN'), true),
    categoria: parsePenetracaoCategoriaUnSheet(findSheet(workbook, 'CATEGORIA')),
  };
}
