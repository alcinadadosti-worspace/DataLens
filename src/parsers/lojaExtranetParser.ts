import * as XLSX from 'xlsx';
import { toNum, toPct } from './lojaNumberUtils';
import { parseRupturaCausaFranqueadoXlsx, parseRupturaDetalhadaXlsx, parseRupturaPorItemXlsx } from './vdXlsxParser';
import {
  AbastecimentoRow, BenchmarkGrupo, BenchmarkIndicador, BoletoPorNivelDataset, BoletoPromocionalRow, BoletoResumoRow,
  BoletoTurbinadoRow, BsoRow, CategoriaDistribuicaoDataset, CategoriaDistribuicaoRow, FidelidadeDistribuicaoBloco,
  FidelidadeDistribuicaoRow, FidelidadeEvolucaoBloco, IdClienteConsultorRow, IdClienteEvolucaoRow,
  IndicadoresLojaConsultorRow, ItensPorBoletoRow, LojaExtranetCampos, LojaExtranetFile, MetricaCiclo, MobshopRow,
  PdvMetricasRow, ServicoDiaRow,
} from '../types/lojaExtranet';

type Linha = unknown[];

/**
 * `fidelidadeIdentificados` etc. são os arquivos de um mesmo relatório: cada um preenche sua parte
 * do campo do dataset (ver `aplicarRelatorioExtranet`).
 */
export type RelatorioExtranet =
  | 'indicadoresLoja' | 'idCliente' | 'idClienteEvolucao' | 'boletoResumo' | 'boletoPromocional' | 'boletoTurbinado'
  | 'abastecimento' | 'itensPorBoleto' | 'mobshop' | 'categoriaDistribuicao'
  | 'fidelidadeEvolucaoIdentificados' | 'fidelidadeEvolucaoResgate' | 'fidelidadeEvolucaoDesafio'
  | 'fidelidadeDistribuicaoIdentificados' | 'fidelidadeDistribuicaoResgate'
  | 'lojaDigitalConversao' | 'lojaDigitalReceita' | 'lojaDigitalTme' | 'servicosDiario'
  | 'rupturaCausaFranqueado' | 'rupturaDetalhada' | 'rupturaPorItem' | 'bsoDetalhe' | 'bsoPorCiclo';

/**
 * Testados antes das regras de `lojaParser.ts`, que são genéricas: "PROGRAMA_FIDELIDADE" pegaria as
 * 6 planilhas de Fidelidade, "ADERENCIA" a de Mobshop e "RECEITA_POR_CAT" a de macrocategoria — e a
 * última lida substituiria a certa. A ordem importa: mais específico primeiro.
 */
const HINTS: [RelatorioExtranet, string][] = [
  ['indicadoresLoja', 'LOJAINDICADORESDELOJA'],
  ['idClienteEvolucao', 'IDCLIENTEEVOLUCAOBOLETOS'],
  ['idCliente', 'INDICADORESIDCLIENTE'],
  ['boletoPromocional', 'LOJABOLETO20PROMOCIONAL'],
  ['boletoPromocional', 'LOJABOLETOPROMOCIONAL'],
  ['boletoTurbinado', 'LOJABOLETO20TURBINADO'],
  ['boletoTurbinado', 'LOJABOLETOTURBINADO'],
  ['boletoResumo', 'LOJABOLETO'],
  ['abastecimento', 'BOLETOSVISAOABASTECIMENTO'],
  ['itensPorBoleto', 'LOJADISTRIBUICAODEITENSPORBOLETO'],
  ['mobshop', 'LOJADISTRIBUICAORECEITATRANSACIONADAMOBSHOP'],
  ['categoriaDistribuicao', 'LOJADISTRIBUICAODARECEITAPORCATEGORIA'],
  ['fidelidadeEvolucaoIdentificados', 'PROGRAMAFIDELIDADEEVOLUCAO25BOLETOSIDENTIFICADOS'],
  ['fidelidadeEvolucaoResgate', 'PROGRAMAFIDELIDADEEVOLUCAO25BOLETOCOMRESGATE'],
  ['fidelidadeEvolucaoDesafio', 'PROGRAMAFIDELIDADEEVOLUCAO25PENETRACAODESAFIO'],
  ['fidelidadeDistribuicaoIdentificados', 'PROGRAMAFIDELIDADEDISTRIBUICAO25BOLETOSIDENTIFICADOS'],
  ['fidelidadeDistribuicaoResgate', 'PROGRAMAFIDELIDADEDISTRIBUICAO25BOLETOSCOMRESGATE'],
  ['lojaDigitalConversao', 'LOJADIGITALCONVERSAOPORCICLO'],
  ['lojaDigitalReceita', 'LOJADIGITALRECEITAPORCICLO'],
  ['lojaDigitalTme', 'LOJADIGITALTMEPORCICLO'],
  ['servicosDiario', 'TOTALDESERVICOS'],
  ['rupturaCausaFranqueado', 'RUPTURAVDRUPTURACAUSAFRANQUEADO'],
  ['rupturaDetalhada', 'RUPTURAVDRUPTURADETALHADA'],
  ['rupturaPorItem', 'RUPTURAVDDETALHAMENTO'],
  ['bsoDetalhe', 'RELATORIOBSOGERADODETALHEPORPERIODO'],
  ['bsoPorCiclo', 'RELATORIOBSOGERADOPORCICLO'],
];

/**
 * Reconhecidos, mas sem leitura: repetem o que já vem de outro arquivo do lote. O motivo de cada um
 * está em LEITURA_PLANILHAS_VD.md §12.
 */
const IGNORADOS = [
  'RELATORIOBSOGERADOMOVPORPERIODO',
  'LOJARECEITATRANSACIONADAXADERENCIAMOBSHOP',
  'LOJADISTRIBUICAODARECEITA',
  'LOJARECEITAPORCICLO',
  'RECEITACANALLOJAPORCICLO',
];

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function detectarRelatorioExtranet(fileName: string): RelatorioExtranet | 'ignorado' | null {
  const nome = normalizar(fileName);
  const hint = HINTS.find(([, h]) => nome.includes(h));
  if (hint) return hint[0];
  if (IGNORADOS.some(h => nome.includes(h))) return 'ignorado';
  // Receita_por_Ciclo solto: "Receita_por_Canal_UN" e "ReceitaCanalLoja_*" têm outro nome e não caem aqui.
  if (/^\d*RECEITAPORCICLO/.test(nome)) return 'ignorado';
  return null;
}

function linhas(wb: XLSX.WorkBook, ...nomes: string[]): Linha[] {
  const dados = wb.SheetNames.filter(n => !/^FILTROS$/i.test(n.trim()));
  const alvo = nomes.length === 0
    ? dados[0]
    : nomes.map(n => dados.find(d => normalizar(d) === normalizar(n))).find(Boolean);
  if (!alvo) return [];
  return XLSX.utils.sheet_to_json<Linha>(wb.Sheets[alvo], { header: 1, defval: '' });
}

const texto = (v: unknown) => String(v ?? '').trim();
const ehTotal = (v: unknown) => /^TOTAL$/i.test(texto(v));

/** "00:09:29" → 569 s. */
function segundos(v: unknown): number | null {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(texto(v));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function numero(v: unknown): number | null {
  const s = segundos(v);
  if (s !== null) return s;
  if (typeof v === 'number') return v;
  const t = texto(v);
  return t === '' || t === '-' ? null : toNum(t);
}

/** Chave estável de um bloco de métricas. O "%" fica: há "ATENDIMENTOS USO INDEVIDO" e "% ATENDIMENTOS USO INDEVIDO". */
export const chaveMetrica = (rotulo: string) => normalizar(rotulo.replace(/%/g, 'PCT'));

/** Índice da linha cuja 1ª célula é uma das esperadas, depois dos cabeçalhos agrupados. */
function linhaCabecalho(rows: Linha[], ...primeiraCelula: string[]): number {
  const alvos = primeiraCelula.map(normalizar);
  return rows.findIndex(r => alvos.includes(normalizar(texto(r[0]))));
}

function corpo(rows: Linha[], cabecalho: number, manterTotal = false): Linha[] {
  return rows.slice(cabecalho + 1).filter(r => texto(r[0]) !== '' && (manterTotal || !ehTotal(r[0])));
}

function posicoes(rows: Linha, nome: string): number[] {
  const alvo = normalizar(nome);
  return rows.flatMap((c, i) => (normalizar(texto(c)) === alvo ? [i] : []));
}

// --- Benchmark (aba CP) e blocos por PDV ---

function grupo(r: Linha, inicio: number): BenchmarkGrupo {
  const posicao = (i: number) => ({ ranking: texto(r[i]), media: texto(r[i + 1]) });
  return { regional: posicao(inicio), estado: posicao(inicio + 2), pais: posicao(inicio + 4) };
}

function parseBenchmark(wb: XLSX.WorkBook): BenchmarkIndicador[] {
  const rows = linhas(wb, 'CP');
  const h = linhaCabecalho(rows, 'INDICADORES');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    indicador: texto(r[0]),
    resultado: texto(r[1]),
    foraDoClube: grupo(r, 2),
    dentroDoClube: grupo(r, 8),
  }));
}

function parseMetricasPdv(wb: XLSX.WorkBook): PdvMetricasRow[] {
  const rows = linhas(wb, 'PDV');
  const h = linhaCabecalho(rows, 'PDV');
  if (h < 1) return [];
  const blocos = rows[h - 1].flatMap((c, i) => (texto(c) ? [{ chave: chaveMetrica(texto(c)), col: i }] : []));
  return corpo(rows, h).map(r => ({
    pdv: texto(r[0]),
    metricas: Object.fromEntries(blocos.map(({ chave, col }): [string, MetricaCiclo] => [chave, { anterior: numero(r[col]), atual: numero(r[col + 1]) }])),
  }));
}

function parseIndicadoresConsultor(wb: XLSX.WorkBook): IndicadoresLojaConsultorRow[] {
  const rows = linhas(wb, 'CONSULTOR');
  const h = linhaCabecalho(rows, 'PDV');
  if (h < 0) return [];
  const col = (nome: string) => posicoes(rows[h], nome)[0] ?? -1;
  const n = (r: Linha, nome: string) => numero(r[col(nome)]) ?? 0;
  return corpo(rows, h).map(r => ({
    pdv: texto(r[0]),
    consultor: texto(r[1]),
    receita: n(r, 'RECEITA (R$)'),
    boletos: n(r, 'QUANTIDADE DE BOLETOS'),
    boletosB1: n(r, 'QUANTIDADE DE BOLETOS B1'),
    boletoMedio: n(r, 'BOLETO MÉDIO'),
    itens: n(r, 'QUANTIDADE DE ITENS'),
    itensPorBoleto: n(r, 'ITENS POR BOLETO'),
    precoMedio: n(r, 'PREÇO MÉDIO'),
    receitaMobshop: n(r, 'RECEITA MOBSHOP (R$)'),
    boletoMedioMobshop: n(r, 'BOLETO MÉDIO MOBSHOP'),
    shareAlavancas: n(r, 'SHARE DE ALAVANCAS BT/BP'),
  }));
}

function parseIdClienteConsultor(wb: XLSX.WorkBook): IdClienteConsultorRow[] {
  const rows = linhas(wb, 'CONSULTOR');
  const h = linhaCabecalho(rows, 'PDV');
  if (h < 0) return [];
  const n = (r: Linha, i: number) => numero(r[i]) ?? 0;
  return corpo(rows, h).map(r => ({
    pdv: texto(r[0]),
    consultor: texto(r[1]),
    atendimentos: n(r, 2),
    atendimentosCpf: n(r, 3),
    atendimentosUsoIndevido: n(r, 4),
    atendimentosCpfPct: n(r, 5),
    atendimentosUsoIndevidoPct: n(r, 6),
    tmaSegundos: n(r, 7),
    totalBoletos: n(r, 8),
    boletosId: n(r, 9),
    boletosUsoIndevido: n(r, 10),
    boletosAbaixo2Min: n(r, 11),
    boletosValidosPct: n(r, 12),
    boletosUsoIndevidoPct: n(r, 13),
    boletosAbaixo2MinPct: n(r, 14),
  }));
}

function parseIdClienteEvolucao(wb: XLSX.WorkBook): IdClienteEvolucaoRow[] {
  const rows = linhas(wb);
  const h = linhaCabecalho(rows, 'Data');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    ciclo: texto(r[0]),
    totalBoletos: toNum(r[1]),
    comId: toNum(r[2]),
    semId: toNum(r[3]),
    pct: toPct(r[4]),
  }));
}

// --- Boletos ---

function parseBoletoResumo(wb: XLSX.WorkBook): BoletoResumoRow[] {
  return linhas(wb).slice(1)
    .filter(r => texto(r[0]) !== '')
    .map(r => ({ label: texto(r[0]), anterior: toNum(r[1]), atual: toNum(r[2]) }));
}

function porNivel<T>(wb: XLSX.WorkBook, ler: (rows: Linha[]) => T[]): BoletoPorNivelDataset<T> {
  return { cp: ler(linhas(wb, 'CP')), pdv: ler(linhas(wb, 'PDV')), consultor: ler(linhas(wb, 'CONSULTOR', 'CONSULTOR (A)')) };
}

function lerPromocional(rows: Linha[]): BoletoPromocionalRow[] {
  const h = linhaCabecalho(rows, 'CP', 'PDV', 'CONSULTOR');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    nome: texto(r[0]),
    totalBoletos: toNum(r[1]),
    elegiveis: toNum(r[2]),
    elegiveisPct: toPct(r[3]),
    convertidos: toNum(r[4]),
    convertidosPct: toPct(r[5]),
    oficiais: toNum(r[6]),
    flex: toNum(r[8]),
    exaustao: toNum(r[10]),
  }));
}

function lerTurbinado(rows: Linha[]): BoletoTurbinadoRow[] {
  const h = linhaCabecalho(rows, 'CP', 'PDV', 'CONSULTOR');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    nome: texto(r[0]),
    totalBoletos: toNum(r[1]),
    elegiveis: toNum(r[2]),
    turbinados: toNum(r[3]),
    oficiais: toNum(r[4]),
    oficiaisPct: toPct(r[5]),
    flex: toNum(r[6]),
    exaustao: toNum(r[8]),
  }));
}

function lerItensPorBoleto(rows: Linha[]): ItensPorBoletoRow[] {
  const h = linhaCabecalho(rows, 'CP', 'PDV', 'CONSULTOR');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    nome: texto(r[0]),
    total: toNum(r[1]),
    quantidades: [2, 4, 6, 8, 10].map(i => toNum(r[i])),
  }));
}

function lerMobshop(rows: Linha[]): MobshopRow[] {
  const h = linhaCabecalho(rows, 'CP', 'PDV', 'CONSULTOR (A)', 'CONSULTOR');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({ nome: texto(r[0]), aderenciaPct: toPct(r[2]) }));
}

function parseAbastecimento(wb: XLSX.WorkBook): AbastecimentoRow[] {
  const rows = linhas(wb);
  const h = linhaCabecalho(rows, 'CICLO');
  if (h < 0) return [];
  return corpo(rows, h).map(r => ({
    ciclo: texto(r[0]),
    metaSugestao: toNum(r[1]),
    pedidoRealizado: toNum(r[2]),
    pedidoFaturado: toNum(r[3]),
    vendaReal: toNum(r[4]),
    giroPct: toPct(r[5]),
  }));
}

// --- Macrocategorias ---

function lerCategorias(rows: Linha[]): { categorias: string[]; linhas: CategoriaDistribuicaoRow[] } {
  const h = linhaCabecalho(rows, 'PDV', 'CONSULTOR (A)', 'CONSULTOR');
  if (h < 1) return { categorias: [], linhas: [] };
  // Na aba de consultor o rótulo das categorias vem uma coluna à direita dos valores: por isso a
  // posição sai das colunas "RECEITA (R$)", e o nome, da ordem em que aparecem.
  const categorias = rows[h - 1].map(texto).filter(Boolean);
  const colunas = posicoes(rows[h], 'RECEITA (R$)');
  return {
    categorias,
    linhas: corpo(rows, h).map(r => ({
      nome: texto(r[0]),
      total: toNum(r[1]),
      receitas: colunas.map(i => toNum(r[i])),
    })),
  };
}

function parseCategorias(wb: XLSX.WorkBook): CategoriaDistribuicaoDataset {
  const pdv = lerCategorias(linhas(wb, 'PDV'));
  const consultor = lerCategorias(linhas(wb, 'CONSULTOR (A)', 'CONSULTOR'));
  return { categorias: pdv.categorias, pdv: pdv.linhas, consultor: consultor.linhas };
}

// --- Programa Fidelidade ---

function parseFidelidadeEvolucao(wb: XLSX.WorkBook): FidelidadeEvolucaoBloco | undefined {
  const rows = linhas(wb);
  const h = linhaCabecalho(rows, 'DATA');
  if (h < 0) return undefined;
  const ciclo = corpo(rows, h)[0];
  if (!ciclo) return undefined;
  const ant = posicoes(rows[h], 'PERÍODO ANTERIOR');
  const atu = posicoes(rows[h], 'PERÍODO ATUAL');
  return {
    pctAnterior: toPct(ciclo[ant[0]]),
    pctAtual: toPct(ciclo[atu[0]]),
    qtdAnterior: toNum(ciclo[ant[1]]),
    qtdAtual: toNum(ciclo[atu[1]]),
    baseAnterior: ant[2] !== undefined ? toNum(ciclo[ant[2]]) : null,
    baseAtual: atu[2] !== undefined ? toNum(ciclo[atu[2]]) : null,
  };
}

function lerFidelidadeDistribuicao(rows: Linha[]): FidelidadeDistribuicaoRow[] {
  const h = linhaCabecalho(rows, 'CP/PDV/CONSULTOR');
  if (h < 0) return [];
  const [iPct, iQtd, iBase] = posicoes(rows[h], 'PERÍODO ATUAL');
  return corpo(rows, h)
    .map(r => ({ nome: texto(r[0]), pct: toPct(r[iPct]), qtd: toNum(r[iQtd]), base: toNum(r[iBase]) }))
    // A aba PDV lista as lojas com o código antigo (3540, 7178...) com o período atual zerado.
    .filter(r => r.base > 0);
}

function parseFidelidadeDistribuicao(wb: XLSX.WorkBook): FidelidadeDistribuicaoBloco {
  return { pdv: lerFidelidadeDistribuicao(linhas(wb, 'PDV')), consultor: lerFidelidadeDistribuicao(linhas(wb, 'CONSULTOR')) };
}

// --- Serviços e BSO ---

/**
 * Períodos em que o filtro da Extranet passa do fim real do ciclo na Loja: o Ciclo 15 vai até 01/11, mas os
 * relatórios dizem 02/11. Só linhas datadas podem ser cortadas; os totais prontos do arquivo continuam como vieram.
 */
const FIM_REAL_POR_PERIODO: Record<string, string> = { '13/10/2026 - 02/11/2026': '2026-11-01' };

/** Último dia válido do ciclo deste arquivo (AAAA-MM-DD), ou null quando o período do filtro já está certo. */
function fimRealDoCiclo(wb: XLSX.WorkBook): string | null {
  const aba = wb.SheetNames.find(n => /^FILTROS$/i.test(n.trim()));
  if (!aba) return null;
  const filtros = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[aba], { header: 1 });
  for (const f of filtros) {
    const fim = FIM_REAL_POR_PERIODO[texto(f[1])];
    if (fim) return fim;
  }
  return null;
}

const MESES_ABREVIADOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2 Nov 2026" → "2026-11-02". */
function diaIso(dia: string): string {
  const [d, mes, ano] = dia.split(' ');
  return `${ano}-${String(MESES_ABREVIADOS.indexOf(mes) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseServicosDiario(wb: XLSX.WorkBook): ServicoDiaRow[] {
  const rows = linhas(wb, 'Dia');
  const h = linhaCabecalho(rows, 'Período de Referência');
  if (h < 0) return [];
  const fim = fimRealDoCiclo(wb);
  return corpo(rows, h).map(r => ({
    dia: texto(r[0]),
    completos: toNum(r[1]),
    incompletos: toNum(r[2]),
    realizados: toNum(r[3]),
    completudePct: toPct(r[4]),
  })).filter(d => !fim || diaIso(d.dia) <= fim);
}

/** Só o que as telas usam: são 12 mil linhas. DESCONTO fica de fora, a coluna mistura sinais sem regra aparente. */
function parseBsoDetalhe(wb: XLSX.WorkBook): BsoRow[] {
  const rows = linhas(wb);
  const h = linhaCabecalho(rows, 'CICLO');
  if (h < 0) return [];
  const col = (nome: string) => posicoes(rows[h], nome)[0] ?? -1;
  const [iPdv, iData, iSku, iCamp, iId, iGerado, iVolume] =
    ['PDV', 'DATA MOVIMENTAÇÃO', 'SKU', 'CAMPANHA', 'ID. DA CAMPANHA', 'GERADO', 'VOLUME'].map(col);
  // GERADO vem com ponto decimal, inclusive como texto; toNum leria o ponto como milhar.
  const decimal = (v: unknown) => (typeof v === 'number' ? v : Number.parseFloat(texto(v)) || 0);
  const fim = fimRealDoCiclo(wb);
  return corpo(rows, h).map(r => ({
    pdv: texto(r[iPdv]),
    data: texto(r[iData]),
    sku: texto(r[iSku]),
    campanha: texto(r[iCamp]),
    idCampanha: texto(r[iId]),
    gerado: decimal(r[iGerado]),
    volume: decimal(r[iVolume]),
  })).filter(l => !fim || l.data <= fim);
}

function parseBsoTotalCiclo(wb: XLSX.WorkBook): number | null {
  const rows = linhas(wb);
  const h = linhaCabecalho(rows, 'PDV');
  if (h < 0) return null;
  const col = posicoes(rows[h], 'VALOR GERADO')[0];
  const dados = rows.slice(h + 1).filter(r => texto(r[col]) !== '');
  return dados.length > 0 ? dados.reduce((s, r) => s + (numero(r[col]) ?? 0), 0) : null;
}

/** Lê o relatório, grava no campo do dataset e devolve o campo e a contagem para a tela de importação. */
export function aplicarRelatorioExtranet(
  relatorio: RelatorioExtranet,
  wb: XLSX.WorkBook,
  d: LojaExtranetCampos,
): { campo: LojaExtranetFile; linhas: number } {
  switch (relatorio) {
    case 'indicadoresLoja':
      d.indicadoresLoja = { benchmark: parseBenchmark(wb), pdv: parseMetricasPdv(wb), consultor: parseIndicadoresConsultor(wb) };
      return { campo: 'indicadoresLoja', linhas: d.indicadoresLoja.benchmark.length + d.indicadoresLoja.pdv.length + d.indicadoresLoja.consultor.length };
    case 'idCliente':
      d.idCliente = { benchmark: parseBenchmark(wb), pdv: parseMetricasPdv(wb), consultor: parseIdClienteConsultor(wb) };
      return { campo: 'idCliente', linhas: d.idCliente.benchmark.length + d.idCliente.pdv.length + d.idCliente.consultor.length };
    case 'idClienteEvolucao':
      d.idClienteEvolucao = parseIdClienteEvolucao(wb);
      return { campo: 'idClienteEvolucao', linhas: d.idClienteEvolucao.length };
    case 'boletoResumo':
      d.boletoResumo = parseBoletoResumo(wb);
      return { campo: 'boletoResumo', linhas: d.boletoResumo.length };
    case 'boletoPromocional':
      d.boletoPromocional = porNivel(wb, lerPromocional);
      return { campo: 'boletoPromocional', linhas: d.boletoPromocional.pdv.length + d.boletoPromocional.consultor.length };
    case 'boletoTurbinado':
      d.boletoTurbinado = porNivel(wb, lerTurbinado);
      return { campo: 'boletoTurbinado', linhas: d.boletoTurbinado.pdv.length + d.boletoTurbinado.consultor.length };
    case 'abastecimento':
      d.abastecimento = parseAbastecimento(wb);
      return { campo: 'abastecimento', linhas: d.abastecimento.length };
    case 'itensPorBoleto':
      d.itensPorBoleto = porNivel(wb, lerItensPorBoleto);
      return { campo: 'itensPorBoleto', linhas: d.itensPorBoleto.pdv.length + d.itensPorBoleto.consultor.length };
    case 'mobshop':
      d.mobshop = porNivel(wb, lerMobshop);
      return { campo: 'mobshop', linhas: d.mobshop.pdv.length + d.mobshop.consultor.length };
    case 'categoriaDistribuicao':
      d.categoriaDistribuicao = parseCategorias(wb);
      return { campo: 'categoriaDistribuicao', linhas: d.categoriaDistribuicao.pdv.length + d.categoriaDistribuicao.consultor.length };
    case 'fidelidadeEvolucaoIdentificados':
    case 'fidelidadeEvolucaoResgate':
    case 'fidelidadeEvolucaoDesafio': {
      const chave = ({ fidelidadeEvolucaoIdentificados: 'identificados', fidelidadeEvolucaoResgate: 'resgate', fidelidadeEvolucaoDesafio: 'desafio' } as const)[relatorio];
      d.fidelidadeEvolucao = { ...d.fidelidadeEvolucao, [chave]: parseFidelidadeEvolucao(wb) };
      return { campo: 'fidelidadeEvolucao', linhas: Object.values(d.fidelidadeEvolucao).filter(Boolean).length };
    }
    case 'fidelidadeDistribuicaoIdentificados':
    case 'fidelidadeDistribuicaoResgate': {
      const chave = relatorio === 'fidelidadeDistribuicaoResgate' ? 'resgate' : 'identificados';
      d.fidelidadeDistribuicao = { ...d.fidelidadeDistribuicao, [chave]: parseFidelidadeDistribuicao(wb) };
      const blocos = Object.values(d.fidelidadeDistribuicao).filter((b): b is FidelidadeDistribuicaoBloco => !!b);
      return { campo: 'fidelidadeDistribuicao', linhas: blocos.reduce((s, b) => s + b.pdv.length + b.consultor.length, 0) };
    }
    case 'lojaDigitalConversao': {
      const r = corpo(linhas(wb), 1)[0] ?? [];
      d.lojaDigitalCiclo = { ...d.lojaDigitalCiclo, encaminhados: toNum(r[1]), atendidos: toNum(r[2]), convertidos: toNum(r[3]), conversaoPct: toPct(r[4]) };
      return { campo: 'lojaDigitalCiclo', linhas: 1 };
    }
    case 'lojaDigitalReceita': {
      const r = corpo(linhas(wb), 1)[0] ?? [];
      d.lojaDigitalCiclo = { ...d.lojaDigitalCiclo, receitaAnterior: toNum(r[1]), receitaAtual: toNum(r[2]) };
      return { campo: 'lojaDigitalCiclo', linhas: 1 };
    }
    case 'lojaDigitalTme': {
      const r = corpo(linhas(wb), 1)[0] ?? [];
      d.lojaDigitalCiclo = { ...d.lojaDigitalCiclo, tmeBruto: texto(r[1]), tmeAjustado: texto(r[2]), tmeRegional: texto(r[3]) };
      return { campo: 'lojaDigitalCiclo', linhas: 1 };
    }
    case 'servicosDiario':
      d.servicosDiario = parseServicosDiario(wb);
      return { campo: 'servicosDiario', linhas: d.servicosDiario.length };
    case 'rupturaCausaFranqueado':
    case 'rupturaDetalhada': {
      const resumo = relatorio === 'rupturaDetalhada' ? parseRupturaDetalhadaXlsx(wb) : parseRupturaCausaFranqueadoXlsx(wb);
      const atual = d.ruptura?.resumo ?? null;
      // A detalhada traz tudo o que a de causa franqueado traz: não pode ser sobrescrita por ela.
      const mesclado = relatorio === 'rupturaDetalhada' ? resumo : atual ?? resumo;
      d.ruptura = { resumo: mesclado, itens: d.ruptura?.itens ?? [] };
      return { campo: 'ruptura', linhas: d.ruptura.itens.length };
    }
    case 'rupturaPorItem':
      d.ruptura = { resumo: d.ruptura?.resumo ?? null, itens: parseRupturaPorItemXlsx(wb) };
      return { campo: 'ruptura', linhas: d.ruptura.itens.length };
    case 'bsoDetalhe':
      d.bso = { totalPorCiclo: d.bso?.totalPorCiclo ?? null, linhas: parseBsoDetalhe(wb) };
      return { campo: 'bso', linhas: d.bso.linhas.length };
    case 'bsoPorCiclo':
      d.bso = { totalPorCiclo: parseBsoTotalCiclo(wb), linhas: d.bso?.linhas ?? [] };
      return { campo: 'bso', linhas: d.bso.linhas.length };
  }
}
