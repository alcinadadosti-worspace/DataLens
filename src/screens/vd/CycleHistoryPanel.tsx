import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import { useVDHistoryStore } from '../../store/useVDHistoryStore';
import { fmtBRL, fmtNumber } from '../../utils/formatters';

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

/**
 * Cada import bem-sucedido grava um snapshot leve (useVDHistoryStore, persistido em localStorage).
 * Com 1 ciclo só (o que este lote tem), aparece como 1 barra/linha — o valor fica pronto pra virar
 * uma série de verdade assim que o usuário reimportar um ciclo novo (13→14→...), sem precisar de
 * nenhuma mudança de código.
 */
const CycleHistoryPanel: React.FC = () => {
  const snapshots = useVDHistoryStore(s => s.snapshots);
  if (snapshots.length === 0) return null;

  const maxRevenue = Math.max(...snapshots.map(s => s.grossRevenue), 1);

  return (
    <ChartCard
      title="Evolução entre ciclos"
      subtitle={snapshots.length === 1 ? 'Só 1 ciclo importado até agora' : `${snapshots.length} ciclos importados`}
      hint="Cada vez que você importa um lote com sucesso, gravamos um snapshot local (ciclo, receita, base ativa, ruptura, atingimento de sell-in) em localStorage — isso monta uma série entre ciclos mesmo sem um backend histórico. Reimportar o mesmo ciclo substitui o snapshot antigo dele, não duplica."
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100, marginBottom: 16, paddingTop: 8 }}>
        {snapshots.map(s => {
          const h = Math.max((s.grossRevenue / maxRevenue) * 84, 4);
          return (
            <div key={s.ciclo} style={{ flex: '0 0 auto', width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div title={fmtBRL(s.grossRevenue)} style={{
                width: '100%', height: h, borderRadius: '4px 4px 0 0',
                background: 'var(--vd-accent, #C9A227)',
              }} />
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--vd-text-secondary, #6B6258)' }}>
                {s.ciclo.split('/')[0]}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Ciclo</th>
              <th style={{ ...th, textAlign: 'right' }}>Receita</th>
              <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
              <th style={{ ...th, textAlign: 'right' }}>Base ativa</th>
              <th style={{ ...th, textAlign: 'right' }}>Ruptura</th>
              <th style={{ ...th, textAlign: 'right' }}>Sell-In</th>
            </tr>
          </thead>
          <tbody>
            {[...snapshots].reverse().map(s => (
              <tr key={s.ciclo}>
                <td style={td}>{s.ciclo}</td>
                <td style={tdNum}>{fmtBRL(s.grossRevenue)}</td>
                <td style={tdNum}>{fmtNumber(s.totalOrders)}</td>
                <td style={tdNum}>{s.baseAtiva !== null ? fmtNumber(s.baseAtiva) : '—'}</td>
                <td style={tdNum}>{s.rupturaTotalPct !== null ? `${s.rupturaTotalPct.toFixed(2).replace('.', ',')}%` : '—'}</td>
                <td style={tdNum}>{s.sellInAtingimentoPct !== null ? `${s.sellInAtingimentoPct.toFixed(1).replace('.', ',')}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
};

export default CycleHistoryPanel;
