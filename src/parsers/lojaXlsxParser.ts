import * as XLSX from 'xlsx';
import { ReceitaCanalRow, ReceitaCategoriaDataset, ReceitaCategoriaRow, ResumoPerformanceDataset, ResumoPerformanceRow } from '../types/loja';
import { toNum, toPct } from './lojaNumberUtils';

function findSheet(workbook: XLSX.WorkBook, ...nameHints: string[]): XLSX.WorkSheet | null {
  const upperNames = workbook.SheetNames.map(n => n.toUpperCase());
  for (const hint of nameHints) {
    const idx = upperNames.findIndex(n => n.includes(hint.toUpperCase()));
    if (idx >= 0) return workbook.Sheets[workbook.SheetNames[idx]];
  }
  return null;
}

/** Lê uma aba em modo posicional (array de arrays), útil quando headers se repetem. */
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
}

function findColByName(header: unknown[], ...names: string[]): number {
  const norm = header.map(h => String(h ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  for (const name of names) {
    const target = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const idx = norm.indexOf(target);
    if (idx >= 0) return idx;
  }
  return -1;
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
  const header = rows[0];

  const iNomeFound = findColByName(header, 'Loja', 'Consultor', 'Nome', 'PDV');
  const iNome = iNomeFound >= 0 ? iNomeFound : 0;
  const iReceita = findColByName(header, 'Receita', 'GMV', 'Valor Praticado');
  const iBoletos = findColByName(header, 'Boletos', 'Qtd Boletos');
  const iTicket = findColByName(header, 'Ticket Médio', 'Ticket Medio');

  // Blocos "Vs. Meta PEF" / "Vs. Período Anterior" podem se repetir — pega a 1ª e a 2ª ocorrência de cada.
  const metaIdx: number[] = [];
  const anoIdx: number[] = [];
  header.forEach((h, i) => {
    const u = String(h ?? '').toUpperCase();
    if (u.includes('META')) metaIdx.push(i);
    if (u.includes('ANTERIOR') || u.includes('ANO')) anoIdx.push(i);
  });

  return rows.slice(1)
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

export function parseReceitaCanalXlsx(workbook: XLSX.WorkBook): ReceitaCanalRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCanal = findColByName(header, 'Canal', 'UN', 'Unidade de Negócio');
  if (iCanal < 0) {
    throw new Error('coluna de Canal/UN não encontrada em Receita_por_Canal_UN.xlsx');
  }
  const iAtual = findColByName(header, 'Ciclo Atual', 'Receita Atual', 'Atual');
  const iAnterior = findColByName(header, 'Ciclo Anterior', 'Receita Anterior', 'Anterior');
  const iVar = findColByName(header, 'Variação', 'Variacao', 'Var%', 'Var %');
  const iPart = findColByName(header, 'Participação', 'Participacao', '%');

  const list = rows.slice(1)
    .filter(r => String(r[iCanal] ?? '').trim() !== '')
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
  const header = rows[0];
  const iNome = 0;
  const iAtual = findColByName(header, 'Ciclo Atual', 'Receita Atual', 'Atual');
  const iAnterior = findColByName(header, 'Ciclo Anterior', 'Receita Anterior', 'Anterior');
  const iVar = findColByName(header, 'Variação', 'Variacao', 'Var%', 'Var %');
  const iPart = findColByName(header, 'Participação', 'Participacao', '%');

  return rows.slice(1)
    .filter(r => String(r[iNome] ?? '').trim() !== '')
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
