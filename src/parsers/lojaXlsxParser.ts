import * as XLSX from 'xlsx';
import { ReceitaCanalRow, ReceitaCategoriaDataset, ReceitaCategoriaRow, ResumoPerformanceDataset, ResumoPerformanceRow } from '../types/loja';
import { toNum, toPct } from './lojaNumberUtils';

function findSheet(workbook: XLSX.WorkBook, ...nameHints: string[]): XLSX.WorkSheet | null {
  const upperNames = workbook.SheetNames.map(n => n.toUpperCase());
  // Match exato primeiro — evita, por ex., 'CATEGORIA' casar com a aba 'SUBCATEGORIA' por substring.
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

/** Primeira aba que não seja a de metadados (FILTROS) — fallback quando não há um nome de aba mais específico pra tentar. */
function findFirstDataSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const idx = workbook.SheetNames.findIndex(n => n.toUpperCase() !== 'FILTROS');
  return workbook.Sheets[workbook.SheetNames[idx >= 0 ? idx : 0]];
}

/** Lê uma aba em modo posicional (array de arrays), útil quando headers se repetem. */
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
}

function normalizeCell(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Match por substring (não igualdade exata) — headers reais vêm como "CANAL/UN", "VARIAÇÃO (%)" etc. */
function findColByName(header: unknown[], ...names: string[]): number {
  const norm = header.map(normalizeCell);
  for (const name of names) {
    const target = normalizeCell(name);
    const idx = norm.findIndex(h => h.includes(target));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Muitos exports desse sistema têm uma linha de título mesclada acima do header de verdade
 * (ex. `["", "RECEITA (R$)", "", "-"]` antes de `["CANAL/UN", "CICLO ANTERIOR", ...]`).
 * Procura nas primeiras linhas qual delas contém algum dos termos esperados.
 */
function findHeaderRowIndex(rows: unknown[][], ...mustContainAny: string[]): number {
  const targets = mustContainAny.map(normalizeCell);
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const norm = rows[i].map(normalizeCell);
    if (targets.some(t => norm.some(h => h.includes(t)))) return i;
  }
  return 0;
}

function readPeriodoFromFiltros(workbook: XLSX.WorkBook): string | null {
  const sheet = findSheet(workbook, 'FILTROS');
  if (!sheet) return null;
  const rows = sheetToRows(sheet);
  const flat = rows.map(r => r.map(c => String(c ?? '').trim()).filter(Boolean)).flat();
  return flat.length > 0 ? flat.join(' · ') : null;
}

/**
 * Aba CP/PDV/CONSULTOR do Resumo_de_Performance_Indicadores_Loja: cabeçalhos repetidos
 * ("Vs. Meta PEF", "Vs. Período Anterior" aparecem várias vezes para métricas diferentes),
 * então não dá pra selecionar por nome com segurança — lemos em modo posicional e localizamos
 * o bloco de "Receita" pela primeira coluna numérica após o nome, e os dois blocos de variação
 * seguintes por posição relativa (padrão observado no export: Nome, Receita, [Boletos, Ticket
 * Médio], Vs. Meta PEF, Vs. Período Anterior).
 */
function parseIndicatorSheet(sheet: XLSX.WorkSheet | null): ResumoPerformanceRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Loja', 'Consultor', 'PDV', 'Receita');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  const iNomeFound = findColByName(header, 'Loja', 'Consultor', 'Nome', 'PDV');
  const iNome = iNomeFound >= 0 ? iNomeFound : 0;
  const iReceita = findColByName(header, 'Receita', 'GMV', 'Valor Praticado');
  const iBoletos = findColByName(header, 'Boletos', 'Qtd Boletos');
  const iTicket = findColByName(header, 'Ticket Médio', 'Ticket Medio');

  // Blocos "Vs. Meta PEF" / "Vs. Período Anterior" podem se repetir — pega a 1ª ocorrência de cada.
  const metaIdx: number[] = [];
  const anoIdx: number[] = [];
  header.forEach((h, i) => {
    const u = String(h ?? '').toUpperCase();
    if (u.includes('META')) metaIdx.push(i);
    if (u.includes('ANTERIOR') || u.includes('ANO')) anoIdx.push(i);
  });

  return dataRows
    .filter(r => String(r[iNome] ?? '').trim() !== '')
    .map(r => ({
      nome: String(r[iNome] ?? '').trim(),
      receita: iReceita >= 0 ? toNum(r[iReceita]) : 0,
      boletos: iBoletos >= 0 ? toNum(r[iBoletos]) : null,
      ticketMedio: iTicket >= 0 ? toNum(r[iTicket]) : null,
      vsMetaPEFPct: metaIdx.length > 0 ? toPct(r[metaIdx[0]]) : null,
      vsAnoAnteriorPct: anoIdx.length > 0 ? toPct(r[anoIdx[0]]) : null,
    } as ResumoPerformanceRow));
}

export function parseResumoPerformanceXlsx(workbook: XLSX.WorkBook): ResumoPerformanceDataset {
  const periodo = readPeriodoFromFiltros(workbook);
  const cp = parseIndicatorSheet(findSheet(workbook, 'CP'));
  const pdv = parseIndicatorSheet(findSheet(workbook, 'PDV'));
  const consultor = parseIndicatorSheet(findSheet(workbook, 'CONSULTOR'));
  return { periodo, cp, pdv, consultor };
}

function isTotalRow(nome: string): boolean {
  return nome.trim().toUpperCase() === 'TOTAL';
}

export function parseReceitaCanalXlsx(workbook: XLSX.WorkBook): ReceitaCanalRow[] {
  const sheet = findSheet(workbook, 'RECEITA POR CANAL', 'CANAL') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Canal', 'UN', 'Unidade de Negócio');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  const iCanal = findColByName(header, 'Canal', 'UN', 'Unidade de Negócio');
  if (iCanal < 0) {
    throw new Error('coluna de Canal/UN não encontrada em Receita_por_Canal_UN.xlsx');
  }
  const iAtual = findColByName(header, 'Ciclo Atual', 'Receita Atual', 'Atual');
  const iAnterior = findColByName(header, 'Ciclo Anterior', 'Receita Anterior', 'Anterior');
  const iVar = findColByName(header, 'Variação', 'Variacao', 'Var%', 'Var %');
  const iPart = findColByName(header, 'Participação', 'Participacao', '%');

  const list = dataRows
    .filter(r => {
      const nome = String(r[iCanal] ?? '').trim();
      return nome !== '' && !isTotalRow(nome);
    })
    .map(r => {
      const receitaAtual = iAtual >= 0 ? toNum(r[iAtual]) : 0;
      const receitaAnterior = iAnterior >= 0 ? toNum(r[iAnterior]) : 0;
      return {
        canal: String(r[iCanal] ?? '').trim(),
        receitaAtual,
        receitaAnterior,
        variacaoPct: iVar >= 0 ? toPct(r[iVar]) : (receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0),
        participacaoPct: iPart >= 0 ? toPct(r[iPart]) : 0,
      } as ReceitaCanalRow;
    });

  if (list.every(r => r.participacaoPct === 0)) {
    const total = list.reduce((s, r) => s + r.receitaAtual, 0);
    for (const r of list) r.participacaoPct = total > 0 ? (r.receitaAtual / total) * 100 : 0;
  }
  return list.sort((a, b) => b.receitaAtual - a.receitaAtual);
}

function parseReceitaRows(sheet: XLSX.WorkSheet | null): ReceitaCategoriaRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Ciclo Atual', 'Ciclo Anterior', 'Variação', 'Participação');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  const iNome = 0;
  const iAtual = findColByName(header, 'Ciclo Atual', 'Receita Atual', 'Atual');
  const iAnterior = findColByName(header, 'Ciclo Anterior', 'Receita Anterior', 'Anterior');
  const iVar = findColByName(header, 'Variação', 'Variacao', 'Var%', 'Var %');
  const iPart = findColByName(header, 'Participação', 'Participacao', '%');

  return dataRows
    .filter(r => {
      const nome = String(r[iNome] ?? '').trim();
      return nome !== '' && !isTotalRow(nome);
    })
    .map(r => {
      const receitaAtual = iAtual >= 0 ? toNum(r[iAtual]) : 0;
      const receitaAnterior = iAnterior >= 0 ? toNum(r[iAnterior]) : 0;
      return {
        nome: String(r[iNome] ?? '').trim(),
        receitaAtual,
        receitaAnterior,
        variacaoPct: iVar >= 0 ? toPct(r[iVar]) : (receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0),
        participacaoPct: iPart >= 0 ? toPct(r[iPart]) : 0,
      } as ReceitaCategoriaRow;
    })
    .sort((a, b) => b.receitaAtual - a.receitaAtual);
}

export function parseReceitaCategoriaXlsx(workbook: XLSX.WorkBook): ReceitaCategoriaDataset {
  return {
    categoria: parseReceitaRows(findSheet(workbook, 'CATEGORIA')),
    subcategoria: parseReceitaRows(findSheet(workbook, 'SUBCATEGORIA')),
    linha: parseReceitaRows(findSheet(workbook, 'LINHA')),
    marca: parseReceitaRows(findSheet(workbook, 'MARCA')),
  };
}
