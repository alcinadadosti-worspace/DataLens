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

/**
 * Percentual pode vir como string BR "39,71%" (vírgula decimal), como string en-US "39.71%"
 * (alguns exports de Gestão de Pedidos usam ponto decimal nessa coluna específica, sem separador
 * de milhar — diferente do resto do arquivo), ou como fração decimal (0.3971). Normaliza sempre
 * para 0-100. Sem vírgula, o ponto é tratado como decimal (não como milhar) — percentuais
 * raramente passam de algumas centenas, então essa é a leitura mais segura.
 */
export function toPct(v: unknown): number {
  if (typeof v === 'string' && v.trim().endsWith('%')) {
    const inner = v.trim().slice(0, -1).trim();
    if (inner.includes(',')) return toNum(inner);
    const n = parseFloat(inner);
    return isNaN(n) ? 0 : n;
  }
  const n = toNum(v);
  return Math.abs(n) <= 1 ? n * 100 : n;
}
