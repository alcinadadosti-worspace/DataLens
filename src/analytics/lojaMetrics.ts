import { AggregatedRow, LojaDataset, LojaMetricRow } from '../types/loja';

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
