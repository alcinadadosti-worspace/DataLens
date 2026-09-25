export interface Order {
  CodigoPedido: string;
  SituacaoFiscal: string;
  Pessoa: string;
  NomePessoa: string;
  Papel: string;
  tierId: string; // mapped from Papel
  QtdeMateriais: number;
  ValorPraticado: number;
  ValorLiquido: number;
  MeioCaptacao: string;
  ModeloComercial: string;
  SituacaoComercial: string;
  DetalheSituacaoComercial: string;
  DataCaptacao: string;
  DataAprovacao: string;
  DataAutorizacaoFaturamento: string;
  DataEntrega: string;
  CicloMarketing: string;
  DiaDoCiclo: string;
  Estrutura: string;
  CodEstrutura: string;
  CodEstruturaPai: string;
  ResponsavelEstrutura: string;
  TelefoneResponsavel: string;
  UsuarioCriacao: string;
  UsuarioFinalizacao: string;
  Logradouro: string;
  Bairro: string;
  Cidade: string;
  UF: string;
  CEP: string;
  LogradouroEntrega: string;
  BairroEntregaRetirada: string;
  CidadeEntregaRetirada: string;
  UFEntregaRetirada: string;
  CEPEntregaRetirada: string;
  PesoReal: number;
  CodModeloComercial: string;

  // Campos adicionados no lote Ciclo 13 (ConsultaPedidos com 89 colunas) — ver LEITURA_PLANILHAS_VD.md §2.1
  CaptacaoRestrita: string;
  CicloIndicador: string;
  CicloCancelamento: string;
  DetalheMeioCaptacao: string;
  CodUsuarioCriacao: string;
  CodUsuarioFinalizacao: string;
  PlanoPagamento: string;
  TipoEntrega: string;
  EstruturaPai: string;
  CodTransportadora: string;
  Transportadora: string;
  CategoriaDispositivo: string;
  PedidoRelacionado: string;
  TipoRelacionamento: string;
}

export interface ParseResult {
  orders: Order[];
  errors: string[];
  rowCount: number;
  /** Pedidos de estrutura FVC no lote — informativo. FVC não é mais excluído do dataset (decisão: os totais oficiais do BI corporativo só batem incluindo FVC). */
  fvcCount: number;
  detectedColumns: string[];
}
