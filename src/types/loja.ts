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
  | 'pedidosDetalhamentoSku'
  | 'pedidosMetaSellIn'
  | 'resumoPerformance'
  | 'receitaCanal'
  | 'receitaCategoria'
  | 'receitaCanalLojaPdv'
  | 'receitaCanalLojaUn'
  | 'receitaCanalLojaPeriodo'
  | 'servicos'
  | 'fidelidade'
  | 'lojaDigital'
  | 'cuidadosFaciais'
  | 'logisticaAdesaoResumo'
  | 'logisticaAdesaoDetalhe';

export const LOJA_OPTIONAL_FILES: LojaOptionalFile[] = [
  'abc',
  'vendaPorHora',
  'pedidosVisaoGeral',
  'pedidosGiroCanais',
  'pedidosHistorico',
  'pedidosDetalhamentoSku',
  'pedidosMetaSellIn',
  'resumoPerformance',
  'receitaCanal',
  'receitaCategoria',
  'receitaCanalLojaPdv',
  'receitaCanalLojaUn',
  'receitaCanalLojaPeriodo',
  'servicos',
  'fidelidade',
  'lojaDigital',
  'cuidadosFaciais',
  'logisticaAdesaoResumo',
  'logisticaAdesaoDetalhe',
];

export const LOJA_OPTIONAL_FILE_LABELS: Record<LojaOptionalFile, string> = {
  abc: 'Curva ABC de produtos',
  vendaPorHora: 'Venda por hora',
  pedidosVisaoGeral: 'Gestão de pedidos — visão geral',
  pedidosGiroCanais: 'Gestão de pedidos — giro por canal',
  pedidosHistorico: 'Gestão de pedidos — histórico de colocação',
  pedidosDetalhamentoSku: 'Gestão de pedidos — detalhamento de sell-in por SKU',
  pedidosMetaSellIn: 'Gestão de pedidos — meta de sell-in por ciclo',
  resumoPerformance: 'Resumo de performance (indicadores)',
  receitaCanal: 'Receita por canal / UN (legado)',
  receitaCategoria: 'Receita por categoria/subcategoria/marca',
  receitaCanalLojaPdv: 'Receita por canal — performance por PDV (Loja x Clique e Retire)',
  receitaCanalLojaUn: 'Receita por canal — meta por UN (Loja x Clique e Retire)',
  receitaCanalLojaPeriodo: 'Receita por canal — série por período',
  servicos: 'Serviços em loja',
  fidelidade: 'Programa Fidelidade — penetração de boleto',
  lojaDigital: 'Loja Digital — performance por PDV/consultor',
  cuidadosFaciais: 'Cuidados Faciais + Botik — receita por PDV/consultor',
  logisticaAdesaoResumo: 'Logística — adesão à plataforma (resumo)',
  logisticaAdesaoDetalhe: 'Logística — adesão à plataforma (detalhe por pedido)',
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

/**
 * GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo — grão Ciclo x PDV x SKU. Traz a
 * sugestão comercial de sell-in e o quanto foi de fato pedido, por SKU e por PDV — mais granular
 * que pedidosHistorico (que não separa por ciclo) e mais granular que pedidosMetaSellIn (que só
 * soma a rede toda).
 */
export interface PedidoDetalhamentoSkuRow {
  ciclo: string;
  pdvCodigo: string;
  skuCodigo: string;
  skuDescricao: string;
  marca: string;
  dataLimiteCaptacao: string;
  sugestaoComercial: number;
  pedidoRealizado: number;
  atingimentoMetaPct: number;
}

/** GestaoPedidos_Meta_Sell_In_Por_Ciclo — 1 linha por ciclo, total da rede (sugestão vs. realizado). */
export interface PedidoMetaSellInRow {
  ciclo: string;
  sugestaoComercial: number;
  pedidoRealizado: number;
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

/**
 * ReceitaCanalLoja_* — substituiu, nos lotes recebidos a partir de set/2026, a família
 * Receita_por_Canal_UN/Receita_por_Cat_Sub_Mar (mantida acima como `receitaCanal`/
 * `receitaCategoria` para compatibilidade com exports antigos). Aqui "canal" é o canal de
 * CUMPRIMENTO do pedido (Loja física vs. Clique e Retire) — não confundir com o "canal de venda"
 * (ativação) de `dataset.canal`, que é outra dimensão vinda de GerencialVendas-*CANAL.csv.
 */
export interface ReceitaCanalLojaBlock {
  receitaAnterior: number;
  receitaAtual: number;
  metaPef: number;
  gapAcordadoValor: number;
  gapAcordadoPct: number | null;
  realizadoPct: number | null;
}

/** ReceitaCanalLoja_Performance_por_PDV.xlsx — uma linha por PDV, com blocos Loja/Clique e Retire/Total. */
export interface ReceitaCanalLojaPdvRow {
  un: string;
  pdvCodigo: string | null;
  cidade: string;
  localPdv: string;
  loja: ReceitaCanalLojaBlock;
  cliqueRetire: ReceitaCanalLojaBlock;
  total: ReceitaCanalLojaBlock;
}

export interface ReceitaCanalLojaUnRow {
  un: string;
  meta: number;
  realizado: number;
  anterior: number;
  variacaoPct: number;
}

/** ReceitaCanalLoja_por_UN.xlsx — meta/realizado do CP inteiro, quebra por UN e composição Loja x Clique e Retire. */
export interface ReceitaCanalLojaUnDataset {
  totalMeta: number;
  totalRealizado: number;
  totalAnterior: number;
  totalVariacaoPct: number;
  porUn: ReceitaCanalLojaUnRow[];
  composicao: { nome: string; realizado: number; anterior: number }[];
}

/**
 * ReceitaCanalLoja_por_Periodo.xlsx — série temporal de receita. Em exports observados até agora
 * chegou apenas com a aba FILTROS (sem tabela de dados) — o parser tolera isso e retorna lista
 * vazia em vez de erro.
 */
export interface ReceitaCanalLojaPeriodoRow {
  data: string;
  receita: number;
}

/**
 * Uma métrica dentro do bloco repetido (Valor / Vs. Meta PEF / Vs. Período Anterior) das abas
 * PDV/CONSULTOR do Resumo de Performance — ex. "Penetração de Boleto Turbinado", "Resgate
 * Fidelidade", "Loja Digital Ativo - % de Atendimento". A aba CONSULTOR não tem coluna de Meta PEF
 * por métrica (só Vs. Período Anterior), então `vsMetaPEFPct` fica `null` nesses casos.
 */
export interface ResumoPerformanceMetricValue {
  metrica: string;
  valor: number | null;
  vsMetaPEFPct: number | null;
  vsAnoAnteriorPct: number | null;
  /**
   * Base de receita sobre a qual esse indicador é calculado, declarada pelo próprio arquivo
   * (linha de subheader "Tipo de Receita" logo abaixo do cabeçalho): "Receita GMV", "Receita
   * Líquida", "Receita Bruta Varejo" ou "N/A". Indicadores diferentes na MESMA linha usam bases
   * diferentes — nunca comparar dois indicadores como se fossem a mesma unidade sem checar isso.
   * `null` quando a planilha não declarou (raro).
   */
  tipoReceita: string | null;
}

/** Resumo_de_Performance_Indicadores_Loja.xlsx — aba CP (consolidado) e PDV/CONSULTOR (por loja/consultor). */
export interface ResumoPerformanceRow {
  nome: string;
  receita: number;
  vsMetaPEFPct: number | null;
  vsAnoAnteriorPct: number | null;
  boletos: number | null;
  ticketMedio: number | null;
  /** Todos os ~17-21 indicadores do bloco repetido da linha (inclui Receita de novo, redundante com os campos acima). */
  metricas: ResumoPerformanceMetricValue[];
}

/**
 * Aba CP do Resumo_de_Performance: NÃO é "uma linha por loja" — é uma linha por indicador
 * (Receita Total, Quantidade de Boletos, Boleto Médio...), com Meta PEF/Realizado/variações
 * em colunas. Formato bem diferente das abas PDV/CONSULTOR (essas sim, uma linha por entidade).
 */
export interface ResumoPerformanceIndicador {
  indicador: string;
  /** Base de receita declarada pela própria coluna "Tipo de Receita" da aba CP — ver o aviso em `ResumoPerformanceMetricValue.tipoReceita`. */
  tipoReceita: string | null;
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

/** Servicos_em_loja.xlsx — aba PDV: totais de serviços realizados/completos por loja. */
export interface ServicoPdvRow {
  pdvCodigo: string;
  habilitador: string;
  un: string;
  qtdRealizados: number;
  qtdIncompletos: number;
  qtdCompletos: number;
  qtdMeta: number;
  atingimentoPct: number;
  gmv: number;
}

/** Servicos_em_loja.xlsx — aba CONSULTANT: uma linha por consultor x tipo de serviço. */
export interface ServicoConsultorRow {
  consultor: string;
  pdvCodigo: string;
  servico: string;
  qtdRealizados: number;
  qtdSemCheckIn: number;
  qtdCompletos: number;
  gmv: number;
}

export interface ServicosDataset {
  pdv: ServicoPdvRow[];
  consultor: ServicoConsultorRow[];
}

/** ProgramaFidelidade_..._boleto_Fidelidade.xlsx — penetração do desafio Fidelidade nos boletos. */
export interface FidelidadeRow {
  nome: string;
  qtdBoletosDesafio: number;
  qtdBoletosFidelidade: number;
  penetracaoPct: number;
}

export interface FidelidadeDataset {
  cp: FidelidadeRow[]; // rede toda (uma linha, "CP ...")
  pdv: FidelidadeRow[];
  consultor: FidelidadeRow[];
}

/** LojaDigital_Performance_por_Pdv_Consultor.xlsx — funil de atendimento digital (WhatsApp/etc). */
export interface LojaDigitalRow {
  nome: string;
  pdvCodigo: string | null;
  clientesEncaminhados: number | null;
  clientesAtendidos: number;
  tmeAjustado: string;
  clientesConvertidos: number;
  conversaoPct: number;
  receita: number;
  boletoMedio: number;
}

export interface LojaDigitalDataset {
  pdv: LojaDigitalRow[];
  consultor: LojaDigitalRow[];
}

/**
 * Loja_cuidados_faciais_iaf.xlsx — receita de Cuidados Faciais + Botik dentro do GMV total,
 * quebrada por PDV/consultor. Cada linha traz blocos TOTAL / BOTIK / DEMAIS MARCAS lado a lado.
 */
export interface CuidadosFaciaisRow {
  nome: string;
  pdvCodigo: string | null;
  receitaTotal: number;
  receitaBotik: number;
  receitaDemaisMarcas: number;
}

export interface CuidadosFaciaisDataset {
  participacaoPct: number | null; // % da receita total que é Cuidados Faciais + Botik (rede toda, aba CP)
  pdv: CuidadosFaciaisRow[];
  consultor: CuidadosFaciaisRow[];
}

/** GestaoPedidos_usage-by-usage-category-adherence — resumo da adesão à plataforma logística por categoria, CP inteiro. */
export interface LogisticaAdesaoResumoRow {
  categoria: string;
  qtdPedidos: number;
  percentualPedidosPct: number;
}

/** GestaoPedidos_Visão_detalhada_da_utilização_por_pedido — 1 linha por pedido de transferência entre lojas. */
export interface LogisticaAdesaoDetalheRow {
  codigoPedido: string;
  pdvCodigo: string;
  categoriaAdesao: string;
  statusPrazo: string;
  cidadeOrigem: string;
  ufOrigem: string;
  cidadeDestino: string;
  ufDestino: string;
  statusPedido: string;
  dataAprovacao: string;
  dataFinalizacao: string;
  qtdDiasCorridosFinalizacao: number | null;
  qtdDiasUteisEntrega: number | null;
  qtdDiasUteisEmAberto: number | null;
  qtdDiasUteisLimiteEntrega: number | null;
  dataLimiteEntrega: string;
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
  pedidosDetalhamentoSku?: PedidoDetalhamentoSkuRow[];
  pedidosMetaSellIn?: PedidoMetaSellInRow[];
  resumoPerformance?: ResumoPerformanceDataset;
  receitaCanal?: ReceitaCanalRow[];
  receitaCategoria?: ReceitaCategoriaDataset;
  receitaCanalLojaPdv?: ReceitaCanalLojaPdvRow[];
  receitaCanalLojaUn?: ReceitaCanalLojaUnDataset;
  receitaCanalLojaPeriodo?: ReceitaCanalLojaPeriodoRow[];
  servicos?: ServicosDataset;
  fidelidade?: FidelidadeDataset;
  lojaDigital?: LojaDigitalDataset;
  cuidadosFaciais?: CuidadosFaciaisDataset;
  logisticaAdesaoResumo?: LogisticaAdesaoResumoRow[];
  logisticaAdesaoDetalhe?: LogisticaAdesaoDetalheRow[];
  optionalFileNames?: Partial<Record<LojaOptionalFile, string>>;
  /**
   * "Tipo de Receita" declarado na aba FILTROS de cada arquivo xlsx opcional importado (GMV,
   * Receita Líquida, Receita Bruta...) — só preenchido pros arquivos que de fato são sobre receita;
   * arquivos de Gestão de Pedidos ficam de fora do mapa (não têm esse filtro).
   */
  receitaBasesPorArquivo?: Partial<Record<LojaOptionalFile, string | null>>;
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
  /**
   * Penetração de boletos Fidelidade (já vinha nos CSVs obrigatórios desde sempre — coluna 20,
   * `LojaMetricRow.fidelidadePenetracao` — mas não era exibida em nenhuma tela). Média ponderada
   * por qtdBoletos entre as linhas agregadas. Não confundir com a penetração do "desafio"
   * Fidelidade, que vem do xlsx ProgramaFidelidade novo (ver FidelidadeRow.penetracaoPct) e mede
   * outra coisa: quantos desses boletos concluíram um desafio, não quantos são de cliente
   * cadastrado. (A coluna "Fidelidade-Qtd de boletos" do CSV não é uma contagem no mesmo universo
   * de qtdBoletos — em várias lojas ela é maior que o total de boletos —, então não dá pra somar
   * contagens entre linhas; por isso usamos a % já calculada pelo sistema, ponderada.)
   */
  fidelidadePenetracaoPct: number;
}
