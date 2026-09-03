import * as XLSX from 'xlsx';
import { ReceitaCanalRow, ReceitaCategoriaDataset, ReceitaCategoriaRow, ResumoPerformanceDataset, ResumoPerformanceIndicador, ResumoPerformanceRow } from '../types/loja';
import { toNum, toPct } from './lojaNumberUtils';

function isTotalRow(nome: string): boolean {
  return nome.trim().toUpperCase() === 'TOTAL';
}

/** Linhas de subheader que aparecem intercaladas nos exports (ex. "Tipo de Receita" acima do TOTAL). */
function isSubheaderRow(nome: string): boolean {
  return nome.trim().toUpperCase() === 'TIPO DE RECEITA';
}

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

/**
 * Match exato primeiro, substring como fallback — headers reais vêm como "CANAL/UN",
 * "VARIAÇÃO (%)" (precisa de substring), mas um hint curto como "Loja" pode colidir por
 * substring com colunas não relacionadas (ex. "Quantidade de Serviços em Loja" numa planilha
 * com dezenas de métricas) — nesses casos, a igualdade exata evita o falso positivo.
 */
function findColByName(header: unknown[], ...names: string[]): number {
  const norm = header.map(normalizeCell);
  for (const name of names) {
    const target = normalizeCell(name);
    const idx = norm.indexOf(target);
    if (idx >= 0) return idx;
  }
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
 * Aba CP: NÃO é uma linha por loja — é uma linha por indicador (Receita Total, Quantidade de
 * Boletos, Boleto Médio...), com colunas Meta PEF / Realizado / Vs. Meta PEF / Vs. Ano Passado.
 */
function parseCPIndicators(sheet: XLSX.WorkSheet | null): ResumoPerformanceIndicador[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Indicador');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  const iIndicador = 0;
  const iMetaPEF = findColByName(header, 'Meta PEF');
  const iRealizado = findColByName(header, 'Realizado');
  const iVsMeta = findColByName(header, 'Vs. Meta PEF', 'Vs Meta PEF');
  const iVsAno = findColByName(header, 'Vs. Ano Passado', 'Vs Ano Passado', 'Ano Passado');

  return dataRows
    .filter(r => String(r[iIndicador] ?? '').trim() !== '')
    .map(r => ({
      indicador: String(r[iIndicador] ?? '').trim(),
      metaPEF: iMetaPEF >= 0 ? toNum(r[iMetaPEF]) : null,
      realizado: iRealizado >= 0 ? toNum(r[iRealizado]) : null,
      vsMetaPEFPct: iVsMeta >= 0 ? toPct(r[iVsMeta]) : null,
      vsAnoPassadoPct: iVsAno >= 0 ? toPct(r[iVsAno]) : null,
    } as ResumoPerformanceIndicador));
}

/**
 * Abas PDV/CONSULTOR: uma linha por entidade, com blocos repetidos de métrica
 * (Valor, Vs. Meta PEF, Vs. Período Anterior) — cabeçalho real na 1ª linha, uma linha de
 * subheader "Tipo de Receita" logo abaixo (ignorada), depois TOTAL (ignorada) e as entidades.
 */
function parseEntitySheet(sheet: XLSX.WorkSheet | null): ResumoPerformanceRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Loja', 'Consultor', 'PDV');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);

  const iNomeFound = findColByName(header, 'Loja', 'Consultor', 'Nome', 'PDV');
  const iNome = iNomeFound >= 0 ? iNomeFound : 0;
  const iReceita = findColByName(header, 'Receita', 'GMV', 'Valor Praticado');
  const iBoletos = findColByName(header, 'Quantidade de Boletos', 'Boletos');
  const iTicket = findColByName(header, 'Boleto Médio', 'Ticket Médio', 'Ticket Medio');

  // Blocos "Vs. Meta PEF" / "Vs. Período Anterior" se repetem por métrica — a 1ª ocorrência de
  // cada corresponde ao 1º bloco (Receita), que é o que exibimos.
  const metaIdx: number[] = [];
  const anoIdx: number[] = [];
  header.forEach((h, i) => {
    const u = String(h ?? '').toUpperCase();
    if (u.includes('META')) metaIdx.push(i);
    if (u.includes('ANTERIOR') || u.includes('ANO')) anoIdx.push(i);
  });

  return dataRows
    .filter(r => {
      const nome = String(r[iNome] ?? '').trim();
      return nome !== '' && !isTotalRow(nome) && !isSubheaderRow(nome);
    })
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
  const cp = parseCPIndicators(findSheet(workbook, 'CP'));
  const pdv = parseEntitySheet(findSheet(workbook, 'PDV'));
  const consultor = parseEntitySheet(findSheet(workbook, 'CONSULTOR'));
  return { periodo, cp, pdv, consultor };
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

/**
 * Abas CATEGORIA/SUBCATEGORIA/LINHA/MARCA têm DUAS linhas de header mescladas:
 * linha de grupo  -> ["", "CICLO ANTERIOR", "", "CICLO ATUAL", "", "VARIAÇÃO", "", ""]
 * linha de rótulo -> ["CATEGORIA", "RECEITA (R$)", "PARTICIPAÇÃO (%)", "RECEITA (R$)", ...]
 * A linha de rótulo sozinha é ambígua ("RECEITA (R$)" se repete 2x) — por isso localizamos o
 * início de cada bloco pela linha de grupo e só então procuramos a métrica dentro do bloco.
 * A variação % é sempre recalculada a partir de atual/anterior (evita a ambiguidade entre as
 * colunas "Receita (R$)" e "Receita (%)" dentro do próprio bloco Variação).
 */
function parseReceitaRows(sheet: XLSX.WorkSheet | null): ReceitaCategoriaRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];
  const groupRowIdx = findHeaderRowIndex(rows, 'Ciclo Atual', 'Ciclo Anterior');
  const groupRow = rows[groupRowIdx];
  const labelRow = rows[groupRowIdx + 1] ?? [];
  const dataRows = rows.slice(groupRowIdx + 2);

  const anteriorStart = findColByName(groupRow, 'Ciclo Anterior');
  const atualStart = findColByName(groupRow, 'Ciclo Atual');
  const variacaoStart = findColByName(groupRow, 'Variação', 'Variacao');

  function colInBlock(blockStart: number, hint: string): number {
    if (blockStart < 0) return -1;
    const laterBlocks = [anteriorStart, atualStart, variacaoStart].filter(i => i > blockStart).sort((a, b) => a - b);
    const blockEnd = laterBlocks.length > 0 ? laterBlocks[0] : labelRow.length;
    const target = normalizeCell(hint);
    for (let i = blockStart; i < blockEnd; i++) {
      if (normalizeCell(labelRow[i]).includes(target)) return i;
    }
    return -1;
  }

  const iNome = 0;
  const iAnteriorFound = colInBlock(anteriorStart, 'Receita');
  const iAnterior = iAnteriorFound >= 0 ? iAnteriorFound : anteriorStart;
  const iAtualFound = colInBlock(atualStart, 'Receita');
  const iAtual = iAtualFound >= 0 ? iAtualFound : atualStart;
  const iPart = colInBlock(atualStart, 'Participação');

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
        variacaoPct: receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0,
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
