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
import { fmtBRL } from '../utils/formatters';
import { Order } from '../types/order';

const columnHelper = createColumnHelper<Order>();

const TableScreen: React.FC = () => {
  const orders = useFilteredOrders();
  const [sorting, setSorting] = useState<SortingState>([]);
  const { exportCSV, exportXLSX } = useExport(orders);

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

      {/* Filter builder */}
      <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 10 }}>
          Filtros
        </div>
        <FilterBuilder />
      </div>

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
