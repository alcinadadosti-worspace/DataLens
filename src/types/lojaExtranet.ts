import { RupturaItemRow, RupturaResumoRow } from './vdCorporate';

/**
 * Relatórios da Extranet que entraram no Modo Loja a partir do Ciclo 15. Todos são opcionais e têm
 * parser próprio em `lojaExtranetParser.ts`. Detalhes de cada arquivo: LEITURA_PLANILHAS_VD.md §12.
 */

/** Posição e média de um grupo de comparação. Texto como veio no arquivo ("19º", "596.851,46"). */
export interface BenchmarkPosicao {
  ranking: string;
  media: string;
}

export interface BenchmarkGrupo {
  regional: BenchmarkPosicao;
  estado: BenchmarkPosicao;
  pais: BenchmarkPosicao;
}

/** Aba CP de Loja_Indicadores_de_Loja / Indicadores_ID_Cliente: o CP contra a média de cada grupo. */
export interface BenchmarkIndicador {
  indicador: string;
  /** Texto como veio no arquivo, já com a unidade ("416.346,96", "+7,75%", "00:09:38"). */
  resultado: string;
  foraDoClube: BenchmarkGrupo;
  dentroDoClube: BenchmarkGrupo;
}

/** Duração em segundos, percentual em fração (0,95 = 95%), demais em valor bruto. null = célula vazia. */
export interface MetricaCiclo {
  anterior: number | null;
  atual: number | null;
}

/** Uma linha por PDV com vários blocos "CICLO ANTERIOR | CICLO ATUAL | VARIAÇÃO", indexados por `chaveMetrica`. */
export interface PdvMetricasRow {
  pdv: string;
  metricas: Record<string, MetricaCiclo>;
}

export interface IndicadoresLojaConsultorRow {
  pdv: string;
  consultor: string;
  receita: number;
  boletos: number;
  boletosB1: number;
  boletoMedio: number;
  itens: number;
  itensPorBoleto: number;
  precoMedio: number;
  receitaMobshop: number;
  boletoMedioMobshop: number;
  /** Fração. */
  shareAlavancas: number;
}

export interface IndicadoresLojaDataset {
  benchmark: BenchmarkIndicador[];
  pdv: PdvMetricasRow[];
  consultor: IndicadoresLojaConsultorRow[];
}

export interface IdClienteConsultorRow {
  pdv: string;
  consultor: string;
  atendimentos: number;
  atendimentosCpf: number;
  atendimentosUsoIndevido: number;
  /** Fração; pode passar de 1, como no arquivo (atendimentos com CPF ÷ boletos). */
  atendimentosCpfPct: number;
  atendimentosUsoIndevidoPct: number;
  tmaSegundos: number;
  totalBoletos: number;
  boletosId: number;
  boletosUsoIndevido: number;
  boletosAbaixo2Min: number;
  boletosValidosPct: number;
  boletosUsoIndevidoPct: number;
  boletosAbaixo2MinPct: number;
}

export interface IdClienteDataset {
  benchmark: BenchmarkIndicador[];
  pdv: PdvMetricasRow[];
  consultor: IdClienteConsultorRow[];
}

export interface IdClienteEvolucaoRow {
  ciclo: string;
  totalBoletos: number;
  comId: number;
  semId: number;
  /** 0-100. */
  pct: number;
}

/** Loja_Boleto: uma linha por medida, ciclo anterior contra atual. */
export interface BoletoResumoRow {
  label: string;
  anterior: number;
  atual: number;
}

export interface BoletoPromocionalRow {
  nome: string;
  totalBoletos: number;
  elegiveis: number;
  elegiveisPct: number;
  convertidos: number;
  /** 0-100, sobre os boletos elegíveis. */
  convertidosPct: number;
  oficiais: number;
  flex: number;
  exaustao: number;
}

export interface BoletoTurbinadoRow {
  nome: string;
  totalBoletos: number;
  elegiveis: number;
  turbinados: number;
  oficiais: number;
  /** 0-100, sobre o total de boletos. */
  oficiaisPct: number;
  flex: number;
  exaustao: number;
}

export interface BoletoPorNivelDataset<T> {
  cp: T[];
  pdv: T[];
  consultor: T[];
}

export interface AbastecimentoRow {
  ciclo: string;
  metaSugestao: number;
  pedidoRealizado: number;
  pedidoFaturado: number;
  vendaReal: number;
  /** 0-100. */
  giroPct: number;
}

export interface ItensPorBoletoRow {
  nome: string;
  total: number;
  /** Boleto 1, 2, 3, 4 e 5+, nesta ordem. */
  quantidades: number[];
}

export interface MobshopRow {
  nome: string;
  /** 0-100. */
  aderenciaPct: number;
}

export interface CategoriaDistribuicaoRow {
  nome: string;
  total: number;
  /** Receita por macrocategoria, na ordem de `categorias` do dataset. */
  receitas: number[];
}

export interface CategoriaDistribuicaoDataset {
  categorias: string[];
  pdv: CategoriaDistribuicaoRow[];
  consultor: CategoriaDistribuicaoRow[];
}

/** Bloco de ProgramaFidelidade_Evolucao_*. Percentuais em 0-100; base pode não vir no arquivo. */
export interface FidelidadeEvolucaoBloco {
  pctAnterior: number;
  pctAtual: number;
  qtdAnterior: number;
  qtdAtual: number;
  baseAnterior: number | null;
  baseAtual: number | null;
}

export interface FidelidadeEvolucaoDataset {
  identificados?: FidelidadeEvolucaoBloco;
  resgate?: FidelidadeEvolucaoBloco;
  desafio?: FidelidadeEvolucaoBloco;
}

export interface FidelidadeDistribuicaoRow {
  nome: string;
  /** 0-100. */
  pct: number;
  qtd: number;
  base: number;
}

export interface FidelidadeDistribuicaoBloco {
  pdv: FidelidadeDistribuicaoRow[];
  consultor: FidelidadeDistribuicaoRow[];
}

export interface FidelidadeDistribuicaoDataset {
  identificados?: FidelidadeDistribuicaoBloco;
  resgate?: FidelidadeDistribuicaoBloco;
}

export interface LojaDigitalCicloDataset {
  encaminhados?: number;
  atendidos?: number;
  convertidos?: number;
  /** 0-100. */
  conversaoPct?: number;
  receitaAnterior?: number;
  receitaAtual?: number;
  tmeBruto?: string;
  tmeAjustado?: string;
  tmeRegional?: string;
}

export interface ServicoDiaRow {
  dia: string;
  completos: number;
  incompletos: number;
  realizados: number;
  /** 0-100. */
  completudePct: number;
}

export interface RupturaLojaDataset {
  resumo: RupturaResumoRow | null;
  itens: RupturaItemRow[];
}

export interface BsoRow {
  pdv: string;
  /** AAAA-MM-DD. */
  data: string;
  sku: string;
  campanha: string;
  idCampanha: string;
  gerado: number;
  volume: number;
}

export interface BsoDataset {
  /** Total da aba GeradoPorCiclo. No Ciclo 15 inclui 02/11, dia cortado das linhas (R$ 30,36 a mais que a soma delas). */
  totalPorCiclo: number | null;
  linhas: BsoRow[];
}

/** Campos opcionais que os relatórios acima acrescentam ao `LojaDataset`. */
export interface LojaExtranetCampos {
  indicadoresLoja?: IndicadoresLojaDataset;
  idCliente?: IdClienteDataset;
  idClienteEvolucao?: IdClienteEvolucaoRow[];
  boletoResumo?: BoletoResumoRow[];
  boletoPromocional?: BoletoPorNivelDataset<BoletoPromocionalRow>;
  boletoTurbinado?: BoletoPorNivelDataset<BoletoTurbinadoRow>;
  abastecimento?: AbastecimentoRow[];
  itensPorBoleto?: BoletoPorNivelDataset<ItensPorBoletoRow>;
  mobshop?: BoletoPorNivelDataset<MobshopRow>;
  categoriaDistribuicao?: CategoriaDistribuicaoDataset;
  fidelidadeEvolucao?: FidelidadeEvolucaoDataset;
  fidelidadeDistribuicao?: FidelidadeDistribuicaoDataset;
  lojaDigitalCiclo?: LojaDigitalCicloDataset;
  servicosDiario?: ServicoDiaRow[];
  ruptura?: RupturaLojaDataset;
  bso?: BsoDataset;
}

export type LojaExtranetFile = keyof LojaExtranetCampos;

export const LOJA_EXTRANET_FILES: LojaExtranetFile[] = [
  'indicadoresLoja',
  'idCliente',
  'idClienteEvolucao',
  'boletoResumo',
  'boletoPromocional',
  'boletoTurbinado',
  'abastecimento',
  'itensPorBoleto',
  'mobshop',
  'categoriaDistribuicao',
  'fidelidadeEvolucao',
  'fidelidadeDistribuicao',
  'lojaDigitalCiclo',
  'servicosDiario',
  'ruptura',
  'bso',
];

export const LOJA_EXTRANET_FILE_LABELS: Record<LojaExtranetFile, string> = {
  indicadoresLoja: 'Indicadores de Loja (comparativo da rede)',
  idCliente: 'Indicadores ID Cliente',
  idClienteEvolucao: 'ID Cliente — evolução de boletos',
  boletoResumo: 'Boleto — faixas de valor e itens',
  boletoPromocional: 'Boleto Promocional',
  boletoTurbinado: 'Boleto Turbinado',
  abastecimento: 'Abastecimento de promocionais e turbinados',
  itensPorBoleto: 'Distribuição de itens por boleto',
  mobshop: 'Receita transacionada no Mobshop',
  categoriaDistribuicao: 'Distribuição da receita por macrocategoria',
  fidelidadeEvolucao: 'Programa Fidelidade — evolução (3 arquivos)',
  fidelidadeDistribuicao: 'Programa Fidelidade — identificados e resgate (2 arquivos)',
  lojaDigitalCiclo: 'Loja Digital — conversão, receita e TME por ciclo (3 arquivos)',
  servicosDiario: 'Total de serviços por dia',
  ruptura: 'Ruptura (3 arquivos)',
  bso: 'Relatório BSO — valor gerado por campanha (2 arquivos)',
};
