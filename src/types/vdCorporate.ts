/**
 * Família C — 14 relatórios de BI corporativo pré-agregados (pivots), todos com uma aba `FILTROS`
 * de metadado e uma ou mais abas de dado com cabeçalho às vezes em múltiplas linhas mescladas.
 * Ver LEITURA_PLANILHAS_VD.md §4 para a estrutura original observada em cada arquivo.
 */

/** Metadado lido da aba `FILTROS` — contexto de um relatório de Família C. */
export interface ReportContext {
  tipoReceita: string | null;
  cicloAtual: string | null;
  cicloAnterior: string | null;
  cp: string | null;
  pdvFiltro: string | null;
  canalFiltro: string | null;
  unFiltro: string | null;
}

// --- Receita ---

/** Um bloco (VD / OMNI ENVIO ER / TOTAL) dentro de uma linha de ReceitaCanalVD_Performance_por_PDV. */
export interface ReceitaCanalVDBlock {
  receitaAnterior: number;
  receitaAtual: number;
  metaPef: number;
  gapAcordadoValor: number;
  gapAcordadoPct: number | null;
  realizadoPct: number | null;
}

/** ReceitaCanalVD_Performance_por_PDV.xlsx — uma linha por PDV (+ linha TOTAL), blocos VD/OMNI/Total. */
export interface ReceitaCanalVDPdvRow {
  un: string;
  pdvCodigo: string | null;
  cidade: string;
  localPdv: string;
  vd: ReceitaCanalVDBlock;
  omni: ReceitaCanalVDBlock;
  total: ReceitaCanalVDBlock;
}

export interface ReceitaCanalVDUnRow {
  un: string;
  meta: number;
  realizado: number;
  anterior: number;
  variacaoPct: number;
  /** Composição Venda Direta x Omni Envio ER específica dessa UN (cada UN tem seu próprio bloco no arquivo). */
  composicao: { nome: string; realizado: number; anterior: number }[];
}

/** ReceitaCanalVD_por_UN.xlsx — meta/realizado do CP inteiro, quebra por UN (cada uma com sua própria composição VD x OMNI). */
export interface ReceitaCanalVDUnDataset {
  totalMeta: number;
  totalRealizado: number;
  totalAnterior: number;
  totalVariacaoPct: number;
  porUn: ReceitaCanalVDUnRow[];
  /** Soma da composição de todas as UNs — visão consolidada VD x Omni do CP inteiro. */
  composicaoTotal: { nome: string; realizado: number; anterior: number }[];
}

/** ReceitaCanalVD_por_Periodo.xlsx — neste lote só tem a aba FILTROS; parser tolera lista vazia. */
export interface ReceitaCanalVDPeriodoRow {
  data: string;
  receita: number;
}

/** Receita_por_Periodo.xlsx — abas DIA/MÊS, receita anterior vs. atual por dia/mês (+ linha TOTAL). */
export interface ReceitaPeriodoRow {
  label: string; // "31 Ago 2026" ou "Ago 2026" ou "TOTAL"
  receitaAnterior: number;
  receitaAtual: number;
  variacaoPct: number;
}

export interface ReceitaPeriodoDataset {
  dia: ReceitaPeriodoRow[];
  mes: ReceitaPeriodoRow[];
}

/** Receita_por_Canal_UN.xlsx (legado) — canal (Loja/Venda Direta/Omnichannel) e sub-linhas por UN indentadas. */
export interface ReceitaCanalUnRow {
  canal: string;
  receitaAnterior: number;
  receitaAtual: number;
  variacaoPct: number;
  /** true para as sub-linhas indentadas (ex. "  Venda Direta BOT"), sinalizando que é um recorte de UN dentro do canal acima. */
  indent: boolean;
}

/** Receita_por_Cat_Sub_Mar.xlsx — uma linha por categoria/subcategoria/linha/marca (+ linha TOTAL). */
export interface VDReceitaCategoriaRow {
  nome: string;
  receitaAnterior: number;
  receitaAtual: number;
  variacaoPct: number;
  participacaoAnteriorPct: number;
  participacaoAtualPct: number;
}

export interface VDReceitaCategoriaDataset {
  categoria: VDReceitaCategoriaRow[];
  subcategoria: VDReceitaCategoriaRow[];
  linha: VDReceitaCategoriaRow[];
  marca: VDReceitaCategoriaRow[];
}

// --- Ruptura ---

/**
 * RupturaVD_Ruptura_causa_franqueado.xlsx + RupturaVD_Ruptura_detalhada_ciclo.xlsx — cada um traz
 * 1 linha só; consolidados num único objeto porque descrevem o mesmo ciclo do mesmo ponto de vista
 * (o "causa_franqueado" repete o número de "% RUPTURA CF (IAF)" do "detalhada_ciclo").
 */
export interface RupturaResumoRow {
  ciclo: string;
  rupturaTotalPct: number | null;
  metaRupturaAnual: number | null;
  rupturaCausaFranqueadoPct: number | null;
  rupturaCausaIndustriaPct: number | null;
}

/** RupturaVD_detalhamento_ruptura_por_item.xlsx — amostra de SKUs monitorados (não é o catálogo completo). */
export interface RupturaItemRow {
  ciclo: string;
  pdvCodigo: string;
  canal: string;
  sku: string;
  volumeItens: number;
  causaRuptura: string; // "-" ou "Causa Franqueado"
  rupturaPct: number;
}

// --- Base de revendedores ---

/** VendaDireta_Evolucao_da_base.xlsx — 1 linha, só ciclo atual. */
export interface EvolucaoBaseRow {
  ciclo: string;
  baseAtiva: number;
  inicios: number;
  reinicios: number;
  baseMultimarca: number;
  baseMultimarcaPct: number;
}

/** VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx — uma linha por PDV ou por supervisor. */
export interface MonitoramentoBaseRow {
  chave: string; // código do PDV ou nome do supervisor (inclui a linha "TOTAL")
  baseTotal: number;
  baseAtiva: number;
  ativosBaseTotal: number;
  baseMultimarca: number;
  rpa: number; // receita por ativo
  inativosI1I3: number;
  inativosI4I6: number;
  atividadePct: number;
  churnPct: number;
  inicios: number;
  reinicios: number;
  i6Recuperados: number;
  perdaBase: number;
}

export interface MonitoramentoBaseDataset {
  porPdv: MonitoramentoBaseRow[];
  porSupervisor: MonitoramentoBaseRow[];
}

/** VendaDireta_penetracao_base.xlsx — métricas de base, período anterior vs. atual, uma linha por métrica. */
export interface PenetracaoBaseRow {
  metrica: string;
  periodoAnterior: number;
  pctPenetracaoAnterior: number;
  periodoAtual: number;
  pctPenetracaoAtual: number;
}

/** VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx — 1 linha larga; repique por UN/categoria vira lista. */
export interface PenetracaoAtivosDetalhadaRow {
  ciclo: string;
  cicloAnteriorPct: number;
  cicloAtualPct: number;
  baseTotal: number;
  baseAtiva: number;
  ativos: number;
  baseTotalMultimarca: number;
  baseTotalMultimarcaPct: number;
  ativosMultimarca: number;
  ativosMultimarcaPct: number;
  baseTotalMonomarca: number;
  baseTotalMonomarcaPct: number;
  ativosMonomarca: number;
  ativosMonomarcaPct: number;
  baseAtivaMultimarca: number;
  baseAtivaMultimarcaPct: number;
  baseAtivaMonomarca: number;
  baseAtivaMonomarcaPct: number;
  /**
   * Repique por UN (O Boticário, QDB, Eudora, OUI, FRJ) e por categoria (Make, Cuidados Faciais)
   * misturados no mesmo nível pelo arquivo original — não dá para separar "marca" de "categoria" só
   * pelos dados (ver LEITURA_PLANILHAS_VD.md §4.3), por isso fica como uma lista genérica de grupos.
   */
  porGrupo: { label: string; ativos: number; pct: number }[];
}

/**
 * VendaDireta_Ativas_por_tier.xlsx — apesar do nome do arquivo, `segmentoRecencia` (I1..I6) é tempo
 * de INATIVIDADE em ciclos consecutivos sem comprar, não um tier comercial (`tierId`/`TIER_STYLES`).
 * Ver decisão de produto: essa taxonomia fica separada da taxonomia visual de 10 tiers.
 */
export interface AtivasPorTierRow {
  segmentoRecencia: string; // "I1".."I6"
  cicloAnterior: number;
  cicloAtual: number;
  participacaoAnteriorPct: number;
  participacaoAtualPct: number;
}

/**
 * VendaDireta_Segmentacao_da_Base.xlsx (aba SEGMENTAÇÃO DA BASE CGB) — matriz recência (A0, I1-I6) ×
 * tier comercial do BI (11 categorias, incluindo BLUE e SEM CLASSIFICAÇÃO — taxonomia própria do BI,
 * não mapeada para `TIER_DEFINITIONS`/`papelToTierId`).
 */
export interface SegmentacaoBaseDataset {
  categorias: string[]; // ex.: BLUE, COBRE, BRONZE, PRATA, OURO, PLATINA, RUBI, ESMERALDA GB, DIAMANTE GB, REVENDEDOR, SEM CLASSIFICAÇÃO
  linhas: { segmento: string; valores: Record<string, { quantidade: number; participacaoPct: number }> }[];
}

/** VendaDireta_Detalhamento_de_Categorias_e_UN...xlsx — abas UN e CATEGORIA, penetração de ativos. */
export interface PenetracaoCategoriaUnRow {
  nome: string;
  ativosPeriodoAnterior: number;
  pctPenetracaoAnterior: number | null;
  ativosPeriodoAtual: number;
  pctPenetracaoAtual: number | null;
}

export interface DetalhamentoCategoriasUnDataset {
  un: PenetracaoCategoriaUnRow[];
  categoria: PenetracaoCategoriaUnRow[];
}

// --- Dataset agregado ---

export type VDCorporateFile =
  | 'receitaCanalVDPdv'
  | 'receitaCanalVDUn'
  | 'receitaCanalVDPeriodo'
  | 'receitaPeriodo'
  | 'receitaCanalUn'
  | 'receitaCategoria'
  | 'rupturaCausaFranqueado'
  | 'rupturaDetalhada'
  | 'rupturaPorItem'
  | 'evolucaoBase'
  | 'monitoramentoBase'
  | 'penetracaoBase'
  | 'penetracaoAtivosDetalhada'
  | 'ativasPorTier'
  | 'segmentacaoBase'
  | 'detalhamentoCategoriasUn'
  | 'sellInMeta'
  | 'sellInDetalheSku'
  | 'rankingVendas';

export const VD_CORPORATE_FILE_LABELS: Record<VDCorporateFile, string> = {
  receitaCanalVDPdv: 'Receita por canal — performance por PDV (VD x Omni)',
  receitaCanalVDUn: 'Receita por canal — meta por UN (VD x Omni)',
  receitaCanalVDPeriodo: 'Receita por canal — série por período',
  receitaPeriodo: 'Receita por período (dia/mês)',
  receitaCanalUn: 'Receita por canal/UN (legado)',
  receitaCategoria: 'Receita por categoria/subcategoria/linha/marca',
  rupturaCausaFranqueado: 'Ruptura — causa franqueado',
  rupturaDetalhada: 'Ruptura — detalhada do ciclo',
  rupturaPorItem: 'Ruptura — detalhamento por item',
  evolucaoBase: 'Evolução da base',
  monitoramentoBase: 'Monitoramento da base por PDV/Supervisor',
  penetracaoBase: 'Penetração de base',
  penetracaoAtivosDetalhada: 'Penetração de ativos detalhada',
  ativasPorTier: 'Ativas por segmento de recência (I1-I6)',
  segmentacaoBase: 'Segmentação da base (CGB)',
  detalhamentoCategoriasUn: 'Detalhamento de categorias e UN',
  sellInMeta: 'Meta de Sell-In por ciclo',
  sellInDetalheSku: 'Meta de Sell-In — detalhamento por SKU',
  rankingVendas: 'Ranking de vendas por item',
};

export interface VDCorporateDataset {
  importedAt: Date;
  fileNames: Partial<Record<VDCorporateFile, string>>;
  reportContexts: Partial<Record<VDCorporateFile, ReportContext>>;

  receitaCanalVDPdv?: ReceitaCanalVDPdvRow[];
  receitaCanalVDUn?: ReceitaCanalVDUnDataset;
  receitaCanalVDPeriodo?: ReceitaCanalVDPeriodoRow[];
  receitaPeriodo?: ReceitaPeriodoDataset;
  receitaCanalUn?: ReceitaCanalUnRow[];
  receitaCategoria?: VDReceitaCategoriaDataset;

  rupturaCausaFranqueado?: RupturaResumoRow;
  rupturaDetalhada?: RupturaResumoRow;
  rupturaPorItem?: RupturaItemRow[];

  evolucaoBase?: EvolucaoBaseRow[];
  monitoramentoBase?: MonitoramentoBaseDataset;
  penetracaoBase?: PenetracaoBaseRow[];
  penetracaoAtivosDetalhada?: PenetracaoAtivosDetalhadaRow;
  ativasPorTier?: AtivasPorTierRow[];
  segmentacaoBase?: SegmentacaoBaseDataset;
  detalhamentoCategoriasUn?: DetalhamentoCategoriasUnDataset;

  sellInMeta?: import('./vdSellIn').VDSellInMetaRow[];
  sellInDetalheSku?: import('./vdSellIn').VDSellInDetalheSkuRow[];

  rankingVendas?: import('./vdRanking').RankingVendaRow[];
}

export interface VDCorporateParseResult {
  dataset: VDCorporateDataset;
  detected: Partial<Record<VDCorporateFile, { fileName: string; rowCount: number }>>;
  errors: string[];
}
