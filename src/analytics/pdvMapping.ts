import { Order } from '../types/order';

/**
 * Código do PDV do pedido, tirado do prefixo de `EstruturaPai` ("13707 - ACQUA DISTRIBUIDORA ...") —
 * o mesmo código que os relatórios corporativos usam (ReceitaCanalVD_Performance_por_PDV,
 * Monitoramento, Sell-In). Antes o PDV era inferido pela cidade do revendedor, o que deixava de fora
 * quem mora fora da cidade-sede (Coruripe, Teotônio Vilela...) e não casava "PALMEIRA DOS ÍNDIOS"
 * com o "Palmeira Dos Indios" do relatório. `null` quando o extrato não traz a estrutura (os pedidos
 * `Modelo - OMNIChannel` vêm sem `EstruturaPai`).
 */
export function pdvForOrder(order: Pick<Order, 'EstruturaPai'>): string | null {
  const m = /^\s*(\d+)\s*-/.exec(order.EstruturaPai ?? '');
  return m ? m[1] : null;
}
