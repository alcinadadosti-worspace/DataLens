import { Order } from '../types/order';

/**
 * Pedido de estrutura FVC — o nome da estrutura começa com "FVC" (ex. "FVC - 13707 - A - ALCINA MARIA 1").
 * Os pedidos FVC continuam no dataset (a receita oficial do BI só bate com eles incluídos); a Visão
 * geral os deixa de fora e a participação deles fica na tela FVC.
 */
export function isFVCOrder(order: Pick<Order, 'Estrutura'>): boolean {
  return (order.Estrutura ?? '').trimStart().toUpperCase().startsWith('FVC');
}
