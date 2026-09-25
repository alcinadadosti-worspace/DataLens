import { VDCorporateDataset } from '../types/vdCorporate';

/**
 * O Modo VD não tem uma coluna de PDV direta em `Order` — só `Cidade`/`CidadeEntregaRetirada`
 * (texto livre). Os relatórios de BI corporativo (Família C) trazem PDV codificado (13706/13707)
 * junto com o nome da cidade (ReceitaCanalVD_Performance_por_PDV.xlsx). Construímos esse mapa
 * cidade→PDV a partir dos dados corporativos já carregados, em vez de hardcodar os códigos —
 * assim funciona pra qualquer franquia/CP, não só a deste lote.
 */
export function buildCidadeToPdv(dataset: VDCorporateDataset | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!dataset?.receitaCanalVDPdv) return map;
  for (const row of dataset.receitaCanalVDPdv) {
    if (row.pdvCodigo && row.cidade) {
      map[normalizeCidade(row.cidade)] = row.pdvCodigo;
    }
  }
  return map;
}

function normalizeCidade(c: string): string {
  return c.trim().toUpperCase();
}

export function pdvForCidade(map: Record<string, string>, cidade: string | undefined | null): string | null {
  if (!cidade) return null;
  return map[normalizeCidade(cidade)] ?? null;
}
