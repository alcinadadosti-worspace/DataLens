import {
  AbcRow, AggregatedRow, LojaDataset, LojaMetricRow, PedidoHistoricoRow, VendaHoraRow,
  FidelidadeRow, LojaDigitalRow, ServicoConsultorRow, CuidadosFaciaisRow,
  PedidoDetalhamentoSkuRow, LogisticaAdesaoDetalheRow, ResumoPerformanceBaseDivergente,
} from '../types/loja';
import { normalizeStoreDisplayName } from '../parsers/lojaParser';
import { resolveLojaNome } from './lojaStoreAliases';

const SEM_IDENTIFICACAO = 'SEM IDENTIFICAÇÃO';

export function isSemIdentificacao(nome: string): boolean {
  return nome.trim().toUpperCase() === SEM_IDENTIFICACAO;
}

export function aggregateByName(rows: LojaMetricRow[], excludeEmpty = true, lojaCodigoFilter?: string | null): AggregatedRow[] {
  const source = lojaCodigoFilter ? rows.filter(r => r.lojaCodigo === lojaCodigoFilter) : rows;
  const groups = new Map<string, AggregatedRow & { lojaCodigosSet: Set<string>; fidelidadePenetracaoWeighted: number }>();

  for (const r of source) {
    if (excludeEmpty && isSemIdentificacao(r.quebraNome) && r.gmv === 0) continue;
    const key = r.quebraNome;
    let g = groups.get(key);
    if (!g) {
      g = { key, gmv: 0, qtdBoletos: 0, receitaLiquida: 0, totalDescontos: 0, trocasValor: 0, qtdTrocas: 0, ticketMedio: 0, descontoPct: 0, participacaoPct: 0, lojaCodigos: [], fidelidadePenetracaoPct: 0, lojaCodigosSet: new Set(), fidelidadePenetracaoWeighted: 0 };
      groups.set(key, g);
    }
    g.gmv += r.gmv;
    g.qtdBoletos += r.qtdBoletos;
    g.receitaLiquida += r.receitaLiquida;
    g.totalDescontos += r.totalDescontos;
    g.trocasValor += r.trocasValor;
    g.qtdTrocas += r.qtdTrocas;
    g.fidelidadePenetracaoWeighted += r.fidelidadePenetracao * r.qtdBoletos;
    if (r.lojaCodigo) g.lojaCodigosSet.add(r.lojaCodigo);
  }

  const list = Array.from(groups.values());
  const totalGmv = list.reduce((s, g) => s + g.gmv, 0);

  for (const g of list) {
    g.ticketMedio = g.qtdBoletos > 0 ? g.gmv / g.qtdBoletos : 0;
    g.descontoPct = g.receitaLiquida > 0 ? (g.totalDescontos / g.receitaLiquida) * 100 : 0;
    g.participacaoPct = totalGmv > 0 ? (g.gmv / totalGmv) * 100 : 0;
    g.fidelidadePenetracaoPct = g.qtdBoletos > 0 ? g.fidelidadePenetracaoWeighted / g.qtdBoletos : 0;
    g.lojaCodigos = Array.from(g.lojaCodigosSet).sort();
  }

  return list
    .map(({ lojaCodigosSet: _lojaCodigosSet, fidelidadePenetracaoWeighted: _fidelidadePenetracaoWeighted, ...rest }) => rest)
    .sort((a, b) => b.gmv - a.gmv);
}

/** Lojas (código + nome amigável) presentes num conjunto de linhas — para popular filtros "Por loja". */
export function listLojasInDimension(rows: LojaMetricRow[]): { codigo: string; nome: string }[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.lojaCodigo) map.set(r.lojaCodigo, resolveLojaNome(r.lojaCodigo, normalizeStoreDisplayName(r.lojaNome)));
  }
  return Array.from(map, ([codigo, nome]) => ({ codigo, nome })).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export interface ConsultorLojaBreakdown extends AggregatedRow {
  /** Lojas onde essa pessoa vendeu, ordenadas por GMV decrescente — a primeira é a "principal". */
  porLoja: { codigo: string; nome: string; gmv: number; qtdBoletos: number }[];
}

/**
 * Agrega consultor/operador por pessoa, mas mantendo a quebra por loja — para saber em qual
 * unidade cada um vendeu mais, e sinalizar quem vendeu em mais de uma loja no período.
 */
export function aggregateConsultoresPorLoja(rows: LojaMetricRow[], lojaCodigoFilter?: string | null): ConsultorLojaBreakdown[] {
  const source = lojaCodigoFilter ? rows.filter(r => r.lojaCodigo === lojaCodigoFilter) : rows;
  const byNome = new Map<string, Map<string, { gmv: number; qtdBoletos: number; receitaLiquida: number; totalDescontos: number; trocasValor: number; qtdTrocas: number; fidelidadePenetracaoWeighted: number }>>();

  for (const r of source) {
    if (isSemIdentificacao(r.quebraNome) && r.gmv === 0) continue;
    const nome = r.quebraNome;
    if (!byNome.has(nome)) byNome.set(nome, new Map());
    const lojaMap = byNome.get(nome)!;
    const lojaKey = r.lojaCodigo ?? '';
    if (!lojaMap.has(lojaKey)) lojaMap.set(lojaKey, { gmv: 0, qtdBoletos: 0, receitaLiquida: 0, totalDescontos: 0, trocasValor: 0, qtdTrocas: 0, fidelidadePenetracaoWeighted: 0 });
    const g = lojaMap.get(lojaKey)!;
    g.gmv += r.gmv;
    g.qtdBoletos += r.qtdBoletos;
    g.receitaLiquida += r.receitaLiquida;
    g.totalDescontos += r.totalDescontos;
    g.trocasValor += r.trocasValor;
    g.qtdTrocas += r.qtdTrocas;
    g.fidelidadePenetracaoWeighted += r.fidelidadePenetracao * r.qtdBoletos;
  }

  const result: ConsultorLojaBreakdown[] = [];
  for (const [nome, lojaMap] of byNome) {
    // Só considera lojas com código conhecido em todos os totais — uma linha sem código de loja
    // (raro, mas possível se o campo não seguir o padrão "código - nome") não pode ser atribuída
    // a nenhuma unidade, então fica de fora tanto do porLoja quanto dos totais da pessoa, senão
    // GMV e desconto% ficariam inconsistentes entre si.
    const knownEntries = Array.from(lojaMap.entries()).filter(([codigo]) => codigo !== '');
    const porLoja = knownEntries
      .map(([codigo, g]) => ({ codigo, nome: resolveLojaNome(codigo, codigo), gmv: g.gmv, qtdBoletos: g.qtdBoletos }))
      .sort((a, b) => b.gmv - a.gmv);

    const gmv = knownEntries.reduce((s, [, g]) => s + g.gmv, 0);
    const qtdBoletos = knownEntries.reduce((s, [, g]) => s + g.qtdBoletos, 0);
    const receitaLiquida = knownEntries.reduce((s, [, g]) => s + g.receitaLiquida, 0);
    const totalDescontos = knownEntries.reduce((s, [, g]) => s + g.totalDescontos, 0);
    const trocasValor = knownEntries.reduce((s, [, g]) => s + g.trocasValor, 0);
    const qtdTrocas = knownEntries.reduce((s, [, g]) => s + g.qtdTrocas, 0);
    const fidelidadePenetracaoWeighted = knownEntries.reduce((s, [, g]) => s + g.fidelidadePenetracaoWeighted, 0);

    result.push({
      key: nome,
      gmv,
      qtdBoletos,
      receitaLiquida,
      totalDescontos,
      trocasValor,
      qtdTrocas,
      ticketMedio: qtdBoletos > 0 ? gmv / qtdBoletos : 0,
      descontoPct: receitaLiquida > 0 ? (totalDescontos / receitaLiquida) * 100 : 0,
      participacaoPct: 0,
      lojaCodigos: porLoja.map(l => l.codigo),
      fidelidadePenetracaoPct: qtdBoletos > 0 ? fidelidadePenetracaoWeighted / qtdBoletos : 0,
      porLoja,
    });
  }

  const total = result.reduce((s, g) => s + g.gmv, 0);
  for (const g of result) g.participacaoPct = total > 0 ? (g.gmv / total) * 100 : 0;

  return result.sort((a, b) => b.gmv - a.gmv);
}

export function computeOverallKPIs(lojasRows: LojaMetricRow[]) {
  const gmvTotal = lojasRows.reduce((s, r) => s + r.gmv, 0);
  const receitaLiquidaTotal = lojasRows.reduce((s, r) => s + r.receitaLiquida, 0);
  const qtdBoletosTotal = lojasRows.reduce((s, r) => s + r.qtdBoletos, 0);
  const totalDescontosTotal = lojasRows.reduce((s, r) => s + r.totalDescontos, 0);
  const trocasValorTotal = lojasRows.reduce((s, r) => s + r.trocasValor, 0);
  const fidelidadePenetracaoWeighted = lojasRows.reduce((s, r) => s + r.fidelidadePenetracao * r.qtdBoletos, 0);
  const ticketMedioGeral = qtdBoletosTotal > 0 ? gmvTotal / qtdBoletosTotal : 0;
  const descontoPctGeral = receitaLiquidaTotal > 0 ? (totalDescontosTotal / receitaLiquidaTotal) * 100 : 0;
  const trocasPctGeral = receitaLiquidaTotal > 0 ? (trocasValorTotal / receitaLiquidaTotal) * 100 : 0;
  const fidelidadePenetracaoPctGeral = qtdBoletosTotal > 0 ? fidelidadePenetracaoWeighted / qtdBoletosTotal : 0;

  return {
    gmvTotal, receitaLiquidaTotal, qtdBoletosTotal, totalDescontosTotal, trocasValorTotal, ticketMedioGeral, descontoPctGeral, trocasPctGeral,
    fidelidadePenetracaoPctGeral,
  };
}

/**
 * O arquivo LOJAS.csv já traz uma linha por loja (uma por código de PDV) — não agrupamos por
 * nome aqui, porque a mesma razão social ("ACQUA DISTRIBUIDORA DE PERFUMES E COSMETICOS LTDA")
 * se repete em várias lojas físicas diferentes; agrupar por nome mesclaria lojas distintas em
 * uma só. A chave do ranking é o código do PDV; o nome exibido corrige o typo conhecido
 * "COMETICOS" → "COSMETICOS" só para leitura, sem afetar a chave.
 */
export function rankLojas(lojasRows: LojaMetricRow[]): AggregatedRow[] {
  const list: AggregatedRow[] = lojasRows.map(r => ({
    key: r.lojaCodigo ? `${r.lojaCodigo} - ${resolveLojaNome(r.lojaCodigo, normalizeStoreDisplayName(r.quebraNome))}` : normalizeStoreDisplayName(r.quebraNome),
    gmv: r.gmv,
    qtdBoletos: r.qtdBoletos,
    receitaLiquida: r.receitaLiquida,
    totalDescontos: r.totalDescontos,
    trocasValor: r.trocasValor,
    qtdTrocas: r.qtdTrocas,
    ticketMedio: r.qtdBoletos > 0 ? r.gmv / r.qtdBoletos : 0,
    descontoPct: r.receitaLiquida > 0 ? (r.totalDescontos / r.receitaLiquida) * 100 : 0,
    participacaoPct: 0,
    lojaCodigos: r.lojaCodigo ? [r.lojaCodigo] : [],
    fidelidadePenetracaoPct: r.fidelidadePenetracao,
  }));
  const total = list.reduce((s, g) => s + g.gmv, 0);
  for (const g of list) g.participacaoPct = total > 0 ? (g.gmv / total) * 100 : 0;
  return list.sort((a, b) => b.gmv - a.gmv);
}

/**
 * Nomes de pessoa vêm em formatos diferentes entre os arquivos — MAIÚSCULO nos CSVs obrigatórios
 * e no xlsx Cuidados Faciais, mas Capitalizado no xlsx Loja Digital — então a comparação entre
 * datasets precisa ser sem acento/case/espaço, senão "Mariane Santos Sousa" nunca bate com
 * "MARIANE SANTOS SOUSA".
 */
export function normalizePersonName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Acha o nome mais parecido numa lista — nome exato primeiro; se não achar, cai pra distância de
 * edição pequena (até 2 caracteres), pra tolerar erros de digitação entre arquivos diferentes
 * (ex. "NAYARA SOARAS KIMURA" no CSV vs. "Nayara Soares Kimura" no xlsx de Fidelidade — mesma
 * pessoa, só um typo). O limite de 2 é conservador o bastante pra não confundir pessoas diferentes
 * com nomes parecidos.
 */
export function findByPersonName<T>(items: T[], nome: string, getName: (item: T) => string): T | null {
  const target = normalizePersonName(nome);
  const exact = items.find(it => normalizePersonName(getName(it)) === target);
  if (exact) return exact;

  const MAX_DIST = 2;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    const candidate = normalizePersonName(getName(it));
    if (Math.abs(candidate.length - target.length) > MAX_DIST) continue;
    const dist = levenshteinDistance(target, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = it;
    }
  }
  return bestDist <= MAX_DIST ? best : null;
}

export interface ConsultorExtras {
  fidelidade: FidelidadeRow | null;
  lojaDigital: LojaDigitalRow[];
  servicos: ServicoConsultorRow[];
  cuidadosFaciais: CuidadosFaciaisRow[];
}

/**
 * Cruza um consultor/operador (pelo nome, já que é a única chave em comum entre os arquivos) com
 * os 4 xlsx opcionais novos — Fidelidade, Loja Digital, Serviços e Cuidados Faciais — nenhum dos
 * quais tem um ID de pessoa estável, só o nome como veio de cada exportação.
 */
export function findConsultorExtras(dataset: LojaDataset, nome: string): ConsultorExtras {
  const target = normalizePersonName(nome);
  const fid = dataset.fidelidade ? findByPersonName(dataset.fidelidade.consultor, nome, r => r.nome) : null;
  return {
    fidelidade: fid,
    lojaDigital: dataset.lojaDigital?.consultor.filter(r => normalizePersonName(r.nome) === target) ?? [],
    servicos: dataset.servicos?.consultor.filter(r => normalizePersonName(r.consultor) === target) ?? [],
    cuidadosFaciais: dataset.cuidadosFaciais?.consultor.filter(r => normalizePersonName(r.nome) === target) ?? [],
  };
}

/** codigo da loja -> nome amigável (apelido do usuário, ou razão social com typo corrigido). */
export function buildLojaNomeLookup(lojasRows: LojaMetricRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of lojasRows) {
    if (r.lojaCodigo) map.set(r.lojaCodigo, resolveLojaNome(r.lojaCodigo, normalizeStoreDisplayName(r.quebraNome)));
  }
  return map;
}

function parseBRDateStr(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export interface DailyPoint {
  dateLabel: string;
  date: Date | null;
  gmv: number;
  qtdBoletos: number;
}

export function dailySeries(dataRows: LojaMetricRow[]): DailyPoint[] {
  const groups = new Map<string, DailyPoint>();
  for (const r of dataRows) {
    const key = r.quebraNome;
    let g = groups.get(key);
    if (!g) {
      g = { dateLabel: key, date: parseBRDateStr(key), gmv: 0, qtdBoletos: 0 };
      groups.set(key, g);
    }
    g.gmv += r.gmv;
    g.qtdBoletos += r.qtdBoletos;
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    return a.dateLabel.localeCompare(b.dateLabel);
  });
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function dayOfWeekAverages(daily: DailyPoint[]): { label: string; avgGmv: number }[] {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const d of daily) {
    if (!d.date) continue;
    const wd = d.date.getDay();
    sums[wd] += d.gmv;
    counts[wd] += 1;
  }
  return WEEKDAY_NAMES.map((label, i) => ({ label, avgGmv: counts[i] > 0 ? sums[i] / counts[i] : 0 }));
}

export interface ConsistencyCheck {
  ok: boolean;
  lojasTotal: number;
  canalTotal: number;
  gestaoTotal: number;
  formaTotal: number;
  maxDiffPct: number;
}

export function consistencyCheck(dataset: LojaDataset): ConsistencyCheck {
  const lojasTotal = dataset.lojas.reduce((s, r) => s + r.gmv, 0);
  const canalTotal = dataset.canal.reduce((s, r) => s + r.gmv, 0);
  const gestaoTotal = dataset.gestao.reduce((s, r) => s + r.gmv, 0);
  const formaTotal = dataset.forma.reduce((s, r) => s + r.gmv, 0);

  const diffs = [canalTotal, gestaoTotal, formaTotal].map(t =>
    lojasTotal > 0 ? Math.abs(t - lojasTotal) / lojasTotal * 100 : 0
  );
  const maxDiffPct = Math.max(...diffs);

  return { ok: maxDiffPct < 0.5, lojasTotal, canalTotal, gestaoTotal, formaTotal, maxDiffPct };
}

const fmtPct = (v: number, casas = 1) => `${v.toFixed(casas).replace('.', ',')}%`;
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** "CUIDADOS COM A PELE" -> "Cuidados com a pele"; o arquivo às vezes traz espaço duplo ("HOME  CARE"). */
const fmtCategoria = (s: string) => { const t = s.replace(/\s+/g, ' ').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
/** Apelido da loja; sem apelido cadastrado, "Loja 12345" quando veio só o código, ou o próprio nome. */
const nomeLoja = (codigo: string) => resolveLojaNome(codigo, /^\d+$/.test(codigo.trim()) ? `Loja ${codigo.trim()}` : codigo);
/** "a, b e c" */
const listaPt = (itens: string[]) => itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;

/**
 * Frases de leitura cruzada da Visão Geral, escritas pra quem não conhece os arquivos de origem:
 * cada uma afirma só o que os números sustentam. Cortes deliberados: alerta de desconto acima da
 * receita líquida por categoria (o desconto é contra preço de tabela — material de apoio vendido a
 * preço simbólico e categorias de volume ínfimo disparavam o alerta sem haver problema), conversão
 * da Loja Digital por loja (amostra de poucos clientes convertidos por loja, diferença virava ruído)
 * e "canal fora da loja" (os canais de Experimentação acompanham o GMV de Serviços em loja — são
 * venda dentro da loja, não fora dela).
 */
export function crossInsights(dataset: LojaDataset): string[] {
  const insights: string[] = [];

  const canais = aggregateByName(dataset.canal);
  const formas = aggregateByName(dataset.forma);
  const categorias = aggregateByName(dataset.gestao);
  const lojas = rankLojas(dataset.lojas);
  const gmvPorLoja = new Map(lojas.filter(l => l.lojaCodigos[0]).map(l => [l.lojaCodigos[0], l.gmv]));
  const gmvRede = lojas.reduce((s, l) => s + l.gmv, 0);

  const canalLoja = canais.find(c => /^loja$/i.test(c.key.trim()));
  if (canalLoja) {
    let texto = `O canal "Loja" gera ${fmtPct(canalLoja.participacaoPct)} do GMV, com ticket médio de ${fmtBRL(canalLoja.ticketMedio)}.`;
    const experimentacao = canais.filter(c => /experimenta/i.test(c.key) && c.gmv > 0);
    const expGmv = experimentacao.reduce((s, c) => s + c.gmv, 0);
    const expBoletos = experimentacao.reduce((s, c) => s + c.qtdBoletos, 0);
    const expTicket = expBoletos > 0 ? expGmv / expBoletos : 0;
    if (expTicket > canalLoja.ticketMedio) {
      const nomes = experimentacao.map(c => c.key.replace(/\s*experimenta[çc][ãa]o\s*/i, '').trim());
      const expPct = experimentacao.reduce((s, c) => s + c.participacaoPct, 0);
      texto += ` Os canais de experimentação (${listaPt(nomes)}) geram ${fmtPct(expPct)} e têm ticket médio maior, de ${fmtBRL(expTicket)} — quem passa por uma experiência na loja tende a levar mais.`;
    }
    insights.push(texto);
  } else if (canais.length > 0) {
    insights.push(`O canal "${canais[0].key}" é o que mais gera GMV: ${fmtPct(canais[0].participacaoPct)} do total, com ticket médio de ${fmtBRL(canais[0].ticketMedio)}.`);
  }

  if (formas.length > 0) {
    const top = formas[0];
    const totalBoletos = formas.reduce((s, f) => s + f.qtdBoletos, 0);
    const boletosPct = totalBoletos > 0 ? (top.qtdBoletos / totalBoletos) * 100 : 0;
    const maisBoletos = formas.every(f => f.qtdBoletos <= top.qtdBoletos);
    insights.push(maisBoletos
      ? `"${top.key}" é a forma de pagamento mais usada: ${fmtPct(top.participacaoPct)} do valor vendido e ${fmtPct(boletosPct, 0)} das compras.`
      : `"${top.key}" é a forma de pagamento que mais movimenta valor: ${fmtPct(top.participacaoPct)} do valor vendido, em ${fmtPct(boletosPct, 0)} das compras.`);
  }

  if (categorias.length > 0) {
    const [top, segunda] = categorias;
    insights.push(
      `${fmtCategoria(top.key)} é a categoria que sustenta a venda, com ${fmtPct(top.participacaoPct)} do GMV` +
      (segunda ? ` — a 2ª, ${fmtCategoria(segunda.key)}, tem ${fmtPct(segunda.participacaoPct)}.` : '.')
    );
  }

  if (lojas.length >= 2) {
    const [lider, vice] = lojas;
    const nomeLider = resolveLojaNome(lider.lojaCodigos[0], lider.key);
    const nomeVice = resolveLojaNome(vice.lojaCodigos[0], vice.key);
    const gapPct = vice.gmv > 0 ? ((lider.gmv - vice.gmv) / vice.gmv) * 100 : 0;
    const boletos = `${lider.qtdBoletos.toLocaleString('pt-BR')} contra ${vice.qtdBoletos.toLocaleString('pt-BR')} boletos`;
    const maisBoletos = lider.qtdBoletos >= vice.qtdBoletos;
    const ticketMaior = lider.ticketMedio >= vice.ticketMedio;
    const ticket = `ticket médio ${ticketMaior ? 'maior' : 'menor'} (${fmtBRL(lider.ticketMedio)} contra ${fmtBRL(vice.ticketMedio)})`;
    const motivo = maisBoletos && ticketMaior ? `vende mais vezes (${boletos}) e com ${ticket}`
      : maisBoletos ? `pelo volume: vende mais vezes (${boletos}), mesmo com ${ticket}`
      : `pelo ticket: ${ticket}, mesmo vendendo menos vezes (${boletos})`;
    insights.push(`${nomeLider} lidera o GMV do ciclo, ${fmtPct(gapPct)} à frente da ${nomeVice}. Ganha ${motivo}.`);
  }

  const kpis = computeOverallKPIs(dataset.lojas);
  if (dataset.fidelidade && dataset.fidelidade.cp.length > 0 && kpis.fidelidadePenetracaoPctGeral > 0) {
    const desafioPct = dataset.fidelidade.cp[0].penetracaoPct;
    let texto =
      `${fmtPct(kpis.fidelidadePenetracaoPctGeral, 0)} das compras têm o cliente identificado no Fidelidade, mas só ${fmtPct(desafioPct, 0)} ` +
      `das compras Fidelidade concluíram um desafio do programa — quase todos se identificam, mas poucos participam dos desafios.`;
    const porLoja = [...dataset.fidelidade.pdv].sort((a, b) => a.penetracaoPct - b.penetracaoPct);
    if (porLoja.length >= 3) {
      const piores = porLoja.slice(0, 2).map(p => `${nomeLoja(p.nome)} (${fmtPct(p.penetracaoPct, 0)})`);
      const melhor = porLoja[porLoja.length - 1];
      texto += ` Menores taxas: ${listaPt(piores)}; a melhor é ${nomeLoja(melhor.nome)} (${fmtPct(melhor.penetracaoPct, 0)}).`;
    }
    insights.push(texto);
  }

  if (dataset.cuidadosFaciais && dataset.cuidadosFaciais.pdv.length >= 2 && gmvRede > 0) {
    const pesoRede = dataset.cuidadosFaciais.pdv.reduce((s, r) => s + r.receitaTotal, 0) / gmvRede * 100;
    const porLoja = dataset.cuidadosFaciais.pdv
      .filter(r => r.pdvCodigo && (gmvPorLoja.get(r.pdvCodigo) ?? 0) > 0)
      .map(r => ({ codigo: r.pdvCodigo!, peso: r.receitaTotal / gmvPorLoja.get(r.pdvCodigo!)! * 100, receita: r.receitaTotal }))
      .sort((a, b) => b.peso - a.peso);
    const top = porLoja[0];
    if (top && top.peso > pesoRede) {
      insights.push(
        `Cuidados Faciais pesa mais na ${nomeLoja(top.codigo)}: ${fmtPct(top.peso)} do GMV da loja (${fmtBRL(top.receita)}), ` +
        `contra ${fmtPct(pesoRede)} na rede.`
      );
    }
  }

  if (dataset.logisticaAdesaoDetalhe && dataset.logisticaAdesaoDetalhe.length > 0) {
    const porPdv = logisticaAdesaoResumoPorPdv(dataset.logisticaAdesaoDetalhe);
    const pior = [...porPdv].filter(p => p.total >= 5).sort((a, b) => a.usaBemPct - b.usaBemPct)[0];
    if (pior) {
      insights.push(
        `${nomeLoja(pior.pdvCodigo)} tem a pior adesão à plataforma logística de transferência entre lojas (${fmtPct(pior.usaBemPct, 0)} "Usa Bem" em ${pior.total} pedidos) — vale reforçar o treinamento de uso da ferramenta ali.`
      );
    }
  }

  if (dataset.servicos && dataset.servicos.pdv.length >= 2 && gmvRede > 0) {
    const porLoja = dataset.servicos.pdv
      .filter(r => (gmvPorLoja.get(r.pdvCodigo) ?? 0) > 0)
      .map(r => ({ codigo: r.pdvCodigo, peso: r.gmv / gmvPorLoja.get(r.pdvCodigo)! * 100 }))
      .sort((a, b) => b.peso - a.peso);
    if (porLoja.length >= 3) {
      const pesoRede = dataset.servicos.pdv.reduce((s, r) => s + r.gmv, 0) / gmvRede * 100;
      const maiores = porLoja.slice(0, 2).map(p => `${fmtPct(p.peso, 0)} na ${nomeLoja(p.codigo)}`);
      const menor = porLoja[porLoja.length - 1];
      insights.push(
        `Vendas com serviço em loja (maquiagem, cuidados faciais, cabelo) são ${fmtPct(pesoRede, 0)} do GMV da rede, mas o peso varia muito entre lojas: ` +
        `chega a ${listaPt(maiores)}, contra só ${fmtPct(menor.peso, 0)} na ${nomeLoja(menor.codigo)}.`
      );
    }
  }

  return insights;
}

// --- Curva ABC de produtos ---

export interface AbcAggregatedItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  faturamento: number;
  lucro: number;
  margem: number;
  participacaoPct: number;
  participacaoAcumuladaPct: number;
  classe: 'A' | 'B' | 'C';
  isComercial: boolean;
  /** true quando a classificação veio de um override manual do usuário, não da heurística. */
  isOverridden: boolean;
}

/** codigo do SKU -> comercial (true) ou não-comercial (false), definido manualmente pelo usuário. */
export type AbcOverrides = Record<string, boolean>;

/** Sacolas, caixas de presente e amostras (sufixo PRM, ou preço unitário < ~R$3) — sinalizar à parte. */
export function isItemNaoComercial(descricao: string, faturamento: number, quantidade: number): boolean {
  const upper = descricao.toUpperCase();
  if (/\bPRM\b/.test(upper) || upper.includes('AMOSTRA') || upper.includes('SACOLA') || upper.includes('CAIXA PRESENTE')) return true;
  const precoUnitario = quantidade > 0 ? faturamento / quantidade : 0;
  return precoUnitario > 0 && precoUnitario < 3;
}

/** Override manual, quando existir para o SKU, sempre vence a heurística de texto/preço. */
function resolveIsComercial(codigo: string, descricao: string, faturamento: number, quantidade: number, overrides: AbcOverrides): boolean {
  if (codigo in overrides) return overrides[codigo];
  return !isItemNaoComercial(descricao, faturamento, quantidade);
}

function classifyAbcList(rows: AbcRow[], overrides: AbcOverrides): AbcAggregatedItem[] {
  const groups = new Map<string, { codigo: string; descricao: string; quantidade: number; faturamento: number; custo: number; lucro: number }>();
  for (const r of rows) {
    const key = r.codigo;
    let g = groups.get(key);
    if (!g) {
      g = { codigo: r.codigo, descricao: r.descricao, quantidade: 0, faturamento: 0, custo: 0, lucro: 0 };
      groups.set(key, g);
    }
    g.quantidade += r.quantidade;
    g.faturamento += r.faturamento;
    g.custo += r.custo;
    g.lucro += r.lucro;
  }

  const list = Array.from(groups.values()).sort((a, b) => b.faturamento - a.faturamento);
  const total = list.reduce((s, g) => s + g.faturamento, 0);
  let acumulado = 0;

  return list.map(g => {
    acumulado += g.faturamento;
    const participacaoAcumuladaPct = total > 0 ? (acumulado / total) * 100 : 0;
    const classe: 'A' | 'B' | 'C' = participacaoAcumuladaPct <= 80 ? 'A' : participacaoAcumuladaPct <= 95 ? 'B' : 'C';
    return {
      codigo: g.codigo,
      descricao: g.descricao,
      quantidade: g.quantidade,
      faturamento: g.faturamento,
      lucro: g.lucro,
      margem: g.faturamento > 0 ? (g.lucro / g.faturamento) * 100 : 0,
      participacaoPct: total > 0 ? (g.faturamento / total) * 100 : 0,
      participacaoAcumuladaPct,
      classe,
      isComercial: resolveIsComercial(g.codigo, g.descricao, g.faturamento, g.quantidade, overrides),
      isOverridden: g.codigo in overrides,
    };
  });
}

/** Curva ABC da rede toda. Passe `comercialOnly` para excluir sacolas/amostras/PRM (ou marcados como não-comercial) do ranking. */
export function classifyAbc(rows: AbcRow[], comercialOnly = false, overrides: AbcOverrides = {}): AbcAggregatedItem[] {
  const source = comercialOnly
    ? rows.filter(r => resolveIsComercial(r.codigo, r.descricao, r.faturamento, r.quantidade, overrides))
    : rows;
  return classifyAbcList(source, overrides);
}

/** Curva ABC por loja — só útil quando o arquivo veio aberto por loja (Quebra2 preenchida). */
/**
 * Agrupa por código de loja, não pelo nome cru — a razão social que vem no CSV ("ACQUA
 * DISTRIBUIDORA DE PERFUMES E COSMETICOS LTDA") se repete igual em todas as lojas físicas, então
 * agrupar por nome misturava lojas diferentes numa só chave (ou pior, dava a impressão de que era
 * a mesma loja em toda parte). O nome exibido usa o apelido amigável, como no resto do app.
 */
export function classifyAbcByLoja(rows: AbcRow[], overrides: AbcOverrides = {}): Map<string, AbcAggregatedItem[]> {
  const byLoja = new Map<string, AbcRow[]>();
  for (const r of rows) {
    if (!r.lojaCodigo) continue;
    if (!byLoja.has(r.lojaCodigo)) byLoja.set(r.lojaCodigo, []);
    byLoja.get(r.lojaCodigo)!.push(r);
  }
  const result = new Map<string, AbcAggregatedItem[]>();
  for (const [codigo, lojaRows] of byLoja) {
    const nome = resolveLojaNome(codigo, normalizeStoreDisplayName(lojaRows[0].lojaNome ?? codigo));
    result.set(`${codigo} - ${nome}`, classifyAbcList(lojaRows, overrides));
  }
  return result;
}

// --- Venda por hora ---

export interface HourlyBucket {
  faixaHoraria: string;
  receitaLiquida: number;
  qtdBoletos: number;
  participacaoPct: number;
}

export function hourlyDistribution(rows: VendaHoraRow[]): HourlyBucket[] {
  const groups = new Map<string, HourlyBucket>();
  for (const r of rows) {
    const key = r.faixaHoraria;
    let g = groups.get(key);
    if (!g) {
      g = { faixaHoraria: key, receitaLiquida: 0, qtdBoletos: 0, participacaoPct: 0 };
      groups.set(key, g);
    }
    g.receitaLiquida += r.receitaLiquida;
    g.qtdBoletos += r.qtdBoletos;
  }
  const list = Array.from(groups.values()).sort((a, b) => a.faixaHoraria.localeCompare(b.faixaHoraria));
  const total = list.reduce((s, g) => s + g.receitaLiquida, 0);
  for (const g of list) g.participacaoPct = total > 0 ? (g.receitaLiquida / total) * 100 : 0;
  return list;
}

// --- Gestão de pedidos ---

export interface PedidoRateRow {
  key: string;
  volumeSugestao: number;
  volumeColocado: number;
  volumeFaturado: number;
  /** Volume Colocado / Volume Sugestão — quanto do sugerido foi de fato pedido. */
  taxaColocacaoPct: number;
  /** Volume Faturado / Volume Colocado — quanto do pedido o fornecedor entregou. */
  taxaAtendimentoPct: number;
}

/**
 * Agrega o histórico de colocação por loja ou por categoria e calcula as duas taxas.
 * O "Giro" do arquivo de Visão Geral não é recalculável a partir daqui — não tentar reproduzi-lo.
 */
export function pedidosRates(rows: PedidoHistoricoRow[], groupBy: 'loja' | 'categoria', lojaNomeLookup?: Map<string, string>): PedidoRateRow[] {
  const groups = new Map<string, { volumeSugestao: number; volumeColocado: number; volumeFaturado: number }>();
  for (const r of rows) {
    // Agrupar por código (não só pelo nome) — várias lojas físicas compartilham a mesma razão
    // social, então agrupar só por nome mesclaria lojas distintas na mesma linha.
    const key = groupBy === 'loja'
      ? (r.lojaCodigo ? `${r.lojaCodigo} - ${lojaNomeLookup?.get(r.lojaCodigo) ?? r.lojaNome}` : r.lojaNome)
      : (r.categoria ?? 'Sem categoria');
    let g = groups.get(key);
    if (!g) {
      g = { volumeSugestao: 0, volumeColocado: 0, volumeFaturado: 0 };
      groups.set(key, g);
    }
    g.volumeSugestao += r.volumeSugestao;
    g.volumeColocado += r.volumeColocado;
    g.volumeFaturado += r.volumeFaturado;
  }

  return Array.from(groups.entries()).map(([key, g]) => ({
    key,
    ...g,
    taxaColocacaoPct: g.volumeSugestao > 0 ? (g.volumeColocado / g.volumeSugestao) * 100 : 0,
    taxaAtendimentoPct: g.volumeColocado > 0 ? (g.volumeFaturado / g.volumeColocado) * 100 : 0,
  })).sort((a, b) => b.volumeColocado - a.volumeColocado);
}

// --- Sell-in por SKU (GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo) ---

export interface SkuSellInRankItem {
  skuCodigo: string;
  skuDescricao: string;
  sugestaoComercial: number;
  pedidoRealizado: number;
  atingimentoMetaPct: number;
  pdvCount: number;
}

/** Ranking de SKUs por atingimento da meta de sell-in (rede toda), do pior para o melhor. */
export function sellInSkuRanking(rows: PedidoDetalhamentoSkuRow[]): SkuSellInRankItem[] {
  const groups = new Map<string, { skuDescricao: string; sugestaoComercial: number; pedidoRealizado: number; pdvs: Set<string> }>();
  for (const r of rows) {
    let g = groups.get(r.skuCodigo);
    if (!g) {
      g = { skuDescricao: r.skuDescricao, sugestaoComercial: 0, pedidoRealizado: 0, pdvs: new Set() };
      groups.set(r.skuCodigo, g);
    }
    g.sugestaoComercial += r.sugestaoComercial;
    g.pedidoRealizado += r.pedidoRealizado;
    g.pdvs.add(r.pdvCodigo);
  }
  return Array.from(groups.entries())
    .map(([skuCodigo, g]) => ({
      skuCodigo,
      skuDescricao: g.skuDescricao,
      sugestaoComercial: g.sugestaoComercial,
      pedidoRealizado: g.pedidoRealizado,
      atingimentoMetaPct: g.sugestaoComercial > 0 ? (g.pedidoRealizado / g.sugestaoComercial) * 100 : 0,
      pdvCount: g.pdvs.size,
    } as SkuSellInRankItem))
    .sort((a, b) => a.atingimentoMetaPct - b.atingimentoMetaPct);
}

// --- Adesão à plataforma logística (GestaoPedidos_Visão_detalhada_da_utilização_por_pedido) ---

export interface LogisticaAdesaoPdvSummary {
  pdvCodigo: string;
  total: number;
  usaBem: number;
  usaBemPct: number;
  dentroDoPrazoPct: number;
  slaMedioDiasUteis: number | null;
}

/** Reagrupa o detalhe pedido a pedido por PDV (loja de destino) — o arquivo-resumo não tem essa quebra. */
export function logisticaAdesaoResumoPorPdv(rows: LogisticaAdesaoDetalheRow[]): LogisticaAdesaoPdvSummary[] {
  const groups = new Map<string, { total: number; usaBem: number; dentroDoPrazo: number; slaSum: number; slaCount: number }>();
  for (const r of rows) {
    let g = groups.get(r.pdvCodigo);
    if (!g) {
      g = { total: 0, usaBem: 0, dentroDoPrazo: 0, slaSum: 0, slaCount: 0 };
      groups.set(r.pdvCodigo, g);
    }
    g.total += 1;
    if (r.categoriaAdesao.trim().toLowerCase() === 'usa bem') g.usaBem += 1;
    if (r.statusPrazo.trim().toLowerCase() === 'dentro do prazo') g.dentroDoPrazo += 1;
    if (r.qtdDiasUteisEntrega != null) {
      g.slaSum += r.qtdDiasUteisEntrega;
      g.slaCount += 1;
    }
  }
  return Array.from(groups.entries())
    .map(([pdvCodigo, g]) => ({
      pdvCodigo,
      total: g.total,
      usaBem: g.usaBem,
      usaBemPct: g.total > 0 ? (g.usaBem / g.total) * 100 : 0,
      dentroDoPrazoPct: g.total > 0 ? (g.dentroDoPrazo / g.total) * 100 : 0,
      slaMedioDiasUteis: g.slaCount > 0 ? g.slaSum / g.slaCount : null,
    } as LogisticaAdesaoPdvSummary))
    .sort((a, b) => b.usaBemPct - a.usaBemPct);
}

export interface LogisticaRotaSummary {
  origem: string;
  destino: string;
  qtdPedidos: number;
  slaMedioDiasUteis: number | null;
  usaBemPct: number;
}

/** Agrupa o detalhe de adesão logística por rota (cidade/UF origem → cidade/UF destino). */
export function logisticaRotas(rows: LogisticaAdesaoDetalheRow[]): LogisticaRotaSummary[] {
  const groups = new Map<string, { origem: string; destino: string; total: number; usaBem: number; slaSum: number; slaCount: number }>();
  for (const r of rows) {
    const origem = `${r.cidadeOrigem}/${r.ufOrigem}`;
    const destino = `${r.cidadeDestino}/${r.ufDestino}`;
    const key = `${origem}→${destino}`;
    let g = groups.get(key);
    if (!g) {
      g = { origem, destino, total: 0, usaBem: 0, slaSum: 0, slaCount: 0 };
      groups.set(key, g);
    }
    g.total += 1;
    if (r.categoriaAdesao.trim().toLowerCase() === 'usa bem') g.usaBem += 1;
    if (r.qtdDiasUteisEntrega != null) {
      g.slaSum += r.qtdDiasUteisEntrega;
      g.slaCount += 1;
    }
  }
  return Array.from(groups.values())
    .map(g => ({
      origem: g.origem,
      destino: g.destino,
      qtdPedidos: g.total,
      slaMedioDiasUteis: g.slaCount > 0 ? g.slaSum / g.slaCount : null,
      usaBemPct: g.total > 0 ? (g.usaBem / g.total) * 100 : 0,
    } as LogisticaRotaSummary))
    .sort((a, b) => b.qtdPedidos - a.qtdPedidos);
}

/** Pedidos ainda em aberto (sem data de finalização), ordenados dos mais parados pro mais recentes. */
export function logisticaPedidosEmAberto(rows: LogisticaAdesaoDetalheRow[]): LogisticaAdesaoDetalheRow[] {
  return rows
    .filter(r => r.qtdDiasUteisEmAberto != null)
    .sort((a, b) => (b.qtdDiasUteisEmAberto ?? 0) - (a.qtdDiasUteisEmAberto ?? 0));
}

// --- Validações cruzadas dos arquivos opcionais ---

/**
 * Indicadores do Resumo de Performance cuja base de receita veio diferente entre as abas
 * CP/PDV/CONSULTOR. O parser já aplicou a base da maioria das abas (`baseAdotada`) — o que sobra
 * como divergência de verdade são os casos sem maioria (`baseAdotada === null`).
 */
export function receitaBaseMismatches(dataset: LojaDataset): ResumoPerformanceBaseDivergente[] {
  return dataset.resumoPerformance?.basesDivergentes ?? [];
}

export function optionalConsistencyWarnings(dataset: LojaDataset): string[] {
  const warnings: string[] = [];
  const TOL = 1; // % de tolerância

  if (dataset.abc && dataset.vendaPorHora) {
    const fatAbc = dataset.abc.reduce((s, r) => s + r.faturamento, 0);
    const receitaHora = dataset.vendaPorHora.reduce((s, r) => s + r.receitaLiquida, 0);
    if (fatAbc > 0) {
      const diffPct = Math.abs(fatAbc - receitaHora) / fatAbc * 100;
      if (diffPct > TOL) {
        warnings.push(`Faturamento da Curva ABC (${fatAbc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) diverge ${diffPct.toFixed(1)}% da receita líquida de Venda por Hora — confira se os dois arquivos cobrem o mesmo período.`);
      }
    }
  }

  if (dataset.pedidosHistorico && dataset.pedidosVisaoGeral) {
    const hist = dataset.pedidosHistorico.reduce((acc, r) => ({
      sugestao: acc.sugestao + r.volumeSugestao,
      colocado: acc.colocado + r.volumeColocado,
      faturado: acc.faturado + r.volumeFaturado,
    }), { sugestao: 0, colocado: 0, faturado: 0 });
    const geral = dataset.pedidosVisaoGeral.reduce((acc, r) => ({
      sugestao: acc.sugestao + r.metaSugestao,
      colocado: acc.colocado + r.volumeColocado,
      faturado: acc.faturado + r.volumeFaturado,
    }), { sugestao: 0, colocado: 0, faturado: 0 });

    const checks: [string, number, number][] = [
      ['sugestão', hist.sugestao, geral.sugestao],
      ['colocado', hist.colocado, geral.colocado],
      ['faturado', hist.faturado, geral.faturado],
    ];
    for (const [label, a, b] of checks) {
      if (b > 0) {
        const diffPct = Math.abs(a - b) / b * 100;
        if (diffPct > TOL) {
          warnings.push(`Volume "${label}" somado do histórico de colocação (${a.toLocaleString('pt-BR')}) diverge ${diffPct.toFixed(1)}% do total da Visão Geral do Ciclo (${b.toLocaleString('pt-BR')}).`);
        }
      }
    }
  }

  if (dataset.pedidosDetalhamentoSku && dataset.pedidosMetaSellIn && dataset.pedidosMetaSellIn.length > 0) {
    const skuTotal = dataset.pedidosDetalhamentoSku.reduce((s, r) => s + r.pedidoRealizado, 0);
    const metaTotal = dataset.pedidosMetaSellIn.reduce((s, r) => s + r.pedidoRealizado, 0);
    if (metaTotal > 0) {
      const diffPct = Math.abs(skuTotal - metaTotal) / metaTotal * 100;
      if (diffPct > TOL) {
        warnings.push(`Pedido Realizado somado por SKU (${skuTotal.toLocaleString('pt-BR')}) diverge ${diffPct.toFixed(1)}% do total de Meta Sell-In por Ciclo (${metaTotal.toLocaleString('pt-BR')}).`);
      }
    }
  }

  for (const m of receitaBaseMismatches(dataset)) {
    if (m.baseAdotada) continue;
    const porAba = m.declaracoes.map(d => `${d.base} na aba ${d.aba}`).join(', ');
    warnings.push(`"${m.indicadorCp}" é declarado com bases diferentes no Resumo de Performance (${porAba}), sem uma base que a maioria das abas declare — mesmo indicador, base diferente conforme o recorte.`);
  }

  if (dataset.resumoPerformance) {
    const receitaTotalCP = dataset.resumoPerformance.cp.find(i => i.indicador.trim().toUpperCase() === 'RECEITA TOTAL');
    if (receitaTotalCP?.realizado != null) {
      const gmvLojas = dataset.lojas.reduce((s, r) => s + r.gmv, 0);
      if (gmvLojas > 0) {
        const diffPct = Math.abs(receitaTotalCP.realizado - gmvLojas) / gmvLojas * 100;
        if (diffPct > TOL) {
          warnings.push(`Receita Total do Resumo de Performance (${receitaTotalCP.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, base ${receitaTotalCP.tipoReceita ?? 'GMV'}) diverge ${diffPct.toFixed(1)}% do GMV somado em LOJAS.csv (${gmvLojas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) — confira se os dois arquivos foram exportados no mesmo momento/período.`);
        }
      }
    }
  }

  if (dataset.logisticaAdesaoResumo && dataset.logisticaAdesaoDetalhe) {
    for (const resumoRow of dataset.logisticaAdesaoResumo) {
      const count = dataset.logisticaAdesaoDetalhe.filter(
        d => d.categoriaAdesao.trim().toLowerCase() === resumoRow.categoria.trim().toLowerCase()
      ).length;
      if (count !== resumoRow.qtdPedidos) {
        warnings.push(`Categoria de adesão "${resumoRow.categoria}": resumo aponta ${resumoRow.qtdPedidos} pedidos, mas o detalhe tem ${count} linhas dessa categoria.`);
      }
    }
  }

  return warnings;
}

export interface MetaPefPdv {
  pdvCodigo: string;
  receita: number;
  /** Meta PEF reconstruída: o Resumo de Performance só traz "Vs. Meta PEF" (receita/meta − 1), então meta = receita / (1 + vs/100), com vs em %. */
  metaPef: number;
  gapValor: number;
  realizadoPct: number;
  vsAnoAnteriorPct: number | null;
}

/**
 * Meta PEF por loja a partir do Resumo de Performance (base GMV). Substitui a leitura do
 * ReceitaCanalLoja_Performance_por_PDV, que não vem em todos os lotes. Lojas sem meta ("-" no
 * arquivo) ficam de fora — não dá para inferir meta delas. Como o "Vs. Meta PEF" vem arredondado
 * em 4 casas, a meta derivada tem erro de ~0,01% (a soma das lojas fecha com a meta do CP).
 */
export function metaPefPorPdv(dataset: LojaDataset): MetaPefPdv[] {
  const pdvs = dataset.resumoPerformance?.pdv ?? [];
  return pdvs
    .filter(r => /^\d+$/.test(r.nome.trim()) && r.vsMetaPEFPct != null && r.vsMetaPEFPct > -100)
    .map(r => {
      const metaPef = r.receita / (1 + (r.vsMetaPEFPct as number) / 100);
      return {
        pdvCodigo: r.nome.trim(),
        receita: r.receita,
        metaPef,
        gapValor: r.receita - metaPef,
        realizadoPct: (r.receita / metaPef) * 100,
        vsAnoAnteriorPct: r.vsAnoAnteriorPct,
      };
    });
}

/** Meta PEF, realizado (GMV) e variação vs. ano anterior da rede, da aba CP do Resumo de Performance. */
export function metaPefRede(dataset: LojaDataset): { meta: number; realizado: number; vsAnoPassadoPct: number | null } | null {
  const row = dataset.resumoPerformance?.cp.find(i => i.indicador.trim().toUpperCase() === 'RECEITA TOTAL');
  if (!row || row.metaPEF == null || row.realizado == null) return null;
  return { meta: row.metaPEF, realizado: row.realizado, vsAnoPassadoPct: row.vsAnoPassadoPct };
}
