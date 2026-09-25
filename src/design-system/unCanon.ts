/**
 * Canonicalização de nome de UN (marca) — o mesmo grupo aparece grafado de formas diferentes em
 * arquivos diferentes do lote Ciclo 13 (ex. "O Boticário" / "O Boticario" / "BOTICÁRIO" /
 * "O BOTICÁRIO" / "BOT"; "Eudora" / "EUD"; "O.U.I" / "OUI"). Ver LEITURA_PLANILHAS_VD.md §6 —
 * sem esse dicionário, agregações que juntam UN de relatórios diferentes ficam fragmentadas em
 * variantes que na prática são a mesma marca.
 */
export interface UnCanon {
  id: string;
  label: string;
}

const RULES: { id: string; label: string; patterns: RegExp[] }[] = [
  { id: 'boticario', label: 'O Boticário', patterns: [/^O\s*BOTIC[AÁ]RIO$/i, /^BOTIC[AÁ]RIO$/i, /^BOT$/i] },
  { id: 'eudora', label: 'Eudora', patterns: [/^EUDORA$/i, /^EUD$/i] },
  { id: 'oui', label: 'O.U.I', patterns: [/^O\.?U\.?I\.?$/i] },
  { id: 'qdb', label: 'Quem Disse, Berenice?', patterns: [/^QUEM\s*DISSE\s*BERENICE\??$/i, /^QDB$/i] },
  { id: 'frj', label: 'FRJ', patterns: [/^FRJ$/i] },
];

/** Devolve a forma canônica se o texto bater com alguma variante conhecida; senão devolve o texto original inalterado (nunca inventa uma marca nova). */
export function canonicalizeUN(raw: string): UnCanon {
  const s = raw.trim();
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(s))) return { id: rule.id, label: rule.label };
  }
  return { id: s.toLowerCase().replace(/\s+/g, '-'), label: s };
}
