import React, { useMemo, useState } from 'react';
import { useFilteredOrders } from '../hooks/useAnalytics';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { parseBRDate, diffInMinutes } from '../utils/dateUtils';
import { fmtBRLshort, fmtBRL, fmtMinutes, fmtNumber } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import Button from '../components/ui/Button';
import { useExport } from '../hooks/useExport';
import { Order } from '../types/order';

interface SupervisorRow {
  name: string;
  structure: string;
  codEstrutura: string;
  orderCount: number;
  resellerCount: number;
  totalRevenue: number;
  avgTicket: number;
  avgSLAMinutes: number;
  cancelledCount: number;
}

type SortKey = keyof SupervisorRow;

const SupervisorScreen: React.FC = () => {
  const orders = useFilteredOrders();
  const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const supervisorData = useMemo<SupervisorRow[]>(() => {
    const map: Record<string, {
      name: string; structure: string; codEstrutura: string;
      orders: Order[]; resellers: Set<string>; slaTimes: number[];
    }> = {};

    for (const order of orders) {
      const key = order.ResponsavelEstrutura || 'Sem supervisor';
      if (!map[key]) {
        map[key] = {
          name: key,
          structure: order.Estrutura,
          codEstrutura: order.CodEstrutura,
          orders: [],
          resellers: new Set(),
          slaTimes: [],
        };
      }
      map[key].orders.push(order);
      if (order.Pessoa) map[key].resellers.add(order.Pessoa);

      const aprovDate = parseBRDate(order.DataAprovacao);
      const faturDate = parseBRDate(order.DataAutorizacaoFaturamento);
      const sla = diffInMinutes(aprovDate, faturDate);
      if (sla !== null && sla >= 0) map[key].slaTimes.push(sla);
    }

    return Object.values(map).map(s => {
      const eligibleOrders = s.orders.filter(isRevenueEligible);
      const totalRevenue = eligibleOrders.reduce((sum, o) => sum + o.ValorPraticado, 0);
      const avgSLAMinutes = s.slaTimes.length > 0
        ? s.slaTimes.reduce((sum, t) => sum + t, 0) / s.slaTimes.length
        : 0;
      return {
        name: s.name,
        structure: s.structure,
        codEstrutura: s.codEstrutura,
        orderCount: s.orders.length,
        resellerCount: s.resellers.size,
        totalRevenue,
        avgTicket: eligibleOrders.length > 0 ? totalRevenue / eligibleOrders.length : 0,
        avgSLAMinutes,
        cancelledCount: s.orders.filter(o => !isRevenueEligible(o)).length,
      };
    });
  }, [orders]);

  const sorted = useMemo(() => {
    return [...supervisorData].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [supervisorData, sortKey, sortDir]);

  const exportData = sorted.map(s => ({
    'Supervisor': s.name,
    'Estrutura': s.structure,
    'Cód Estrutura': s.codEstrutura,
    'Pedidos': s.orderCount,
    'Revendedores': s.resellerCount,
    'Receita Total': s.totalRevenue,
    'Ticket Médio': s.avgTicket,
    'ANS Médio (min)': Math.round(s.avgSLAMinutes),
    'Cancelados': s.cancelledCount,
  }));

  const { exportCSV } = useExport(orders);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function thStyle(key: SortKey): React.CSSProperties {
    return {
      textAlign: 'left', cursor: 'pointer',
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: sortKey === key ? '#1C1814' : '#6B6258',
      padding: '12px 14px',
      background: '#F2EEE6', borderBottom: '1px solid #E8E2D6',
      position: 'sticky', top: 0, userSelect: 'none',
      whiteSpace: 'nowrap',
    };
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-users" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de supervisores</h2>
        <p style={{ color: '#6B6258', fontSize: 15 }}>Importe uma planilha para ver o ranking de supervisores.</p>
      </div>
    );
  }

  const totalRevenue = sorted.reduce((s, r) => s + r.totalRevenue, 0);
  const avgSLA = sorted.length > 0
    ? sorted.reduce((s, r) => s + r.avgSLAMinutes, 0) / sorted.length
    : 0;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Análise por estrutura
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Supervisores
          </h1>
        </div>
        <Button
          variant="secondary" size="sm"
          icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />}
          onClick={exportCSV}
        >
          Exportar CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 4 }}>Estruturas ativas</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtNumber(sorted.length)}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 4 }}>Receita total</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtBRLshort(totalRevenue)}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 4 }}>ANS médio geral</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtMinutes(avgSLA)}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ maxHeight: 600, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle('name') }} onClick={() => toggleSort('name')}>
                  Supervisor {sortKey === 'name' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('structure') }} onClick={() => toggleSort('structure')}>
                  Estrutura {sortKey === 'structure' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('orderCount'), textAlign: 'right' }} onClick={() => toggleSort('orderCount')}>
                  Pedidos {sortKey === 'orderCount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('resellerCount'), textAlign: 'right' }} onClick={() => toggleSort('resellerCount')}>
                  Revend. {sortKey === 'resellerCount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('totalRevenue'), textAlign: 'right' }} onClick={() => toggleSort('totalRevenue')}>
                  Receita {sortKey === 'totalRevenue' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('avgTicket'), textAlign: 'right' }} onClick={() => toggleSort('avgTicket')}>
                  Ticket Médio {sortKey === 'avgTicket' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('avgSLAMinutes'), textAlign: 'right' }} onClick={() => toggleSort('avgSLAMinutes')}>
                  ANS Médio {sortKey === 'avgSLAMinutes' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th style={{ ...thStyle('cancelledCount'), textAlign: 'right' }} onClick={() => toggleSort('cancelledCount')}>
                  Cancelados {sortKey === 'cancelledCount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.name + i}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F2')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', fontWeight: 500 }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', color: '#6B6258', fontSize: 12 }}>
                    {row.structure || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#3D362E' }}>
                    {row.orderCount.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#3D362E' }}>
                    {row.resellerCount.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {fmtBRL(Math.round(row.totalRevenue))}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6B6258' }}>
                    {fmtBRLshort(row.avgTicket)}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{
                      color: row.avgSLAMinutes > 1440 ? '#B83A3A' : row.avgSLAMinutes > 480 ? '#8B6914' : '#2E7D5B',
                    }}>
                      {fmtMinutes(row.avgSLAMinutes)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: row.cancelledCount > 0 ? '#B83A3A' : '#9B9287' }}>
                      {row.cancelledCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #E8E2D6', fontSize: 12, color: '#6B6258' }}>
          {sorted.length} estruturas
        </div>
      </div>
    </div>
  );
};

export default SupervisorScreen;
