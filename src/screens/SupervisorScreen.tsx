import React, { useMemo, useState } from 'react';
import { useFilteredOrders } from '../hooks/useAnalytics';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { parseBRDate, diffInMinutes } from '../utils/dateUtils';
import { fmtBRLshort, fmtBRL, fmtMinutes, fmtNumber } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import RankingChart from '../components/charts/RankingChart';
import { RankingItem } from '../components/charts/RankingList';
import InfoHint from '../components/ui/InfoHint';
import Button from '../components/ui/Button';
import { useExport } from '../hooks/useExport';
import { useFilterStore } from '../store/useFilterStore';
import { useVDCorporateStore } from '../store/useVDCorporateStore';
import { getSupervisorColor } from '../design-system/supervisorColors';
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
  /** Cruzamento com VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx por nome normalizado — `null` quando não há BI carregado ou o nome não bate com nenhuma linha do relatório. */
  rpa: number | null;
  churnPct: number | null;
}

function normalizeSupervisorName(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

type SortKey = keyof SupervisorRow;

interface SupervisorScreenProps {
  onNavigate: (route: string) => void;
}

const SupervisorScreen: React.FC<SupervisorScreenProps> = ({ onNavigate }) => {
  const orders = useFilteredOrders();
  const setFilter = useFilterStore(s => s.setFilter);
  const corporateDataset = useVDCorporateStore(s => s.dataset);
  const monitorPorSupervisor = corporateDataset?.monitoramentoBase?.porSupervisor ?? [];
  const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  function goToSupervisorOrders(name: string) {
    setFilter('supervisor', name);
    onNavigate('table');
  }

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

    // Cruzamento com o BI: várias linhas do Monitoramento podem cair no mesmo nome normalizado (o
    // arquivo de origem às vezes repete um supervisor em mais de uma linha) — agregamos por soma de
    // base ativa e média ponderada de RPA/churn por essa base, em vez de só pegar a primeira linha.
    const biByName: Record<string, { baseAtivaSum: number; rpaWeighted: number; churnWeighted: number }> = {};
    for (const row of monitorPorSupervisor) {
      if (row.chave.trim().toUpperCase() === 'TOTAL') continue;
      const key = normalizeSupervisorName(row.chave);
      if (!biByName[key]) biByName[key] = { baseAtivaSum: 0, rpaWeighted: 0, churnWeighted: 0 };
      biByName[key].baseAtivaSum += row.baseAtiva;
      biByName[key].rpaWeighted += row.rpa * row.baseAtiva;
      biByName[key].churnWeighted += row.churnPct * row.baseAtiva;
    }

    return Object.values(map).map(s => {
      const eligibleOrders = s.orders.filter(isRevenueEligible);
      const totalRevenue = eligibleOrders.reduce((sum, o) => sum + o.ValorPraticado, 0);
      const avgSLAMinutes = s.slaTimes.length > 0
        ? s.slaTimes.reduce((sum, t) => sum + t, 0) / s.slaTimes.length
        : 0;
      const bi = biByName[normalizeSupervisorName(s.name)];
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
        rpa: bi && bi.baseAtivaSum > 0 ? bi.rpaWeighted / bi.baseAtivaSum : null,
        churnPct: bi && bi.baseAtivaSum > 0 ? bi.churnWeighted / bi.baseAtivaSum : null,
      };
    });
  }, [orders, monitorPorSupervisor]);

  const sorted = useMemo(() => {
    return [...supervisorData].sort((a, b) => {
      // rpa/churnPct podem ser `null` (sem cruzamento com o BI) — tratamos como "menor que
      // qualquer número" pra não quebrar a ordenação nem cair na comparação de string.
      const av = a[sortKey] === null ? -Infinity : a[sortKey];
      const bv = b[sortKey] === null ? -Infinity : b[sortKey];
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
    'RPA (BI)': s.rpa !== null ? s.rpa.toFixed(2) : '',
    '% Churn (BI)': s.churnPct !== null ? s.churnPct.toFixed(2) : '',
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
      color: sortKey === key ? 'var(--vd-ink, #1C1814)' : 'var(--vd-text-secondary, #6B6258)',
      padding: '12px 14px',
      background: 'var(--vd-bg-track, #F2EEE6)', borderBottom: '1px solid var(--vd-border, #E8E2D6)',
      position: 'sticky', top: 0, userSelect: 'none',
      whiteSpace: 'nowrap',
    };
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}>
          <i className="ph ph-users" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de supervisores</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15 }}>Importe uma planilha para ver o ranking de supervisores.</p>
      </div>
    );
  }

  const totalRevenue = sorted.reduce((s, r) => s + r.totalRevenue, 0);
  const avgSLA = sorted.length > 0
    ? sorted.reduce((s, r) => s + r.avgSLAMinutes, 0) / sorted.length
    : 0;

  // Sempre por receita, independente da ordenação atual da tabela (que o usuário pode mudar pra
  // qualquer coluna) — o gráfico de participação é um ranking de receita, não deve seguir isso.
  const participationItems: RankingItem[] = [...sorted]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map(row => ({
      label: row.name,
      value: row.totalRevenue,
      valueLabel: fmtBRLshort(row.totalRevenue),
      meta: totalRevenue > 0 ? `${((row.totalRevenue / totalRevenue) * 100).toFixed(1).replace('.', ',')}%` : '0,0%',
      color: getSupervisorColor(row.name)?.accent,
    }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
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
        <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
            Estruturas ativas
            <InfoHint text="Quantidade de supervisores/estruturas com pelo menos um pedido no período filtrado." />
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtNumber(sorted.length)}</div>
        </div>
        <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
            Receita total
            <InfoHint text="Soma da receita (Valor Praticado) de todos os pedidos elegíveis, de todas as estruturas, no período filtrado." />
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtBRLshort(totalRevenue)}</div>
        </div>
        <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
            ANS médio geral
            <InfoHint text="ANS — Acordo de Nível de Serviço: tempo médio entre a aprovação e a autorização de faturamento do pedido, em minutos, considerando todas as estruturas." />
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtMinutes(avgSLA)}</div>
        </div>
      </div>

      {/* Participação na receita geral */}
      <ChartCard
        title="Participação dos supervisores na receita"
        subtitle="Receita total por estrutura, no período filtrado"
        hint="Quanto cada supervisor/estrutura contribui para a receita total do grupo. Use os botões acima do gráfico para alternar entre barras, pizza e outras visualizações, ou abra em tela cheia para clicar num supervisor e ver mais detalhes."
      >
        <RankingChart
          items={participationItems}
          mode="vd"
          initialCategory="bar"
          emptyMessage="Sem dados"
        />
      </ChartCard>
      <div style={{ height: 20 }} />

      {/* Table */}
      <div style={{ background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14, overflow: 'hidden' }}>
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
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Ticket Médio {sortKey === 'avgTicket' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    <span onClick={e => e.stopPropagation()}>
                      <InfoHint direction="down" text="Receita total dividida pelo número de pedidos elegíveis (não cancelados) da estrutura." />
                    </span>
                  </span>
                </th>
                <th style={{ ...thStyle('avgSLAMinutes'), textAlign: 'right' }} onClick={() => toggleSort('avgSLAMinutes')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    ANS Médio {sortKey === 'avgSLAMinutes' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    <span onClick={e => e.stopPropagation()}>
                      <InfoHint direction="down" text="ANS — Acordo de Nível de Serviço: tempo médio, em minutos, entre a aprovação e a autorização de faturamento dos pedidos dessa estrutura." />
                    </span>
                  </span>
                </th>
                <th style={{ ...thStyle('cancelledCount'), textAlign: 'right' }} onClick={() => toggleSort('cancelledCount')}>
                  Cancelados {sortKey === 'cancelledCount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                {monitorPorSupervisor.length > 0 && (
                  <>
                    <th style={{ ...thStyle('rpa'), textAlign: 'right' }} onClick={() => toggleSort('rpa')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        RPA {sortKey === 'rpa' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        <span onClick={e => e.stopPropagation()}>
                          <InfoHint direction="down" text="Receita Por Ativo — cruzamento com VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx por nome de supervisor. '—' quando o nome não bate com nenhuma linha do relatório de BI." />
                        </span>
                      </span>
                    </th>
                    <th style={{ ...thStyle('churnPct'), textAlign: 'right' }} onClick={() => toggleSort('churnPct')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        % Churn {sortKey === 'churnPct' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        <span onClick={e => e.stopPropagation()}>
                          <InfoHint direction="down" text="Perda de base dessa estrutura no ciclo, cruzada do mesmo relatório de BI (Monitoramento da Base)." />
                        </span>
                      </span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.name + i}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--vd-bg, #FAF7F2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', fontWeight: 500 }}>
                    <span
                      onClick={() => goToSupervisorOrders(row.name)}
                      onMouseEnter={() => setHoveredName(row.name)}
                      onMouseLeave={() => setHoveredName(null)}
                      title="Ver pedidos dessa estrutura na tabela"
                      style={{
                        cursor: 'pointer',
                        color: hoveredName === row.name ? 'var(--vd-accent, #B26A3C)' : 'inherit',
                        textDecoration: hoveredName === row.name ? 'underline' : 'none',
                        textUnderlineOffset: 3,
                      }}
                    >
                      {row.name}
                      <i
                        className="ph ph-arrow-square-out"
                        style={{ fontSize: 12, marginLeft: 6, opacity: hoveredName === row.name ? 1 : 0, transition: 'opacity 150ms' }}
                      />
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', color: 'var(--vd-text-secondary, #6B6258)', fontSize: 12 }}>
                    {row.structure || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--vd-text-strong, #3D362E)' }}>
                    {row.orderCount.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--vd-text-strong, #3D362E)' }}>
                    {row.resellerCount.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {fmtBRL(Math.round(row.totalRevenue))}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--vd-text-secondary, #6B6258)' }}>
                    {fmtBRLshort(row.avgTicket)}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{
                      color: row.avgSLAMinutes > 1440 ? 'var(--vd-danger, #B83A3A)' : row.avgSLAMinutes > 480 ? 'var(--vd-warning, #8B6914)' : 'var(--vd-success, #2E7D5B)',
                    }}>
                      {fmtMinutes(row.avgSLAMinutes)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: row.cancelledCount > 0 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-text-muted, #9B9287)' }}>
                      {row.cancelledCount}
                    </span>
                  </td>
                  {monitorPorSupervisor.length > 0 && (
                    <>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--vd-text-secondary, #6B6258)' }}>
                        {row.rpa !== null ? fmtBRLshort(row.rpa) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--vd-bg-track, #F2EEE6)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.churnPct !== null
                          ? <span style={{ color: row.churnPct > 3 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-text-secondary, #6B6258)' }}>{row.churnPct.toFixed(2).replace('.', ',')}%</span>
                          : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--vd-border, #E8E2D6)', fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>
          {sorted.length} estruturas
        </div>
      </div>
    </div>
  );
};

export default SupervisorScreen;
