export type LojaDimension = 'lojas' | 'forma' | 'consultor' | 'operador' | 'data' | 'canal' | 'gestao';

export interface LojaMetricRow {
  lojaCodigo: string | null;
  lojaNome: string;
  quebraCodigo: string | null;
  quebraNome: string;
  gmv: number;
  boletoMedio: number;
  qtdBoletos: number;
  itensPorBoleto: number;
  receitaLiquida: number;
  receitaLiquidaSemTrocas: number;
  vendasB1: number;
  fidelidadeQtdBoletos: number;
  fidelidadePenetracao: number;
  totalDescontos: number;
  trocasValor: number;
  qtdTrocas: number;
  cartaoRecarga: number;
  quantitativoB1: number;
}

// --- Arquivos opcionais (curva ABC, gestão de pedidos, venda por hora, xlsx de performance) ---

export type LojaOptionalFile =
  | 'abc'
  | 'vendaPorHora'
  | 'pedidosVisaoGeral'
  | 'pedidosGiroCanais'
  | 'pedidosHistorico'
  | 'resumoPerformance'
  | 'receitaCanal'
  | 'receitaCategoria';

export const LOJA_OPTIONAL_FILES: LojaOptionalFile[] = [
  'abc',
  'vendaPorHora',
  'pedidosVisaoGeral',
  'pedidosGiroCanais',
  'pedidosHistorico',
  'resumoPerformance',
  'receitaCanal',
  'receitaCategoria',
];

export const LOJA_OPTIONAL_FILE_LABELS: Record<LojaOptionalFile, string> = {
  abc: 'Curva ABC de produtos',
  vendaPorHora: 'Venda por hora',
  pedidosVisaoGeral: 'Gestão de pedidos — visão geral',
  pedidosGiroCanais: 'Gestão de pedidos — giro por canal',
  pedidosHistorico: 'Gestão de pedidos — histórico de colocação',
  resumoPerformance: 'Resumo de performance (indicadores)',
  receitaCanal: 'Receita por canal / UN',
  receitaCategoria: 'Receita por categoria/subcategoria/marca',
};

/** Curva ABC (relatorioABCVenda*.csv) — uma linha por SKU x data (agregar por SKU para o ranking). */
export interface AbcRow {
  data: string;
  lojaCodigo: string | null;
  lojaNome: string | null; // preenchido só quando Quebra2 tem a loja (arquivo aberto por loja)
  codigo: string;
  descricao: string;
  quantidade: number;
  faturamento: number;
  custo: number;
  lucro: number;
  margem: number;
  markup: number;
  classificacao: string; // A/B/C já vindo do sistema, se houver
}

/** Venda por hora (relatorioVendaPorHora.csv) — loja x data x faixa horária. */
export interface VendaHoraRow {
  lojaCodigo: string | null;
  lojaNome: string;
  data: string;
  faixaHoraria: string;
  receitaLiquida: number;
  qtdBoletos: number;
}

/** GestaoPedidos_Visao_Geral_por_Ciclo — consolidado do ciclo. */
export interface PedidoVisaoGeralRow {
  label: string;
  metaSugestao: number;
  volumeColocado: number;
  volumeFaturado: number;
  vendaReal: number;
  giro: number;
}

/**
 * GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo — o arquivo real traz uma linha "GERAL" (todos os
 * canais da rede) e uma linha "LOJA" (só o canal físico), cada uma com seu próprio volume e giro
 * — não é "por canal de venda" no sentido de forma/canal comercial, é esse recorte específico.
 */
export interface PedidoGiroCanalRow {
  escopo: string; // "GERAL" ou "LOJA", como vem no arquivo
  volumePedido: number;
  volumeFaturado: number;
  giroPct: number;
}

/** GestaoPedidos_Historico_Colocacao_Pedido — linha a linha por loja/SKU. */
export interface PedidoHistoricoRow {
  lojaCodigo: string | null;
  lojaNome: string;
  sku: string;
  categoria: string | null;
  volumeSugestao: number;
  volumeColocado: number;
  volumeFaturado: number;
}

/** Receita_por_Canal_UN.xlsx — receita GMV+Omni por canal/UN, ciclo atual vs. anterior. */
export interface ReceitaCanalRow {
  canal: string;
  receitaAtual: number;
  receitaAnterior: number;
  variacaoPct: number;
  participacaoPct: number;
}

/** Receita_por_Cat_Sub_Mar.xlsx — uma linha por categoria/subcategoria/linha/marca. */
export interface ReceitaCategoriaRow {
  nome: string;
  receitaAtual: number;
  receitaAnterior: number;
  variacaoPct: number;
  participacaoPct: number;
}

export type ReceitaCategoriaAba = 'categoria' | 'subcategoria' | 'linha' | 'marca';

export interface ReceitaCategoriaDataset {
  categoria: ReceitaCategoriaRow[];
  subcategoria: ReceitaCategoriaRow[];
  linha: ReceitaCategoriaRow[];
  marca: ReceitaCategoriaRow[];
}

/** Resumo_de_Performance_Indicadores_Loja.xlsx — aba CP (consolidado) e PDV/CONSULTOR (por loja/consultor). */
export interface ResumoPerformanceRow {
  nome: string;
  receita: number;
  vsMetaPEFPct: number | null;
  vsAnoAnteriorPct: number | null;
  boletos: number | null;
  ticketMedio: number | null;
}

/**
 * Aba CP do Resumo_de_Performance: NÃO é "uma linha por loja" — é uma linha por indicador
 * (Receita Total, Quantidade de Boletos, Boleto Médio...), com Meta PEF/Realizado/variações
 * em colunas. Formato bem diferente das abas PDV/CONSULTOR (essas sim, uma linha por entidade).
 */
export interface ResumoPerformanceIndicador {
  indicador: string;
  metaPEF: number | null;
  realizado: number | null;
  vsMetaPEFPct: number | null;
  vsAnoPassadoPct: number | null;
}

export interface ResumoPerformanceDataset {
  periodo: string | null;
  cp: ResumoPerformanceIndicador[];
  pdv: ResumoPerformanceRow[];
  consultor: ResumoPerformanceRow[];
}

export interface LojaDataset {
  lojas: LojaMetricRow[];
  forma: LojaMetricRow[];
  consultor: LojaMetricRow[];
  operador: LojaMetricRow[];
  data: LojaMetricRow[];
  canal: LojaMetricRow[];
  gestao: LojaMetricRow[];
  fileNames: Partial<Record<LojaDimension, string>>;
  importedAt: Date;

  // Opcionais — nem sempre presentes no lote
  abc?: AbcRow[];
  vendaPorHora?: VendaHoraRow[];
  pedidosVisaoGeral?: PedidoVisaoGeralRow[];
  pedidosGiroCanais?: PedidoGiroCanalRow[];
  pedidosHistorico?: PedidoHistoricoRow[];
  resumoPerformance?: ResumoPerformanceDataset;
  receitaCanal?: ReceitaCanalRow[];
  receitaCategoria?: ReceitaCategoriaDataset;
  optionalFileNames?: Partial<Record<LojaOptionalFile, string>>;
}

export const LOJA_DIMENSIONS: LojaDimension[] = ['lojas', 'forma', 'consultor', 'operador', 'data', 'canal', 'gestao'];

export const LOJA_DIMENSION_LABELS: Record<LojaDimension, string> = {
  lojas: 'Lojas',
  forma: 'Forma de pagamento',
  consultor: 'Consultor',
  operador: 'Operador',
  data: 'Data',
  canal: 'Canal de venda',
  gestao: 'Gestão estratégica',
};

export interface LojaParseResult {
  dataset: LojaDataset | null;
  detected: Partial<Record<LojaDimension, { fileName: string; rowCount: number }>>;
  detectedOptional: Partial<Record<LojaOptionalFile, { fileName: string; rowCount: number }>>;
  errors: string[];
}

export interface AggregatedRow {
  key: string;
  gmv: number;
  qtdBoletos: number;
  receitaLiquida: number;
  totalDescontos: number;
  trocasValor: number;
  qtdTrocas: number;
  ticketMedio: number;
  descontoPct: number;
  participacaoPct: number;
  /** Código(s) de loja onde essa chave aparece nos dados de origem (ex. lojas de um consultor). */
  lojaCodigos: string[];
}
