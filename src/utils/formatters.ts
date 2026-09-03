export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Alias de fmtBRL — mantido por compatibilidade com o nome usado nas telas, mas sem abreviação (1,2k/1,2M): sempre escreve o valor por extenso. */
export function fmtBRLshort(n: number): string {
  return fmtBRL(n);
}

export function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(1).replace('.', ',') + '%';
}

export function fmtMinutes(m: number): string {
  if (m < 60) return Math.round(m) + ' min';
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  if (rem === 0) return h + 'h';
  return h + 'h ' + rem + 'min';
}

export function fmtHours(h: number): string {
  if (h < 1) return Math.round(h * 60) + ' min';
  return h.toFixed(1).replace('.', ',') + 'h';
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}
