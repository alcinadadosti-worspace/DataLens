import { TIER_STYLES } from './tierStyles';

export interface SupervisorColor {
  accent: string;
  bg: string;
}

// Cores sob medida pedidas pelo usuário para segmentações que não são um tier de venda
// (Berçário, Setor Devolução) — não existem em tierStyles.ts porque não são tiers de fato.
const CUSTOM_COLORS: Record<string, SupervisorColor> = {
  bercario: { accent: '#F5A9C8', bg: '#FDEBF3' }, // rosa bebê
  devolucao: { accent: '#8C8C8C', bg: '#ECECEC' }, // cinza
};

interface SupervisorRule {
  test: (upperName: string) => boolean;
  tierId?: string;
  custom?: keyof typeof CUSTOM_COLORS;
}

// Casa pelo primeiro nome inteiro (== ou seguido de espaço/sobrenome) — não um prefixo cru, senão
// "LUAN" também casaria com uma eventual "LUANA" que nada tem a ver com a regra pedida.
function startsWithName(full: string, firstName: string): boolean {
  return full === firstName || full.startsWith(firstName + ' ');
}

// Mapeamento combinado a pedido do usuário: cada supervisor(a) cuida de uma segmentação
// específica, então a cor da parte dela nos gráficos reflete essa segmentação em vez de um
// ranking de posição. Jordelle cuida de 4 segmentações ao mesmo tempo — usa a mais alta
// (Diamante). Regras testadas em ordem, na string do nome já em maiúsculas.
const RULES: SupervisorRule[] = [
  { test: n => startsWithName(n, 'JORDELLE'), tierId: 'diamante' },
  { test: n => startsWithName(n, 'NATHALIA VIEIRA'), tierId: 'platina' },
  { test: n => startsWithName(n, 'DANIELLE'), tierId: 'ouro' },
  { test: n => startsWithName(n, 'EDNA'), tierId: 'prata' },
  { test: n => startsWithName(n, 'LUAN'), tierId: 'prata' },
  { test: n => startsWithName(n, 'BRUNA'), tierId: 'bronze' },
  { test: n => startsWithName(n, 'GESSYCA'), custom: 'bercario' },
  { test: n => n === 'SEM SUPERVISOR', custom: 'devolucao' },
];

/** Cor fixa de identidade para um supervisor conhecido — undefined se não houver regra pra ele. */
export function getSupervisorColor(name: string): SupervisorColor | undefined {
  const upper = name.trim().toUpperCase();
  for (const rule of RULES) {
    if (!rule.test(upper)) continue;
    if (rule.tierId) {
      const ts = TIER_STYLES[rule.tierId];
      if (ts) return { accent: ts.accent, bg: ts.bg };
    }
    if (rule.custom) return CUSTOM_COLORS[rule.custom];
  }
  return undefined;
}
