import * as XLSX from 'xlsx';
import {
  ReceitaCanalRow, ReceitaCategoriaDataset, ReceitaCategoriaRow, ResumoPerformanceDataset, ResumoPerformanceIndicador, ResumoPerformanceRow,
  ServicosDataset, ServicoPdvRow, ServicoConsultorRow, FidelidadeDataset, FidelidadeRow, LojaDigitalDataset, LojaDigitalRow,
  CuidadosFaciaisDataset, CuidadosFaciaisRow, LogisticaAdesaoResumoRow, LogisticaAdesaoDetalheRow,
  ReceitaCanalLojaBlock, ReceitaCanalLojaPdvRow, ReceitaCanalLojaUnDataset, ReceitaCanalLojaPeriodoRow,
} from '../types/loja';
import { toNum, toPct } from './lojaNumberUtils';

/** Como toPct, mas devolve `null` para célula "-"/"--"/vazia em vez de 0 — nas abas PDV/CONSULTOR
 * do Resumo de Performance, "-" significa "sem meta/comparativo aplicável para esse indicador",
 * não "0% de variação"; tratar como 0 faria o indicador parecer "na meta" indevidamente. */
function toPctOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (s === '' || s === '-' || s === '--') return null;
  return toPct(v);
}

/** Como toNum, mas devolve `null` para célula "-"/"--"/vazia em vez de 0 — mesma razão de toPctOrNull. */
function toNumOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (s === '' || s === '-' || s === '--') return null;
  return toNum(v);
}

/**
 * Normaliza o rótulo de "Tipo de Receita" declarado pela planilha (varia entre abas: a CP usa
 * abreviações como "GMV"/"Líquida"/"RBV", a PDV/CONSULTOR usa por extenso "Receita GMV"/"Receita
 * Líquida"/"Receita Bruta Varejo") pro mesmo rótulo curto em todo o app. "N/A"/"--"/vazio (o
 * indicador não é uma métrica de receita, ex. contagens) vira `null`.
 */
function normalizeTipoReceita(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (s === '' || s === '-' || s === '--' || s.toUpperCase() === 'N/A') return null;
  const u = s.toUpperCase();
  // "GMV + Omni" precisa ficar distinto de "GMV" puro — o Omni soma o canal Clique e Retire por
  // cima do GMV físico (confirmado no ReceitaCanalLoja_*), não é a mesma base só com nome diferente.
  if (u.includes('OMNI')) return 'GMV + Omni';
  if (u.includes('GMV')) return 'GMV';
  if (u.includes('LÍQUIDA') || u.includes('LIQUIDA')) return 'Receita Líquida';
  if (u.includes('BRUTA VAREJO') || u === 'RBV') return 'Receita Bruta Varejo';
  if (u.includes('BRUTA')) return 'Receita Bruta';
  return s;
}

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
 * Lê a linha "TIPO DE RECEITA" da aba FILTROS de qualquer xlsx opcional do Modo Loja — todos os
 * exports desse sistema de origem trazem essa aba com esse filtro, declarando a base sobre a qual
 * os números do arquivo foram calculados (GMV, Receita Líquida, Receita Bruta...). `null` quando a
 * aba não existe, a linha não está lá, ou o valor está em branco (arquivos que não são sobre
 * receita, como os de Gestão de Pedidos, deixam em branco).
 */
export function readTipoReceitaFromFiltros(workbook: XLSX.WorkBook): string | null {
  const sheet = findSheet(workbook, 'FILTROS');
  if (!sheet) return null;
  const rows = sheetToRows(sheet);
  const row = rows.find(r => normalizeCell(r[0]) === 'TIPODERECEITA');
  return row ? normalizeTipoReceita(row[1]) : null;
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
  const iTipoReceita = findColByName(header, 'Tipo de Receita');
  const iMetaPEF = findColByName(header, 'Meta PEF');
  const iRealizado = findColByName(header, 'Realizado');
  const iVsMeta = findColByName(header, 'Vs. Meta PEF', 'Vs Meta PEF');
  const iVsAno = findColByName(header, 'Vs. Ano Passado', 'Vs Ano Passado', 'Ano Passado');

  return dataRows
    .filter(r => String(r[iIndicador] ?? '').trim() !== '')
    .map(r => ({
      indicador: String(r[iIndicador] ?? '').trim(),
      tipoReceita: iTipoReceita >= 0 ? normalizeTipoReceita(r[iTipoReceita]) : null,
      metaPEF: iMetaPEF >= 0 ? toNumOrNull(r[iMetaPEF]) : null,
      realizado: iRealizado >= 0 ? toNumOrNull(r[iRealizado]) : null,
      vsMetaPEFPct: iVsMeta >= 0 ? toPctOrNull(r[iVsMeta]) : null,
      vsAnoPassadoPct: iVsAno >= 0 ? toPctOrNull(r[iVsAno]) : null,
    } as ResumoPerformanceIndicador));
}

function isVsMetaHeaderCell(h: unknown): boolean {
  return normalizeCell(h).includes('META');
}

function isVsAnteriorHeaderCell(h: unknown): boolean {
  const n = normalizeCell(h);
  return n.includes('ANTERIOR') || n.includes('ANO');
}

/**
 * Varre o header a partir de `startCol` reconstruindo cada bloco de métrica (nome + até 2 colunas
 * "Vs." que vêm logo depois dele). A aba PDV tem Meta PEF + Período Anterior por métrica; a aba
 * CONSULTOR só tem Período Anterior — por isso a lógica não assume um tamanho fixo de bloco, só
 * consome "Vs. Meta PEF"/"Vs. Período Anterior" se a próxima coluna for de fato uma delas.
 */
function walkMetricBlocks(header: unknown[], startCol: number): { name: string; valorCol: number; metaCol: number; anteriorCol: number }[] {
  const blocks: { name: string; valorCol: number; metaCol: number; anteriorCol: number }[] = [];
  let i = startCol;
  while (i < header.length) {
    const label = String(header[i] ?? '').trim();
    if (label === '' || isVsMetaHeaderCell(header[i]) || isVsAnteriorHeaderCell(header[i])) {
      i++;
      continue;
    }
    const valorCol = i;
    let metaCol = -1, anteriorCol = -1;
    let j = i + 1;
    if (j < header.length && isVsMetaHeaderCell(header[j])) { metaCol = j; j++; }
    if (j < header.length && isVsAnteriorHeaderCell(header[j])) { anteriorCol = j; j++; }
    blocks.push({ name: label, valorCol, metaCol, anteriorCol });
    i = j;
  }
  return blocks;
}

/**
 * Abas PDV/CONSULTOR: uma linha por entidade, com blocos repetidos de métrica
 * (Valor, Vs. Meta PEF, Vs. Período Anterior) — cabeçalho real na 1ª linha, uma linha de
 * subheader "Tipo de Receita" logo abaixo (ignorada), depois TOTAL (ignorada) e as entidades.
 * `hasPdvCol` pula a coluna extra de PDV que a aba CONSULTOR tem entre o nome e o 1º bloco de
 * métrica (a aba PDV não tem essa coluna — a própria linha já é o PDV).
 */
function parseEntitySheet(sheet: XLSX.WorkSheet | null, hasPdvCol: boolean): ResumoPerformanceRow[] {
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
  // cada corresponde ao 1º bloco (Receita), que é o que exibimos nos campos dedicados abaixo.
  const metaIdx: number[] = [];
  const anoIdx: number[] = [];
  header.forEach((h, i) => {
    const u = String(h ?? '').toUpperCase();
    if (u.includes('META')) metaIdx.push(i);
    if (u.includes('ANTERIOR') || u.includes('ANO')) anoIdx.push(i);
  });

  const metricBlocksStart = hasPdvCol ? iNome + 2 : iNome + 1;
  const metricBlocks = walkMetricBlocks(header, metricBlocksStart);
  // Linha logo abaixo do header (rows[headerIdx+1]) declara a base de receita ("Receita GMV" /
  // "Receita Líquida" / "Receita Bruta Varejo" / "N/A") de cada bloco de métrica — é filtrada de
  // `dataRows` por `isSubheaderRow`, então precisa ser lida à parte, direto de `rows`.
  const tipoReceitaRow = rows[headerIdx + 1] ?? [];

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
      vsMetaPEFPct: metaIdx.length > 0 ? toPctOrNull(r[metaIdx[0]]) : null,
      vsAnoAnteriorPct: anoIdx.length > 0 ? toPctOrNull(r[anoIdx[0]]) : null,
      metricas: metricBlocks.map(b => ({
        metrica: b.name,
        valor: toNumOrNull(r[b.valorCol]),
        vsMetaPEFPct: b.metaCol >= 0 ? toPctOrNull(r[b.metaCol]) : null,
        vsAnoAnteriorPct: b.anteriorCol >= 0 ? toPctOrNull(r[b.anteriorCol]) : null,
        tipoReceita: normalizeTipoReceita(tipoReceitaRow[b.valorCol]),
      })),
    } as ResumoPerformanceRow));
}

export function parseResumoPerformanceXlsx(workbook: XLSX.WorkBook): ResumoPerformanceDataset {
  const periodo = readPeriodoFromFiltros(workbook);
  const cp = parseCPIndicators(findSheet(workbook, 'CP'));
  const pdv = parseEntitySheet(findSheet(workbook, 'PDV'), false);
  const consultor = parseEntitySheet(findSheet(workbook, 'CONSULTOR'), true);
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

// --- Servicos_em_loja.xlsx ---

function parseServicosPdv(sheet: XLSX.WorkSheet | null): ServicoPdvRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iPdv = findColByName(header, 'PDV');
  const iHabilitador = findColByName(header, 'HABILITADOR');
  const iUn = findColByName(header, 'UN');
  const iRealizados = findColByName(header, 'QT. SERVICOS REALIZADOS', 'SERVICOS REALIZADOS');
  const iIncompletos = findColByName(header, 'QT. SERVICOS INCOMPLETO', 'SERVICOS INCOMPLETO');
  const iCompletos = findColByName(header, 'QT. SERVICOS COMPLETOS', 'SERVICOS COMPLETOS');
  const iMeta = findColByName(header, 'QT. META');
  const iAtingimento = findColByName(header, 'ATINGIMENTO');
  const iGmv = findColByName(header, 'GMV');

  return rows.slice(1)
    .filter(r => String(r[iPdv] ?? '').trim() !== '')
    .map(r => ({
      pdvCodigo: String(r[iPdv] ?? '').trim(),
      habilitador: iHabilitador >= 0 ? String(r[iHabilitador] ?? '').trim() : '',
      un: iUn >= 0 ? String(r[iUn] ?? '').trim() : '',
      qtdRealizados: toNum(r[iRealizados]),
      qtdIncompletos: toNum(r[iIncompletos]),
      qtdCompletos: toNum(r[iCompletos]),
      qtdMeta: toNum(r[iMeta]),
      atingimentoPct: toPct(r[iAtingimento]),
      gmv: toNum(r[iGmv]),
    } as ServicoPdvRow));
}

function parseServicosConsultor(sheet: XLSX.WorkSheet | null): ServicoConsultorRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iConsultor = findColByName(header, 'CONSULTOR');
  const iPdv = findColByName(header, 'PDV');
  const iServico = findColByName(header, 'SERVICO', 'SERVIÇO');
  const iRealizados = findColByName(header, 'QT. SERVICOS REALIZADOS', 'SERVICOS REALIZADOS');
  const iSemCheckIn = findColByName(header, 'QT. SERVICOS SEM CHECK IN', 'SEM CHECK IN');
  const iCompletos = findColByName(header, 'QT. SERVICOS COMPLETOS', 'SERVICOS COMPLETOS');
  const iGmv = findColByName(header, 'GMV');

  return rows.slice(1)
    .filter(r => String(r[iConsultor] ?? '').trim() !== '')
    .map(r => ({
      consultor: String(r[iConsultor] ?? '').trim(),
      pdvCodigo: iPdv >= 0 ? String(r[iPdv] ?? '').trim() : '',
      servico: iServico >= 0 ? String(r[iServico] ?? '').trim() : '',
      qtdRealizados: toNum(r[iRealizados]),
      qtdSemCheckIn: toNum(r[iSemCheckIn]),
      qtdCompletos: toNum(r[iCompletos]),
      gmv: toNum(r[iGmv]),
    } as ServicoConsultorRow));
}

export function parseServicosXlsx(workbook: XLSX.WorkBook): ServicosDataset {
  return {
    pdv: parseServicosPdv(findSheet(workbook, 'PDV')),
    consultor: parseServicosConsultor(findSheet(workbook, 'CONSULTANT', 'CONSULTOR')),
  };
}

// --- ProgramaFidelidade_..._boleto_Fidelidade.xlsx ---

function parseFidelidadeRows(sheet: XLSX.WorkSheet | null): FidelidadeRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iNome = 0;
  const iDesafio = findColByName(header, 'Qnt de boleto com desafios concluídos', 'Desafios Concluídos');
  const iBoletos = findColByName(header, 'Qnt de boletos Fidelidade');
  const iPenetracao = findColByName(header, '% Penetração Desafio Fidelidade', 'Penetração Desafio Fidelidade');

  return rows.slice(1)
    .filter(r => String(r[iNome] ?? '').trim() !== '')
    .map(r => ({
      nome: String(r[iNome] ?? '').trim(),
      qtdBoletosDesafio: toNum(r[iDesafio]),
      qtdBoletosFidelidade: toNum(r[iBoletos]),
      penetracaoPct: toPct(r[iPenetracao]),
    } as FidelidadeRow));
}

export function parseFidelidadeXlsx(workbook: XLSX.WorkBook): FidelidadeDataset {
  return {
    cp: parseFidelidadeRows(findSheet(workbook, 'CP')),
    pdv: parseFidelidadeRows(findSheet(workbook, 'PDV')),
    consultor: parseFidelidadeRows(findSheet(workbook, 'CONSULTOR')),
  };
}

// --- LojaDigital_Performance_por_Pdv_Consultor.xlsx ---
// Aba PDV traz "Clientes Encaminhados" (não existe na aba Consultor(a), que só existe a partir do
// atendimento). Aba Consultor(a) traz uma coluna PDV extra (o consultor pode atender + de uma loja).
function parseLojaDigitalRows(sheet: XLSX.WorkSheet | null, hasPdvCol: boolean, hasEncaminhados: boolean): LojaDigitalRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iNome = 0;
  const iPdv = hasPdvCol ? findColByName(header, 'PDV') : -1;
  const iEncaminhados = hasEncaminhados ? findColByName(header, 'CLIENTES ENCAMINHADOS') : -1;
  const iAtendidos = findColByName(header, 'CLIENTES ATENDIDOS');
  const iTme = findColByName(header, 'TME AJUSTADO', 'TME');
  const iConvertidos = findColByName(header, 'CLIENTES CONVERTIDOS');
  const iConversao = findColByName(header, '% CONVERSÃO', 'CONVERSÃO');
  const iReceita = findColByName(header, 'RECEITA (R$)', 'RECEITA');
  const iBoletoMedio = findColByName(header, 'BOLETO MEDIO (R$)', 'BOLETO MEDIO');

  return rows.slice(1)
    .filter(r => {
      const nome = String(r[iNome] ?? '').trim();
      return nome !== '' && nome.toUpperCase() !== 'TODOS';
    })
    .map(r => ({
      nome: String(r[iNome] ?? '').trim(),
      pdvCodigo: iPdv >= 0 ? (String(r[iPdv] ?? '').trim() || null) : String(r[iNome] ?? '').trim(),
      clientesEncaminhados: iEncaminhados >= 0 ? toNum(r[iEncaminhados]) : null,
      clientesAtendidos: toNum(r[iAtendidos]),
      tmeAjustado: iTme >= 0 ? String(r[iTme] ?? '').trim() : '',
      clientesConvertidos: toNum(r[iConvertidos]),
      conversaoPct: toPct(r[iConversao]),
      receita: toNum(r[iReceita]),
      boletoMedio: toNum(r[iBoletoMedio]),
    } as LojaDigitalRow));
}

export function parseLojaDigitalXlsx(workbook: XLSX.WorkBook): LojaDigitalDataset {
  return {
    pdv: parseLojaDigitalRows(findSheet(workbook, 'PDV'), false, true),
    consultor: parseLojaDigitalRows(findSheet(workbook, 'CONSULTOR'), true, false),
  };
}

// --- Loja_cuidados_faciais_iaf.xlsx ---
// Receita de Cuidados Faciais + Botik dentro do GMV total, quebrada por PDV/consultor. As abas
// PDV/CONSULTOR trazem blocos TOTAL / BOTIK / DEMAIS MARCAS lado a lado (grupo mesclado na linha
// acima do header real); as duas primeiras linhas de dado ("RECEITA TOTAL" e "RECEITA CUIDADOS
// FACIAIS + BOTIK") são agregados de rede, não entidades — distinguidas por não terem código
// numérico de PDV.
function isAggregateLabel(nome: string): boolean {
  const u = nome.trim().toUpperCase();
  return u === '' || u === 'TOTAL' || u === 'RECEITA TOTAL' || u === 'RECEITA CUIDADOS FACIAIS + BOTIK';
}

function parseCuidadosFaciaisEntitySheet(sheet: XLSX.WorkSheet | null, hasPdvCol: boolean): CuidadosFaciaisRow[] {
  if (!sheet) return [];
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return [];
  const groupRowIdx = findHeaderRowIndex(rows, 'TOTAL', 'BOTIK');
  const groupRow = rows[groupRowIdx];
  const dataRows = rows.slice(groupRowIdx + 2); // pula linha de grupo + linha de rótulo

  const iNome = 0;
  const iPdv = hasPdvCol ? 1 : -1;
  const totalCol = findColByName(groupRow, 'TOTAL');
  const botikCol = findColByName(groupRow, 'BOTIK');
  const demaisCol = findColByName(groupRow, 'DEMAIS MARCAS');

  return dataRows
    .filter(r => !isAggregateLabel(String(r[iNome] ?? '')))
    .map(r => ({
      nome: String(r[iNome] ?? '').trim(),
      pdvCodigo: iPdv >= 0 ? (String(r[iPdv] ?? '').trim() || null) : String(r[iNome] ?? '').trim(),
      receitaTotal: totalCol >= 0 ? toNum(r[totalCol]) : 0,
      receitaBotik: botikCol >= 0 ? toNum(r[botikCol]) : 0,
      receitaDemaisMarcas: demaisCol >= 0 ? toNum(r[demaisCol]) : 0,
    } as CuidadosFaciaisRow));
}

function parseCuidadosFaciaisParticipacao(sheet: XLSX.WorkSheet | null): number | null {
  if (!sheet) return null;
  const rows = sheetToRows(sheet);
  if (rows.length < 3) return null;
  const headerIdx = findHeaderRowIndex(rows, 'INDICADORES');
  const dataRows = rows.slice(headerIdx + 1);
  const row = dataRows.find(r => String(r[0] ?? '').trim().toUpperCase() === 'RECEITA CUIDADOS FACIAIS + BOTIK' && String(r[1] ?? '').trim() === '');
  return row ? toPct(row[2]) : null;
}

export function parseCuidadosFaciaisXlsx(workbook: XLSX.WorkBook): CuidadosFaciaisDataset {
  return {
    participacaoPct: parseCuidadosFaciaisParticipacao(findSheet(workbook, 'CP')),
    pdv: parseCuidadosFaciaisEntitySheet(findSheet(workbook, 'PDV'), false),
    consultor: parseCuidadosFaciaisEntitySheet(findSheet(workbook, 'CONSULTOR'), true),
  };
}

// --- GestaoPedidos_usage-by-usage-category-adherence.xlsx — resumo de adesão à logística ---

export function parseLogisticaAdesaoResumoXlsx(workbook: XLSX.WorkBook): LogisticaAdesaoResumoRow[] {
  const sheet = findSheet(workbook, 'CATEGORIA DE USO') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCategoria = findColByName(header, 'CATEGORIA');
  const iQtd = findColByName(header, 'QUANTIDADE DE PEDIDOS', 'QUANTIDADE');
  const iPct = findColByName(header, 'PERCENTUAL DE PEDIDOS', 'PERCENTUAL');

  return rows.slice(1)
    .filter(r => String(r[iCategoria] ?? '').trim() !== '')
    .map(r => ({
      categoria: String(r[iCategoria] ?? '').trim(),
      qtdPedidos: toNum(r[iQtd]),
      percentualPedidosPct: toPct(r[iPct]),
    } as LogisticaAdesaoResumoRow));
}

// --- GestaoPedidos_Visão_detalhada_da_utilização_por_pedido.xlsx — detalhe pedido a pedido ---

export function parseLogisticaAdesaoDetalheXlsx(workbook: XLSX.WorkBook): LogisticaAdesaoDetalheRow[] {
  const sheet = findSheet(workbook, 'PLATAFORMA') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 2) return [];
  const header = rows[0];
  const iCodigo = findColByName(header, 'CÓDIGO DO PEDIDO', 'CODIGO DO PEDIDO');
  const iPdv = findColByName(header, 'PDV');
  const iCategoria = findColByName(header, 'CATEGORIA DE ADESÃO', 'CATEGORIA DE ADESAO');
  const iStatusPrazo = findColByName(header, 'STATUS DO PRAZO');
  const iCidadeOrigem = findColByName(header, 'CIDADE ORIGEM');
  const iUfOrigem = findColByName(header, 'UF ORIGEM');
  const iCidadeDestino = findColByName(header, 'CIDADE DESTINO');
  const iUfDestino = findColByName(header, 'UF DESTINO');
  const iStatusPedido = findColByName(header, 'STATUS DO PEDIDO');
  const iDataAprovacao = findColByName(header, 'DATA DE APROVAÇÃO', 'DATA DE APROVACAO');
  const iDataFinalizacao = findColByName(header, 'DATA DE FINALIZAÇÃO', 'DATA DE FINALIZACAO');
  const iDiasCorridos = findColByName(header, 'QTD DIAS CORRIDOS PARA FINALIZAÇÃO', 'QTD DIAS CORRIDOS PARA FINALIZACAO');
  const iDiasUteisEntrega = findColByName(header, 'QTD DIAS ÚTEIS PARA ENTREGA', 'QTD DIAS UTEIS PARA ENTREGA');
  const iDiasUteisEmAberto = findColByName(header, 'QTDE DIAS ÚTEIS EM ABERTO', 'QTDE DIAS UTEIS EM ABERTO');
  const iDiasUteisLimite = findColByName(header, 'QTDE DIAS ÚTEIS PARA LIMITE DA ENTREGA', 'QTDE DIAS UTEIS PARA LIMITE DA ENTREGA');
  const iDataLimite = findColByName(header, 'DATA LIMITE DA ENTREGA');

  const numOrNull = (v: unknown): number | null => {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    return toNum(v);
  };

  return rows.slice(1)
    .filter(r => String(r[iCodigo] ?? '').trim() !== '')
    .map(r => ({
      codigoPedido: String(r[iCodigo] ?? '').trim(),
      pdvCodigo: String(r[iPdv] ?? '').trim(),
      categoriaAdesao: iCategoria >= 0 ? String(r[iCategoria] ?? '').trim() : '',
      statusPrazo: iStatusPrazo >= 0 ? String(r[iStatusPrazo] ?? '').trim() : '',
      cidadeOrigem: iCidadeOrigem >= 0 ? String(r[iCidadeOrigem] ?? '').trim() : '',
      ufOrigem: iUfOrigem >= 0 ? String(r[iUfOrigem] ?? '').trim() : '',
      cidadeDestino: iCidadeDestino >= 0 ? String(r[iCidadeDestino] ?? '').trim() : '',
      ufDestino: iUfDestino >= 0 ? String(r[iUfDestino] ?? '').trim() : '',
      statusPedido: iStatusPedido >= 0 ? String(r[iStatusPedido] ?? '').trim() : '',
      dataAprovacao: iDataAprovacao >= 0 ? String(r[iDataAprovacao] ?? '').trim() : '',
      dataFinalizacao: iDataFinalizacao >= 0 ? String(r[iDataFinalizacao] ?? '').trim() : '',
      qtdDiasCorridosFinalizacao: iDiasCorridos >= 0 ? numOrNull(r[iDiasCorridos]) : null,
      qtdDiasUteisEntrega: iDiasUteisEntrega >= 0 ? numOrNull(r[iDiasUteisEntrega]) : null,
      qtdDiasUteisEmAberto: iDiasUteisEmAberto >= 0 ? numOrNull(r[iDiasUteisEmAberto]) : null,
      qtdDiasUteisLimiteEntrega: iDiasUteisLimite >= 0 ? numOrNull(r[iDiasUteisLimite]) : null,
      dataLimiteEntrega: iDataLimite >= 0 ? String(r[iDataLimite] ?? '').trim() : '',
    } as LogisticaAdesaoDetalheRow));
}

// --- ReceitaCanalLoja_Performance_por_PDV.xlsx ---
// 3 linhas de header: título, grupo (LOJA / CLIQUE E RETIRE / TOTAL) e rótulo de métrica, repetido
// dentro de cada bloco de 6 colunas. Busca exata-primeiro dentro dos limites do bloco, senão "GAP
// ACORDADO (R$)" e "GAP ACORDADO (%)" colidem por substring (o primeiro é prefixo normalizado do
// segundo quando comparado na ordem errada).
export function parseReceitaCanalLojaPdvXlsx(workbook: XLSX.WorkBook): ReceitaCanalLojaPdvRow[] {
  const sheet = findSheet(workbook, 'PERFORMANCE POR PDV') ?? findFirstDataSheet(workbook);
  const rows = sheetToRows(sheet);
  if (rows.length < 4) return [];
  const groupRowIdx = findHeaderRowIndex(rows, 'LOJA', 'CLIQUE E RETIRE', 'TOTAL');
  const groupRow = rows[groupRowIdx];
  const labelRow = rows[groupRowIdx + 1] ?? [];
  const dataRows = rows.slice(groupRowIdx + 2);

  const lojaStart = findColByName(groupRow, 'LOJA');
  const cliqueStart = findColByName(groupRow, 'CLIQUE E RETIRE');
  const totalStart = findColByName(groupRow, 'TOTAL');
  const starts = [lojaStart, cliqueStart, totalStart].filter(i => i >= 0);

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
  // As colunas "GAP ACORDADO (%)" e "REALIZADO (%)" deste arquivo são sempre fração do Excel
  // (0.77 = 77%), nunca um valor "já em pontos percentuais" — diferente de outras planilhas do
  // sistema de origem. A heurística genérica `toPct` (fração se |n|<=1, já-percentual caso
  // contrário) erra aqui quando o realizado passa de 100% da meta (fração > 1, ex. 1.6356 = 163,56%
  // — `toPct` devolveria 1,6356% em vez de 163,56%), então convertemos direto sem essa heurística.
  // Célula "-" (meta zerada, razão indefinida) vira `null`, não 0 — 0% sugeriria meta batida.
  function fractionToPct(v: unknown): number | null {
    if (typeof v === 'number') return v * 100;
    const s = String(v ?? '').trim();
    if (s === '' || s === '-' || s === '--') return null;
    return toNum(v) * 100;
  }
  function readBlock(start: number, r: unknown[]): ReceitaCanalLojaBlock {
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
    .filter(r => String(r[1] ?? '').trim() !== '') // coluna PDV vazia = linha TOTAL agregada da rede
    .map(r => ({
      un: String(r[0] ?? '').trim(),
      pdvCodigo: String(r[1] ?? '').trim() || null,
      cidade: String(r[2] ?? '').trim(),
      localPdv: String(r[3] ?? '').trim(),
      loja: readBlock(lojaStart, r),
      cliqueRetire: readBlock(cliqueStart, r),
      total: readBlock(totalStart, r),
    } as ReceitaCanalLojaPdvRow));
}

// --- ReceitaCanalLoja_por_UN.xlsx ---
// Estrutura em blocos empilhados verticalmente (não em colunas): total do CP, depois um bloco por
// UN (nome, header META/REALIZADO/ANTERIOR/VARIAÇÃO, linha de dado), depois "Composição Receita:"
// com a quebra Loja x Clique e Retire.
export function parseReceitaCanalLojaUnXlsx(workbook: XLSX.WorkBook): ReceitaCanalLojaUnDataset | null {
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
  const iVar = findColByName(totalHeader, 'VARIAÇÃO PERCENTUAL', 'VARIACAO PERCENTUAL', 'VARIAÇÃO', 'VARIACAO');

  const totalMeta = iMeta >= 0 ? toNum(totalData[iMeta]) : 0;
  const totalRealizado = iRealizado >= 0 ? toNum(totalData[iRealizado]) : 0;
  const totalAnterior = iAnterior >= 0 ? toNum(totalData[iAnterior]) : 0;
  const totalVariacaoPct = iVar >= 0 ? toPct(totalData[iVar]) : 0;

  const isComposicaoRow = (r: unknown[] | undefined) => String(r?.[0] ?? '').trim().toLowerCase().startsWith('composição receita');

  const porUn: { un: string; meta: number; realizado: number; anterior: number; variacaoPct: number }[] = [];
  let i = totalHeaderIdx + 2;
  while (i < rows.length && !isComposicaoRow(rows[i])) {
    const rowLabel = String(rows[i]?.[0] ?? '').trim();
    const nextRow = rows[i + 1];
    const nextIsHeader = !!nextRow && normalizeCell(String(nextRow[0] ?? '')) === 'META';
    if (rowLabel !== '' && normalizeCell(rowLabel) !== 'METAPORUN' && nextIsHeader) {
      const dataRow = rows[i + 2] ?? [];
      porUn.push({
        un: rowLabel,
        meta: toNum(dataRow[0]),
        realizado: toNum(dataRow[1]),
        anterior: toNum(dataRow[2]),
        variacaoPct: toPct(dataRow[3]),
      });
      i += 3;
      continue;
    }
    i += 1;
  }

  const composicao: { nome: string; realizado: number; anterior: number }[] = [];
  const composIdx = rows.findIndex(isComposicaoRow);
  if (composIdx >= 0) {
    const compHeader = rows[composIdx + 1] ?? [];
    const iNome = findColByName(compHeader, 'NOME');
    const iCompRealizado = findColByName(compHeader, 'REALIZADO');
    const iCompAnterior = findColByName(compHeader, 'ANTERIOR');
    for (let j = composIdx + 2; j < rows.length; j++) {
      const nome = String(rows[j]?.[iNome >= 0 ? iNome : 0] ?? '').trim();
      if (!nome) continue;
      composicao.push({
        nome,
        realizado: iCompRealizado >= 0 ? toNum(rows[j][iCompRealizado]) : 0,
        anterior: iCompAnterior >= 0 ? toNum(rows[j][iCompAnterior]) : 0,
      });
    }
  }

  return { totalMeta, totalRealizado, totalAnterior, totalVariacaoPct, porUn, composicao };
}

// --- ReceitaCanalLoja_por_Periodo.xlsx ---
// Nos exports recebidos até agora, chega só com a aba FILTROS (sem tabela de dados) — trata isso
// como ausência de série temporal, não como erro de parsing.
export function parseReceitaCanalLojaPeriodoXlsx(workbook: XLSX.WorkBook): ReceitaCanalLojaPeriodoRow[] {
  const dataSheetName = workbook.SheetNames.find(n => n.toUpperCase() !== 'FILTROS');
  if (!dataSheetName) return [];
  const rows = sheetToRows(workbook.Sheets[dataSheetName]);
  if (rows.length < 2) return [];
  const headerIdx = findHeaderRowIndex(rows, 'Data', 'Período', 'Periodo', 'Receita');
  const header = rows[headerIdx];
  const dataRows = rows.slice(headerIdx + 1);
  const iData = findColByName(header, 'Data', 'Período', 'Periodo');
  const iReceita = findColByName(header, 'Receita');
  if (iData < 0 || iReceita < 0) return [];
  return dataRows
    .filter(r => String(r[iData] ?? '').trim() !== '')
    .map(r => ({ data: String(r[iData] ?? '').trim(), receita: toNum(r[iReceita]) } as ReceitaCanalLojaPeriodoRow));
}
