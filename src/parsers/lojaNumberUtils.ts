/** Formato numérico BR: ponto de milhar, vírgula decimal ("1.234,56"); '', '-', '--' tratados como nulo/zero. */
export function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.trim();
  if (s === '' || s === '-' || s === '--') return 0;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Percentual pode vir como string "39,71%" ou como fração decimal (0.3971) — normaliza sempre para 0-100. */
export function toPct(v: unknown): number {
  if (typeof v === 'string' && v.trim().endsWith('%')) {
    return toNum(v.trim().slice(0, -1));
  }
  const n = toNum(v);
  return Math.abs(n) <= 1 ? n * 100 : n;
}
