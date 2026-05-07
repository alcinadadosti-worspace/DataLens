export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtBRLshort(n: number): string {
  if (n >= 1_000_000) {
    return 'R$ ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (n >= 1_000) {
    return 'R$ ' + (n / 1_000).toFixed(1).replace('.', ',') + 'k';
  }
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
