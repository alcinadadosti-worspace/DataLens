import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import Button from '../components/ui/Button';
import TierBadge from '../components/ui/TierBadge';
import FilterBuilder from '../components/filters/FilterBuilder';
import { useFilteredOrders } from '../hooks/useAnalytics';
import { useExport } from '../hooks/useExport';
import { fmtBRL, fmtBRLshort } from '../utils/formatters';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { TIER_STYLES, TIER_DEFINITIONS } from '../design-system/tierStyles';
import { Order } from '../types/order';

const columnHelper = createColumnHelper<Order>();

interface TableScreenProps {
  selectedReseller?: { id: string; name: string } | null;
  onClearReseller?: () => void;
}

// ─── Reseller performance panel ──────────────────────────────────────────────

function ResellerPanel({ orders, reseller, tierAccent, onClear }: {
  orders: Order[];
  reseller: { id: string; name: string };
  tierAccent: string;
  onClear: () => void;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const eligible = orders.filter(isRevenueEligible);
  const cancelled = orders.filter(o => !isRevenueEligible(o));
  const totalRevenue = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
  const avgTicket = eligible.length > 0 ? totalRevenue / eligible.length : 0;

  // Revenue by day of cycle
  const revenueByDay: Record<string, number> = {};
  for (const o of eligible) {
    const d = o.DiaDoCiclo || '?';
    if (d !== '?') revenueByDay[d] = (revenueByDay[d] ?? 0) + o.ValorPraticado;
  }
  const days = Object.keys(revenueByDay).sort((a, b) => parseInt(a) - parseInt(b));
  const maxDay = Math.max(...Object.values(revenueByDay), 1);

  // Tier of reseller
  const tierId = orders[0]?.tierId ?? 'cf';
  const tierDef = TIER_DEFINITIONS.find(t => t.id === tierId);

  const kpis = [
    { label: 'Receita total', value: fmtBRLshort(totalRevenue), sub: fmtBRL(totalRevenue), color: tierAccent },
    { label: 'Finalizados', value: eligible.length.toLocaleString('pt-BR'), sub: `${orders.length > 0 ? ((eligible.length / orders.length) * 100).toFixed(0) : 0}% dos pedidos`, color: '#2E7D5B' },
    { label: 'Cancelados', value: cancelled.length.toLocaleString('pt-BR'), sub: `${orders.length > 0 ? ((cancelled.length / orders.length) * 100).toFixed(0) : 0}% dos pedidos`, color: cancelled.length > 0 ? '#B83A3A' : '#9B9287' },
    { label: 'Ticket médio', value: fmtBRLshort(avgTicket), sub: fmtBRL(avgTicket), color: '#6B6258' },
  ];

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${tierAccent}44`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 14,
      boxShadow: `0 2px 12px ${tierAccent}18`,
    }}>
      {/* Top accent bar */}
      <div style={{ height: 3, background: tierAccent }} />

      {/* Header */}
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F2EEE6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${tierAccent}18`, border: `1px solid ${tierAccent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ph ph-user" style={{ fontSize: 16, color: tierAccent }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1814', letterSpacing: '-0.01em' }}>
              {reseller.name}
            </div>
            <div style={{ fontSize: 11, color: '#9B9287', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: tierAccent, flexShrink: 0 }} />
              {tierDef?.name ?? tierId} · {orders.length} pedidos no período filtrado
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            border: '1px solid #E8E2D6', background: '#FAF7F2',
            fontSize: 12, color: '#6B6258', cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <i className="ph ph-x" style={{ fontSize: 12 }} />
          Limpar seleção
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{
            padding: '14px 18px',
            borderRight: i < kpis.length - 1 ? '1px solid #F2EEE6' : 'none',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2, fontFamily: i === 0 || i === 3 ? 'JetBrains Mono, monospace' : undefined }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {days.length > 1 && (
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #F2EEE6' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 10 }}>
            Receita por dia do ciclo
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72, position: 'relative' }}>
            {days.map(d => {
              const v = revenueByDay[d] ?? 0;
              const h = Math.max((v / maxDay) * 52, 3);
              const isHov = hoveredDay === d;
              return (
                <div
                  key={d}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', cursor: 'default' }}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Tooltip */}
                  {isHov && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1C1814',
                      color: '#FAF7F2',
                      borderRadius: 8,
                      padding: '6px 10px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 20,
                      fontSize: 11,
                      boxShadow: '0 4px 16px rgba(28,24,20,0.3)',
                    }}>
                      <div style={{ fontSize: 9, color: '#9B9287', marginBottom: 2, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Dia {d}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: tierAccent }}>
                        {fmtBRL(v)}
                      </div>
                      {/* Arrow */}
                      <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #1C1814',
                      }} />
                    </div>
                  )}
                  <div style={{
                    width: '100%', height: h,
                    background: tierAccent,
                    borderRadius: '3px 3px 0 0',
                    opacity: isHov ? 1 : 0.7,
                    minHeight: 3,
                    transform: isHov ? 'scaleY(1.04)' : 'scaleY(1)',
                    transformOrigin: 'bottom',
                    transition: 'opacity 120ms, transform 120ms',
                    boxShadow: isHov ? `0 0 8px ${tierAccent}88` : 'none',
                  }} />
                  {days.length <= 31 && (
                    <div style={{ fontSize: 8, color: isHov ? tierAccent : '#9B9287', lineHeight: 1, fontWeight: isHov ? 700 : 400, transition: 'color 120ms' }}>{d}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main table screen ────────────────────────────────────────────────────────

const TableScreen: React.FC<TableScreenProps> = ({ selectedReseller, onClearReseller }) => {
  const globalOrders = useFilteredOrders();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Local reseller filter — applied on top of global filters, doesn't touch the store
  const orders = useMemo(() => {
    if (!selectedReseller) return globalOrders;
    return globalOrders.filter(o => o.Pessoa === selectedReseller.id);
  }, [globalOrders, selectedReseller]);

  const { exportCSV, exportXLSX } = useExport(orders);

  // Tier accent color for the panel
  const resellerTierAccent = useMemo(() => {
    if (!selectedReseller) return '#C9A227';
    const tierId = orders[0]?.tierId ?? 'ouro';
    return TIER_STYLES[tierId]?.accent ?? '#C9A227';
  }, [selectedReseller, orders]);

  const columns = useMemo(() => [
    columnHelper.accessor('CodigoPedido', {
      header: 'Pedido',
      cell: info => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('NomePessoa', {
      header: 'Revendedor',
      cell: info => <span style={{ fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('tierId', {
      header: 'Tier',
      cell: info => <TierBadge tier={info.getValue()} size="sm" />,
    }),
    columnHelper.accessor('CicloMarketing', {
      header: 'Ciclo',
      cell: info => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('ResponsavelEstrutura', {
      header: 'Supervisor',
      cell: info => <span style={{ color: '#3D362E', fontSize: 13 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('CidadeEntregaRetirada', {
      header: 'Cidade',
      cell: info => <span style={{ color: '#3D362E', fontSize: 13 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('UFEntregaRetirada', {
      header: 'UF',
      cell: info => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6258' }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('ValorPraticado', {
      header: 'Valor Praticado',
      cell: info => (
        <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', display: 'block' }}>
          {fmtBRL(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('SituacaoComercial', {
      header: 'Situação',
      cell: info => {
        const v = info.getValue();
        const color = v === 'Cancelado' ? '#B83A3A' : v === 'Entregue' ? '#2E7D5B' : '#6B6258';
        return (
          <span style={{
            fontSize: 12, fontWeight: 500, color,
            background: v === 'Cancelado' ? '#FBE5E9' : v === 'Entregue' ? '#E0F2E8' : '#F2EEE6',
            padding: '2px 8px', borderRadius: 999,
          }}>
            {v}
          </span>
        );
      },
    }),
    columnHelper.accessor('ModeloComercial', {
      header: 'Modelo',
      cell: info => <span style={{ fontSize: 12, color: '#6B6258' }}>{info.getValue()}</span>,
    }),
  ], []);

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalPages = table.getPageCount();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Tabela completa
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Pedidos
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary" size="sm"
            icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />}
            onClick={exportCSV}
          >
            Exportar CSV
          </Button>
          <Button
            variant="secondary" size="sm"
            icon={<i className="ph ph-file-xls" style={{ fontSize: 14 }} />}
            onClick={exportXLSX}
          >
            Exportar XLSX
          </Button>
        </div>
      </div>

      {/* Reseller performance panel */}
      {selectedReseller && onClearReseller && (
        <ResellerPanel
          orders={orders}
          reseller={selectedReseller}
          tierAccent={resellerTierAccent}
          onClear={onClearReseller}
        />
      )}

      {/* Filter builder — only shown when no reseller is locked in */}
      {!selectedReseller && (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 10 }}>
            Filtros
          </div>
          <FilterBuilder />
        </div>
      )}

      {/* Table */}
      {orders.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 48, textAlign: 'center', color: '#6B6258' }}>
          <i className="ph ph-table" style={{ fontSize: 32, display: 'block', marginBottom: 12 }} />
          Nenhum pedido encontrado com os filtros aplicados.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          textAlign: 'left',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: header.column.getIsSorted() ? '#1C1814' : '#6B6258',
                          padding: '12px 14px',
                          background: '#F2EEE6',
                          borderBottom: '1px solid #E8E2D6',
                          position: 'sticky', top: 0,
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ padding: '11px 14px', borderBottom: '1px solid #F2EEE6' }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid #E8E2D6',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: '#6B6258',
          }}>
            <span>
              {orders.length.toLocaleString('pt-BR')} pedidos ·{' '}
              mostrando {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, orders.length)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                ← Anterior
              </Button>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {pageIndex + 1} / {totalPages}
              </span>
              <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Próxima →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableScreen;
