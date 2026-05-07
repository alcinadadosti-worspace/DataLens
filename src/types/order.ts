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
}

export interface ParseResult {
  orders: Order[];
  errors: string[];
  rowCount: number;
  detectedColumns: string[];
}
