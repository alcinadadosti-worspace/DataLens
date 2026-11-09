import React, { useMemo, useState } from 'react';
import Button from '../ui/Button';

/** "95,0%": valor já em 0-100. */
export function pct(v: number | null | undefined, casas = 1): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(casas).replace('.', ',')}%`;
}

/** Variação % entre dois valores; sem base (loja nova, por exemplo) não existe variação. */
export function variacao(anterior: number | null | undefined, atual: number | null | undefined): number | null {
  return anterior && atual != null ? ((atual - anterior) / anterior) * 100 : null;
}

export function fmtVariacao(v: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;
}

/** 569 → "00:09:29". */
export function fmtDuracaoSeg(s: number | null | undefined): string {
  if (s == null) return '—';
  const p = (n: number) => String(Math.floor(n)).padStart(2, '0');
  return `${p(s / 3600)}:${p((s % 3600) / 60)}:${p(s % 60)}`;
}

export const LojaVazio: React.FC<{ mensagem: React.ReactNode; onNavigate: (r: string) => void }> = ({ mensagem, onNavigate }) => (
  <div style={{ padding: '80px 32px', textAlign: 'center' }}>
    <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>{mensagem}</p>
    <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
  </div>
);

export function Alternador<T extends string>({ opcoes, valor, onChange }: { opcoes: { id: T; label: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map(o => {
        const ativo = o.id === valor;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={ativo}
            style={{
              fontSize: 14, padding: '10px 16px', borderRadius: 9, cursor: 'pointer', fontWeight: 600,
              border: `1px solid ${ativo ? 'var(--loja-ink, #1C1814)' : 'var(--loja-border, #E8E2D6)'}`,
              background: ativo ? 'var(--loja-ink, #1C1814)' : 'var(--loja-surface, #FFFFFF)',
              color: ativo ? 'var(--loja-surface, #FFFFFF)' : 'var(--loja-ink, #1C1814)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Leitura: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--loja-text-strong, #3D362E)', lineHeight: 1.6 }}>
    <i className="ph ph-lightbulb" style={{ color: 'var(--loja-accent-gold, #C9A227)', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
    <span>{children}</span>
  </div>
);

export const SeletorLoja: React.FC<{ lojas: { codigo: string; nome: string }[]; valor: string; onChange: (v: string) => void }> = ({ lojas, valor, onChange }) => (
  <select
    value={valor}
    onChange={e => onChange(e.target.value)}
    style={{ fontSize: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--loja-border, #E8E2D6)', background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)' }}
  >
    <option value="">Todas as lojas</option>
    {lojas.map(l => <option key={l.codigo} value={l.codigo}>{l.nome}</option>)}
  </select>
);

export interface ColunaTabela<T> {
  id: string;
  titulo: string;
  valor: (linha: T) => React.ReactNode;
  /** Presente = coluna ordenável ao clicar no cabeçalho. */
  ordem?: (linha: T) => number | string | null;
  direita?: boolean;
}

interface LojaTabelaProps<T> {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chave: (linha: T, i: number) => string;
  ordemInicial?: { id: string; desc: boolean };
  vazio?: string;
}

export function LojaTabela<T>({ colunas, linhas, chave, ordemInicial, vazio = 'Sem dados.' }: LojaTabelaProps<T>) {
  const [ordem, setOrdem] = useState(ordemInicial ?? null);

  const ordenadas = useMemo(() => {
    const coluna = colunas.find(c => c.id === ordem?.id);
    if (!coluna?.ordem) return linhas;
    const valorDe = coluna.ordem;
    const sinal = ordem?.desc ? -1 : 1;
    return [...linhas].sort((a, b) => {
      const [x, y] = [valorDe(a), valorDe(b)];
      // Sem valor vai para o fim nas duas direções.
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * sinal;
    });
  }, [colunas, linhas, ordem]);

  if (linhas.length === 0) return <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>{vazio}</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {colunas.map(c => {
              const ativa = ordem?.id === c.id;
              return (
                <th
                  key={c.id}
                  onClick={c.ordem ? () => setOrdem({ id: c.id, desc: ativa ? !ordem?.desc : true }) : undefined}
                  aria-sort={ativa ? (ordem?.desc ? 'descending' : 'ascending') : undefined}
                  style={{ padding: '8px 10px', fontWeight: 600, textAlign: c.direita ? 'right' : 'left', whiteSpace: 'nowrap', cursor: c.ordem ? 'pointer' : 'default', borderBottom: '1px solid var(--loja-border, #E8E2D6)' }}
                >
                  {c.titulo}{ativa ? (ordem?.desc ? ' ↓' : ' ↑') : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l, i) => (
            <tr key={chave(l, i)} style={{ borderBottom: '1px solid var(--loja-border-soft, rgba(28,24,20,0.08))' }}>
              {colunas.map(c => (
                <td key={c.id} style={{ padding: '8px 10px', textAlign: c.direita ? 'right' : 'left', fontFamily: c.direita ? 'JetBrains Mono, monospace' : undefined, whiteSpace: c.direita ? 'nowrap' : undefined }}>
                  {c.valor(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const CelulaVariacao: React.FC<{ valor: number | null; menosEMelhor?: boolean }> = ({ valor, menosEMelhor }) => {
  const bom = valor != null && (menosEMelhor ? valor <= 0 : valor >= 0);
  return (
    <span style={{ fontWeight: 600, color: valor == null ? 'var(--loja-text-muted, #9B9287)' : bom ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-danger, #B83A3A)' }}>
      {fmtVariacao(valor)}
    </span>
  );
};
