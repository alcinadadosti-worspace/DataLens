/**
 * Apelidos de loja informados pelo usuário — usados no lugar da razão social genérica
 * ("ACQUA DISTRIBUIDORA DE PERFUMES E COSMETICOS LTDA"), que se repete entre várias lojas
 * físicas diferentes e não ajuda a distinguir uma da outra.
 */
export const LOJA_APELIDOS: Record<string, string> = {
  '24303': 'Loja São Sebastião',
  '24617': 'Loja Sustentável Palmeira',
  '24668': 'Loja Palmeira',
  '24669': 'Loja Penedo',
  '24670': 'Loja Coruripe',
  '24671': 'Loja Teotônio Vilela',
};

export function resolveLojaNome(codigo: string | null | undefined, fallback: string): string {
  if (codigo && LOJA_APELIDOS[codigo]) return LOJA_APELIDOS[codigo];
  return fallback;
}
