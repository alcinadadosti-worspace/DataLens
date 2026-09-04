import {
  AbcRow, AggregatedRow, LojaDataset, LojaMetricRow, PedidoHistoricoRow, VendaHoraRow,
  FidelidadeRow, LojaDigitalRow, ServicoConsultorRow, CuidadosFaciaisRow,
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
  return {
    fidelidade: dataset.fidelidade?.consultor.find(r => normalizePersonName(r.nome) === target) ?? null,
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

export function crossInsights(dataset: LojaDataset): string[] {
  const insights: string[] = [];

  const canais = aggregateByName(dataset.canal);
  const formas = aggregateByName(dataset.forma);
  const categorias = aggregateByName(dataset.gestao);
  const lojas = rankLojas(dataset.lojas);

  if (canais.length > 0) {
    const topCanal = canais[0];
    insights.push(
      `O canal "${topCanal.key}" concentra ${topCanal.participacaoPct.toFixed(1).replace('.', ',')}% do GMV do grupo, com ticket médio de ${topCanal.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
    );
  }

  if (formas.length > 0) {
    const topForma = formas[0];
    insights.push(
      `"${topForma.key}" é a forma de pagamento mais usada, representando ${topForma.participacaoPct.toFixed(1).replace('.', ',')}% do GMV recebido.`
    );
  }

  if (categorias.length > 0) {
    const topCategoria = categorias[0];
    insights.push(
      `A categoria "${topCategoria.key}" lidera o mix de portfólio com ${topCategoria.participacaoPct.toFixed(1).replace('.', ',')}% do GMV.`
    );
  }

  if (lojas.length >= 2) {
    const gap = lojas[0].gmv - lojas[1].gmv;
    const gapPct = lojas[1].gmv > 0 ? (gap / lojas[1].gmv) * 100 : 0;
    insights.push(
      `"${lojas[0].key}" lidera o ranking de lojas com ${gapPct.toFixed(1).replace('.', ',')}% a mais de GMV que a 2ª colocada, "${lojas[1].key}".`
    );
  }

  const anomalias = categorias.filter(c => c.descontoPct > 100);
  for (const a of anomalias) {
    insights.push(
      `Atenção: a categoria "${a.key}" tem desconto total (${a.descontoPct.toFixed(0)}%) acima da receita líquida — possível erro de lançamento ou promoção agressiva.`
    );
  }

  // --- Cruzamentos com os xlsx novos (Fidelidade, Serviços, Loja Digital, Cuidados Faciais) ---

  const kpis = computeOverallKPIs(dataset.lojas);
  if (dataset.fidelidade && dataset.fidelidade.cp.length > 0 && kpis.fidelidadePenetracaoPctGeral > 0) {
    const desafioPct = dataset.fidelidade.cp[0].penetracaoPct;
    insights.push(
      `${kpis.fidelidadePenetracaoPctGeral.toFixed(0)}% dos boletos da rede são de cliente cadastrado no Fidelidade, mas só ${desafioPct.toFixed(0)}% ` +
      `desses boletos concluem o desafio Fidelidade — funil de engajamento com bastante espaço para melhorar entre "é cliente" e "participa ativamente".`
    );
  }

  if (dataset.cuidadosFaciais && dataset.cuidadosFaciais.pdv.length >= 2) {
    const top = [...dataset.cuidadosFaciais.pdv].sort((a, b) => b.receitaBotik - a.receitaBotik)[0];
    const topLojaGmv = lojas.find(l => l.key.startsWith(top.pdvCodigo ?? '__'));
    insights.push(
      `A loja ${resolveLojaNome(top.pdvCodigo, top.nome)} lidera a receita de Botik/Cuidados Faciais (${top.receitaBotik.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` +
      (topLojaGmv ? `, e ocupa a ${lojas.indexOf(topLojaGmv) + 1}ª posição no ranking geral de GMV — vale ver se essa especialização em Botik é motivo ou consequência do desempenho.` : '.')
    );
  }

  if (dataset.lojaDigital && dataset.lojaDigital.pdv.length > 0) {
    const totalAtendidos = dataset.lojaDigital.pdv.reduce((s, r) => s + r.clientesAtendidos, 0);
    const totalConvertidos = dataset.lojaDigital.pdv.reduce((s, r) => s + r.clientesConvertidos, 0);
    const convRede = totalAtendidos > 0 ? (totalConvertidos / totalAtendidos) * 100 : 0;
    const pior = [...dataset.lojaDigital.pdv].sort((a, b) => a.conversaoPct - b.conversaoPct)[0];
    if (pior && pior.conversaoPct < convRede) {
      insights.push(
        `A conversão da Loja Digital na rede é ${convRede.toFixed(1).replace('.', ',')}%, mas a loja ${resolveLojaNome(pior.pdvCodigo, pior.nome)} converte só ` +
        `${pior.conversaoPct.toFixed(1).replace('.', ',')}% dos clientes atendidos — maior oportunidade de melhoria no atendimento via WhatsApp/digital.`
      );
    }
  }

  if (dataset.servicos && dataset.servicos.pdv.length >= 2) {
    const top = [...dataset.servicos.pdv].sort((a, b) => b.gmv - a.gmv)[0];
    insights.push(
      `Serviços em loja (maquiagem, cuidados faciais, cabelo) geraram ${top.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} na loja ${resolveLojaNome(top.pdvCodigo, top.pdvCodigo)}, a que mais converteu esse tipo de atendimento em venda.`
    );
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

// --- Validações cruzadas dos arquivos opcionais ---

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

  return warnings;
}
