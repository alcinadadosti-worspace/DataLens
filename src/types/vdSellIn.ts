/**
 * Família B — meta de Sell-In (reposição de estoque franqueado ↔ indústria), domínio que não existe
 * em nenhum outro lugar do Modo VD. Mesmo formato de arquivo já resolvido no Modo Loja
 * (`src/types/loja.ts` — PedidoMetaSellInRow/PedidoDetalhamentoSkuRow); tipos duplicados aqui (não
 * importados) para manter os dois modos desacoplados, seguindo o padrão já existente no repo.
 */

/** GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv — 1 linha por ciclo, total da rede (sugestão vs. realizado). */
export interface VDSellInMetaRow {
  ciclo: string;
  sugestaoComercial: number;
  pedidoRealizado: number;
}

/** GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv — grão Ciclo x PDV x SKU. */
export interface VDSellInDetalheSkuRow {
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
