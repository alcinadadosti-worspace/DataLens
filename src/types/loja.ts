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
}
