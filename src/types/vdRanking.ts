/**
 * ConsultaRankingVendas.csv — grão item vendido (não pedido). Delimitador `|`, ~26 mil linhas.
 * Ver LEITURA_PLANILHAS_VD.md §2.2 para o problema de quebras de linha não escapadas no `NomeProduto`
 * de alguns SKUs, reparado em `vdRankingParser.ts` antes do parse linha-a-linha.
 */
export interface RankingVendaRow {
  gerencia: string; // franqueado (= EstruturaPai)
  setor: string; // equipe (= Estrutura)
  codigoRevendedora: string; // = Order.Pessoa
  nomeRevendedora: string;
  quantidadePontos: number;
  cicloCaptacao: string;
  cicloFaturamento: string;
  codigoProduto: string;
  nomeProduto: string;
  /** 'Venda' | 'Brinde' | 'Doação' — só 'Venda' deve entrar em métricas de receita. */
  tipo: string;
  dataCaptacao: string;
  quantidadeItens: number;
  faturamento: number;
  valorPraticado: number;
  valorVenda: number;
  meioCaptacao: string;
  tipoEntrega: string;
}

export interface RankingVendaParseResult {
  rows: RankingVendaRow[];
  errors: string[];
  rowCount: number;
  /** Quantos registros lógicos precisaram de reparo de linha quebrada. */
  repairedCount: number;
}
