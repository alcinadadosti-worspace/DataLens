import { TipoIndicadorPef } from '../types/loja';

/**
 * Natureza de um indicador do Resumo de Performance, decidida pelo NOME (igual na aba CP e nas
 * abas PDV/CONSULTOR, a menos da grafia) — nunca pela magnitude do valor, que muda de escala
 * conforme a aba. Define a unidade do valor e a da variação "Vs. Ano Passado":
 * - `taxa` (penetração, share, conversão, "%", Clique & Retire, Resgate): valor em % (0-100) e
 *   variação em pontos percentuais (taxa atual − taxa do ano passado);
 * - `moeda` / `numero`: variação relativa em % ((atual ÷ ano passado − 1) × 100);
 * - `tempo` (TME): valor em segundos, variação relativa em % — e menor é melhor.
 * A ordem dos testes importa: "Penetração de Receita Mobshop" é taxa, não moeda.
 */
export function tipoIndicadorPef(nome: string): TipoIndicadorPef {
  const n = nome.toLowerCase();
  if (/\btme\b|tempo/.test(n)) return 'tempo';
  if (/penetra|share|convers|%|clique|resgate/.test(n)) return 'taxa';
  if (/receita|boleto médio|boleto medio|preço médio|preco medio/.test(n)) return 'moeda';
  return 'numero';
}

/** Taxas variam em pontos percentuais; o resto, em % relativo. */
export function unidadeVariacao(tipo: TipoIndicadorPef): 'pp' | 'pct' {
  return tipo === 'taxa' ? 'pp' : 'pct';
}

/** "11:04s" (mm:ss) ou "00:21:25" (hh:mm:ss) → segundos. `null` pra célula vazia/"-"/"--" ou fora do formato. */
export function parseDuracaoSegundos(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').trim().match(/^(?:(\d+):)?(\d+):(\d{1,2})s?$/i);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** 664 → "11min04s"; 3725 → "1h02min05s"; 45 → "45s". */
export function fmtDuracao(segundos: number): string {
  const total = Math.round(segundos);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}h${String(min).padStart(2, '0')}min${ss}s`;
  if (min > 0) return `${min}min${ss}s`;
  return `${s}s`;
}

/**
 * Uma variação vs. ano passado que não pode existir: queda relativa maior que 100%, ou taxa cujo
 * valor do ano passado implícito (atual − variação em p.p.) fica negativo — ou, nas taxas que são
 * fatia de um todo (penetração, share, "%"), passa de 100%. O sistema de origem às vezes exporta
 * isso (ex. "% Boletos ID Cliente" com −715,39 na aba CP do Ciclo 14, que implicaria 809% no ano
 * passado) — o número não diz nada e não deve ser exibido como se dissesse. "Conversão de Ação de
 * Fluxo" não tem teto: o próprio arquivo traz consultores convertendo 107% e 400% do fluxo. Margem
 * de 5 p.p. no teto porque fatias de receita encostam um pouco acima de 100% (Mobshop em 100,73%).
 */
export function variacaoImpossivel(nome: string, atual: number | null, variacao: number): boolean {
  if (tipoIndicadorPef(nome) !== 'taxa') return variacao < -100;
  if (atual == null) return false;
  const anoPassado = atual - variacao;
  const temTeto = !/convers/i.test(nome);
  return anoPassado < -0.5 || (temTeto && anoPassado > 105);
}
