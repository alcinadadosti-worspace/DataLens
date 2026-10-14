import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import { AderenciaCurvaRow, AderenciaDataset } from '../../types/loja';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';

const CURVAS: { key: 'curvaA' | 'curvaB' | 'curvaC' | 'curvaE'; label: string }[] = [
  { key: 'curvaA', label: 'Curva A' },
  { key: 'curvaB', label: 'Curva B' },
  { key: 'curvaC', label: 'Curva C' },
  { key: 'curvaE', label: 'Curva E' },
];

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

function cor(v: number | null): string {
  if (v == null) return 'var(--loja-text-muted, #9B9287)';
  if (v >= 90) return 'var(--loja-success, #2E7D5B)';
  if (v < 75) return 'var(--loja-danger, #B83A3A)';
  return 'var(--loja-text-strong, #3D362E)';
}

function CurvaCells({ row }: { row: AderenciaCurvaRow }) {
  return (
    <>
      {CURVAS.map(c => (
        <td key={c.key} style={{ ...td, color: cor(row[c.key]), fontWeight: 600 }}>
          {row[c.key] != null ? `${row[c.key]!.toFixed(1).replace('.', ',')}%` : '—'}
        </td>
      ))}
    </>
  );
}

function CurvaTable({ title, rows, nomeDe }: { title: string; rows: AderenciaCurvaRow[]; nomeDe: (r: AderenciaCurvaRow) => string }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <th style={{ ...th, textAlign: 'left' }}>{title}</th>
            {CURVAS.map(c => <th key={c.key} style={th}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.nome} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{nomeDe(r)}</td>
              <CurvaCells row={r} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Aderência do pedido por curva (A/B/C/E): por loja, por categoria e a evolução semanal/mensal.
 * `lojaCodigos` restringe a tabela de PDVs às lojas do lote (o relatório traz também PDVs que não
 * aparecem nos arquivos de venda da loja); sem nenhuma correspondência, mostra todos.
 */
const LojaAderenciaSection: React.FC<{ aderencia: AderenciaDataset; lojaCodigos: Set<string> }> = ({ aderencia, lojaCodigos }) => {
  const pdvsDoLote = aderencia.pdv.filter(r => lojaCodigos.has(r.nome));
  const pdvs = pdvsDoLote.length > 0 ? pdvsDoLote : aderencia.pdv;
  const cp = aderencia.cp[0];
  const periodo = [aderencia.ciclo ? `Ciclo ${aderencia.ciclo}` : null, aderencia.periodo].filter(Boolean).join(' · ');

  return (
    <div style={{ marginTop: 28 }}>
      <ChartCard glow
        title="Aderência do pedido por curva"
        hint="Percentual de aderência por curva de produto (A, B, C, E) vindo do relatório de Gestão de Pedidos — por loja, por categoria e ao longo do ciclo. Verde a partir de 90%, vermelho abaixo de 75%. Célula vazia (—) = a loja/categoria não tem itens naquela curva."
        subtitle={periodo || 'GestaoPedidos_Aderência_por_Categoria.xlsx'}
      >
        {cp && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {CURVAS.map(c => (
              <div key={c.key} style={{ background: 'var(--loja-bg-subtle, #F2EEE2)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label} · rede</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: cor(cp[c.key]) }}>
                  {cp[c.key] != null ? `${cp[c.key]!.toFixed(1).replace('.', ',')}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {(aderencia.semanal.length > 0 || aderencia.mensal.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 20, fontSize: 13 }}>
            {[['Semanal', aderencia.semanal], ['Mensal', aderencia.mensal], ['Anual', aderencia.anual]].map(([titulo, serie]) => (
              (serie as typeof aderencia.semanal).length > 0 && (
                <div key={titulo as string}>
                  <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{titulo as string}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {(serie as typeof aderencia.semanal).map(p => (
                      <div key={p.periodo}>
                        <div style={{ color: 'var(--loja-text-secondary, #6B6258)' }}>{p.periodo}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: cor(p.aderenciaPct) }}>{p.aderenciaPct.toFixed(1).replace('.', ',')}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {pdvs.length > 0 && <CurvaTable title="Loja" rows={pdvs} nomeDe={r => resolveLojaNome(r.nome, r.nome)} />}
        {aderencia.categorias.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <CurvaTable title="Categoria" rows={aderencia.categorias} nomeDe={r => r.nome} />
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default LojaAderenciaSection;
