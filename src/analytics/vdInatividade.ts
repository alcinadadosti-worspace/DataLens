import { Order } from '../types/order';
import { isRevenueEligible } from './financialMetrics';
import { pdvForOrder } from './pdvMapping';
import { dominantCiclo } from './vdSnapshot';
import { parseBRDate } from '../utils/dateUtils';

/**
 * Inatividade (I1–I6) revendedor a revendedor, a partir dos ConsultaPedidos de ciclos anteriores.
 *
 * A Extranet só manda a contagem por faixa (VendaDireta_Ativas_por_tier). Aqui a faixa sai da última
 * compra: quem comprou no ciclo atual é ativo (A0); quem comprou pela última vez há k ciclos está em Ik.
 * Mais de 6 ciclos sem comprar = fora da base (a Extranet conta essas como "perda da base").
 *
 * Validado no Ciclo 14 com os ciclos 08–13 de 2026 (Extranet entre parênteses): A0 2.117 (2.125),
 * I1 1.237 (1.239), I2 758 (752), I3 625 (621), I4 401 (452), I5 220 (241), I6 224 (224). A diferença
 * no I4/I5 bate com os Consumidores Finais dos pedidos OMNI dos ciclos 09 e 10, que a Extranet parece
 * contar ali — aqui ficam de fora, a lista é de revendedores. Um arquivo de ciclo exportado antes do fim
 * do ciclo (aconteceu com o 11) joga gente pra faixa errada; daí o aviso de ciclo incompleto.
 */

export const SEGMENTOS_INATIVIDADE = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6'] as const;
export type SegmentoInatividade = typeof SEGMENTOS_INATIVIDADE[number];

/** Resumo dos pedidos de um revendedor num ciclo — só o que a lista de inativos mostra. */
export interface CompraNoCiclo {
  nome: string;
  papel: string;
  tierId: string;
  supervisor: string;
  estrutura: string;
  pdv: string | null;
  valor: number;
  pedidos: number;
  /** dd/mm/aaaa da última Data Captação dele no ciclo. */
  ultimaData: string;
}

/** Um ConsultaPedidos reduzido ao que a inatividade precisa — os pedidos em si não ficam na memória. */
export interface ResumoCiclo {
  ciclo: string;
  arquivo: string;
  /** Primeira e última Data Captação do arquivo (dd/mm/aaaa) — usadas pra detectar exportação incompleta. */
  primeiraData: string;
  ultimaData: string;
  pedidos: number;
  /** Por código do revendedor (Pessoa). */
  compras: Record<string, CompraNoCiclo>;
}

export interface RevendedorInativo {
  codigo: string;
  nome: string;
  segmento: SegmentoInatividade;
  papel: string;
  tierId: string;
  ultimoCiclo: string;
  ultimaCompra: string;
  valorUltimoCiclo: number;
  supervisor: string;
  estrutura: string;
  pdv: string | null;
}

export interface InatividadeResult {
  cicloAtual: string;
  porSegmento: Record<SegmentoInatividade, RevendedorInativo[]>;
  /** Os 6 ciclos anteriores ao atual, do I1 ao I6 (null quando não dá pra saber — ver avisos). */
  janela: (string | null)[];
  ciclosFaltando: string[];
  avisos: string[];
}

const OMNI = 'Modelo - OMNIChannel';

/** Pedido que conta como compra do revendedor: não cancelado e não OMNI (no OMNI quem compra é o consumidor final). */
function contaComoCompra(o: Order): boolean {
  return !!o.Pessoa && o.ModeloComercial !== OMNI && isRevenueEligible(o);
}

function soData(raw: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw.trim());
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : '';
}

function dataMs(ddmmaaaa: string): number {
  return parseBRDate(ddmmaaaa)?.getTime() ?? NaN;
}

export function resumirCiclo(orders: Order[], arquivo: string): ResumoCiclo {
  const ciclo = dominantCiclo(orders) ?? '';
  let primeira = '';
  let ultima = '';
  const compras: Record<string, CompraNoCiclo> = {};
  for (const o of orders) {
    if (o.CicloMarketing !== ciclo) continue;
    const data = soData(o.DataCaptacao);
    if (data) {
      if (!primeira || dataMs(data) < dataMs(primeira)) primeira = data;
      if (!ultima || dataMs(data) > dataMs(ultima)) ultima = data;
    }
    if (!contaComoCompra(o)) continue;
    const c = compras[o.Pessoa];
    if (!c) {
      compras[o.Pessoa] = {
        nome: o.NomePessoa, papel: o.Papel, tierId: o.tierId, supervisor: o.ResponsavelEstrutura,
        estrutura: o.Estrutura, pdv: pdvForOrder(o), valor: o.ValorPraticado, pedidos: 1, ultimaData: data,
      };
    } else {
      c.valor += o.ValorPraticado;
      c.pedidos++;
      // Segmentação/estrutura do pedido mais recente do ciclo — é a que vale "na última compra".
      if (data && (!c.ultimaData || dataMs(data) >= dataMs(c.ultimaData))) {
        c.ultimaData = data;
        c.papel = o.Papel;
        c.tierId = o.tierId;
        c.supervisor = o.ResponsavelEstrutura;
        c.estrutura = o.Estrutura;
        c.pdv = pdvForOrder(o) ?? c.pdv;
      }
    }
  }
  return { ciclo, arquivo, primeiraData: primeira, ultimaData: ultima, pedidos: orders.length, compras };
}

/** "13/2026" → { num: 13, ano: 2026 }. */
export function parseCiclo(c: string): { num: number; ano: number } | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(c.trim());
  return m ? { num: Number(m[1]), ano: Number(m[2]) } : null;
}

/**
 * Último ciclo de cada ano entre os ciclos conhecidos — a numeração recomeça em 01 todo ano e a
 * quantidade de ciclos por ano não é fixa, então só dá pra atravessar a virada se tivermos o último.
 */
export function ultimoCicloPorAno(ciclos: string[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const c of ciclos) {
    const p = parseCiclo(c);
    if (p) out[p.ano] = Math.max(out[p.ano] ?? 0, p.num);
  }
  return out;
}

/** Ciclo imediatamente anterior; null na virada do ano quando o último ciclo do ano anterior é desconhecido. */
export function cicloAnterior(c: string, ultimoPorAno: Record<number, number>): string | null {
  const p = parseCiclo(c);
  if (!p) return null;
  if (p.num > 1) return `${String(p.num - 1).padStart(2, '0')}/${p.ano}`;
  const ultimo = ultimoPorAno[p.ano - 1];
  return ultimo ? `${String(ultimo).padStart(2, '0')}/${p.ano - 1}` : null;
}

/** Os `n` ciclos anteriores a `atual`, do mais recente pro mais antigo. */
export function janelaAnterior(atual: string, n: number, ultimoPorAno: Record<number, number>): (string | null)[] {
  const out: (string | null)[] = [];
  let c: string | null = atual;
  for (let i = 0; i < n; i++) {
    c = c ? cicloAnterior(c, ultimoPorAno) : null;
    out.push(c);
  }
  return out;
}

function fmtCiclo(c: string): string {
  return `Ciclo ${c.replace('/', ' - ')}`;
}

/** Folga entre o fim de um ciclo e o início do seguinte acima da qual o arquivo do primeiro parece cortado. Entre ciclos completos a folga é de 1–2 dias (domingo). */
const FOLGA_MAX_DIAS = 3;

export function calcularInatividade(atual: ResumoCiclo, historico: ResumoCiclo[]): InatividadeResult {
  const todos = [atual, ...historico.filter(h => h.ciclo !== atual.ciclo)];
  const porCiclo = new Map(todos.map(r => [r.ciclo, r]));
  const ultimoPorAno = ultimoCicloPorAno(todos.map(r => r.ciclo));
  const janela = janelaAnterior(atual.ciclo, SEGMENTOS_INATIVIDADE.length, ultimoPorAno);

  const avisos: string[] = [];
  if (janela.some(c => c === null)) {
    avisos.push(`Sem o último ciclo de ${(parseCiclo(atual.ciclo)?.ano ?? 0) - 1} não dá pra contar a inatividade através da virada do ano — importe também os ciclos finais do ano anterior.`);
  }
  const ciclosFaltando = janela.filter((c): c is string => !!c && !porCiclo.has(c));
  if (ciclosFaltando.length > 0) {
    avisos.push(`Faltam os pedidos de ${ciclosFaltando.map(fmtCiclo).join(', ')}: quem comprou pela última vez ${ciclosFaltando.length === 1 ? 'nesse ciclo' : 'nesses ciclos'} aparece como inativo há mais tempo.`);
  }
  // Ciclo da janela cujo arquivo termina bem antes do próximo começar — exportado com o ciclo ainda aberto.
  for (let i = janela.length - 1; i >= 0; i--) {
    const c = janela[i];
    const seguinte = i === 0 ? atual.ciclo : janela[i - 1];
    const a = c ? porCiclo.get(c) : undefined;
    const b = seguinte ? porCiclo.get(seguinte) : undefined;
    if (!a || !b || !a.ultimaData || !b.primeiraData) continue;
    const folgaDias = (dataMs(b.primeiraData) - dataMs(a.ultimaData)) / 86_400_000;
    if (folgaDias > FOLGA_MAX_DIAS) {
      avisos.push(`${fmtCiclo(a.ciclo)} parece incompleto: o arquivo termina em ${a.ultimaData} e o ${fmtCiclo(b.ciclo)} começa em ${b.primeiraData}. Quem comprou nesse intervalo fica numa faixa mais antiga do que a real — reexporte esse ciclo.`);
    }
  }

  const porSegmento = Object.fromEntries(SEGMENTOS_INATIVIDADE.map(s => [s, [] as RevendedorInativo[]])) as Record<SegmentoInatividade, RevendedorInativo[]>;
  const classificados = new Set(Object.keys(atual.compras));
  // Do ciclo mais recente pro mais antigo: a primeira vez que o revendedor aparece é a última compra dele.
  janela.forEach((c, i) => {
    const resumo = c ? porCiclo.get(c) : undefined;
    if (!resumo) return;
    const segmento = SEGMENTOS_INATIVIDADE[i];
    for (const [codigo, compra] of Object.entries(resumo.compras)) {
      if (classificados.has(codigo)) continue;
      classificados.add(codigo);
      porSegmento[segmento].push({
        codigo, nome: compra.nome, segmento, papel: compra.papel, tierId: compra.tierId,
        ultimoCiclo: resumo.ciclo, ultimaCompra: compra.ultimaData, valorUltimoCiclo: compra.valor,
        supervisor: compra.supervisor, estrutura: compra.estrutura, pdv: compra.pdv,
      });
    }
  });
  for (const s of SEGMENTOS_INATIVIDADE) porSegmento[s].sort((a, b) => b.valorUltimoCiclo - a.valorUltimoCiclo);

  return { cicloAtual: atual.ciclo, porSegmento, janela, ciclosFaltando, avisos };
}
