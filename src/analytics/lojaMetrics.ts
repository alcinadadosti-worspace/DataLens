import { AbcRow, AggregatedRow, LojaDataset, LojaMetricRow, PedidoHistoricoRow, VendaHoraRow } from '../types/loja';

const SEM_IDENTIFICACAO = 'SEM IDENTIFICAÇÃO';

export function isSemIdentificacao(nome: string): boolean {
  return nome.trim().toUpperCase() === SEM_IDENTIFICACAO;
}

export function aggregateByName(rows: LojaMetricRow[], excludeEmpty = true): AggregatedRow[] {
  const groups = new Map<string, AggregatedRow>();

  for (const r of rows) {
    if (excludeEmpty && isSemIdentificacao(r.quebraNome) && r.gmv === 0) continue;
    const key = r.quebraNome;
    let g = groups.get(key);
    if (!g) {
      g = { key, gmv: 0, qtdBoletos: 0, receitaLiquida: 0, totalDescontos: 0, trocasValor: 0, qtdTrocas: 0, ticketMedio: 0, descontoPct: 0, participacaoPct: 0 };
      groups.set(key, g);
    }
    g.gmv += r.gmv;
    g.qtdBoletos += r.qtdBoletos;
    g.receitaLiquida += r.receitaLiquida;
    g.totalDescontos += r.totalDescontos;
    g.trocasValor += r.trocasValor;
    g.qtdTrocas += r.qtdTrocas;
  }

  const list = Array.from(groups.values());
  const totalGmv = list.reduce((s, g) => s + g.gmv, 0);

  for (const g of list) {
    g.ticketMedio = g.qtdBoletos > 0 ? g.gmv / g.qtdBoletos : 0;
    g.descontoPct = g.receitaLiquida > 0 ? (g.totalDescontos / g.receitaLiquida) * 100 : 0;
    g.participacaoPct = totalGmv > 0 ? (g.gmv / totalGmv) * 100 : 0;
  }

  return list.sort((a, b) => b.gmv - a.gmv);
}

export function computeOverallKPIs(lojasRows: LojaMetricRow[]) {
  const gmvTotal = lojasRows.reduce((s, r) => s + r.gmv, 0);
  const receitaLiquidaTotal = lojasRows.reduce((s, r) => s + r.receitaLiquida, 0);
  const qtdBoletosTotal = lojasRows.reduce((s, r) => s + r.qtdBoletos, 0);
  const totalDescontosTotal = lojasRows.reduce((s, r) => s + r.totalDescontos, 0);
  const trocasValorTotal = lojasRows.reduce((s, r) => s + r.trocasValor, 0);
  const ticketMedioGeral = qtdBoletosTotal > 0 ? gmvTotal / qtdBoletosTotal : 0;
  const descontoPctGeral = receitaLiquidaTotal > 0 ? (totalDescontosTotal / receitaLiquidaTotal) * 100 : 0;
  const trocasPctGeral = receitaLiquidaTotal > 0 ? (trocasValorTotal / receitaLiquidaTotal) * 100 : 0;

  return { gmvTotal, receitaLiquidaTotal, qtdBoletosTotal, totalDescontosTotal, trocasValorTotal, ticketMedioGeral, descontoPctGeral, trocasPctGeral };
}

export function rankLojas(lojasRows: LojaMetricRow[]): AggregatedRow[] {
  return aggregateByName(lojasRows, false);
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
export function classifyAbcByLoja(rows: AbcRow[], overrides: AbcOverrides = {}): Map<string, AbcAggregatedItem[]> {
  const byLoja = new Map<string, AbcRow[]>();
  for (const r of rows) {
    if (!r.lojaNome) continue;
    const key = r.lojaNome;
    if (!byLoja.has(key)) byLoja.set(key, []);
    byLoja.get(key)!.push(r);
  }
  const result = new Map<string, AbcAggregatedItem[]>();
  for (const [loja, lojaRows] of byLoja) {
    result.set(loja, classifyAbcList(lojaRows, overrides));
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
export function pedidosRates(rows: PedidoHistoricoRow[], groupBy: 'loja' | 'categoria'): PedidoRateRow[] {
  const groups = new Map<string, { volumeSugestao: number; volumeColocado: number; volumeFaturado: number }>();
  for (const r of rows) {
    const key = groupBy === 'loja' ? r.lojaNome : (r.categoria ?? 'Sem categoria');
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
