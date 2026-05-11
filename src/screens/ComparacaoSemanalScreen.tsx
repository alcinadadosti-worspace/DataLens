import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useOrderStore } from '../store/useOrderStore';
import { parseBRDate } from '../utils/dateUtils';
import { fmtBRLshort, fmtBRL, fmtNumber, fmtPct } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import Button from '../components/ui/Button';

interface WeekData {
  weekKey: string;
  label: string;
  faturamento: number;
  pedidos: number;
  finalizados: number;
  cancelados: number;
  ticketMedio: number;
  ativos: number;
  rpa: number;
  ansRate: number;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7) + 1;
  return { year: d.getFullYear(), week };
}

function weekLabel(year: number, week: number): string {
  return `Sem ${String(week).padStart(2, '0')}/${year}`;
}

function weekSortKey(year: number, week: number): string {
  return `${year}-${String(week).padStart(2, '0')}`;
}

type MetricKey = 'faturamento' | 'pedidos' | 'finalizados' | 'cancelados' | 'ticketMedio' | 'rpa' | 'ansRate';

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string; color: string }[] = [
  { key: 'faturamento',  label: 'Faturamento',   fmt: fmtBRLshort,                                   color: '#5B6BBF' },
  { key: 'pedidos',      label: 'Pedidos',        fmt: fmtNumber,                                     color: '#2E7D5B' },
  { key: 'ticketMedio',  label: 'Ticket Médio',   fmt: fmtBRLshort,                                   color: '#C07A2B' },
  { key: 'ansRate',      label: 'ANS %',          fmt: v => v.toFixed(1).replace('.', ',') + '%',     color: '#8B3A8F' },
  { key: 'rpa',          label: 'RPA',            fmt: fmtBRLshort,                                   color: '#B83A3A' },
  { key: 'cancelados',   label: 'Cancelamentos',  fmt: fmtNumber,                                     color: '#D97B3A' },
];

const WEEK_WINDOW_OPTIONS = [4, 8, 12, 0] as const;
const WINDOW_LABELS: Record<number, string> = { 4: 'Últimas 4', 8: 'Últimas 8', 12: 'Últimas 12', 0: 'Todas' };

interface ComparacaoSemanalScreenProps {
  onNavigate: (route: string) => void;
}

const ComparacaoSemanalScreen: React.FC<ComparacaoSemanalScreenProps> = ({ onNavigate }) => {
  const orders = useOrderStore(s => s.orders);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('faturamento');
  const [weekWindow, setWeekWindow] = useState<number>(8);

  const weeklyData = useMemo<WeekData[]>(() => {
    if (orders.length === 0) return [];

    const map = new Map<string, { year: number; week: number; orders: typeof orders }>();

    for (const order of orders) {
      const date = parseBRDate(order.DataCaptacao);
      if (!date) continue;
      const { year, week } = getISOWeek(date);
      const key = weekSortKey(year, week);
      if (!map.has(key)) map.set(key, { year, week, orders: [] });
      map.get(key)!.orders.push(order);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { year, week, orders: wo }]) => {
        const eligible = wo.filter(
          o => o.SituacaoComercial !== 'Cancelado' && o.DetalheSituacaoComercial !== 'Cancelado Pelo Usuário'
        );
        const faturamento = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
        const pedidos = wo.length;
        const finalizados = eligible.length;
        const cancelados = pedidos - finalizados;
        const ticketMedio = finalizados > 0 ? faturamento / finalizados : 0;
        const ativos = new Set(eligible.map(o => o.Pessoa).filter(Boolean)).size;
        const rpa = ativos > 0 ? faturamento / ativos : 0;
        const ansRate = pedidos > 0 ? (finalizados / pedidos) * 100 : 0;

        return {
          weekKey: weekSortKey(year, week),
          label: weekLabel(year, week),
          faturamento, pedidos, finalizados, cancelados,
          ticketMedio, ativos, rpa, ansRate,
        };
      });
  }, [orders]);

  const visibleWeeks = useMemo(() => {
    if (!weekWindow) return weeklyData;
    return weeklyData.slice(-weekWindow);
  }, [weeklyData, weekWindow]);

  const metric = METRICS.find(m => m.key === activeMetric)!;

  if (orders.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-calendar-dots" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados para comparar</h2>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          Importe uma planilha para visualizar a evolução semanal.
        </p>
        <Button
          variant="primary"
          icon={<i className="ph ph-upload-simple" style={{ fontSize: 16 }} />}
          onClick={() => onNavigate('import')}
        >
          Importar planilha
        </Button>
      </div>
    );
  }

  const totalWeeks = weeklyData.length;
  const lastWeek = visibleWeeks[visibleWeeks.length - 1];
  const prevWeek = visibleWeeks[visibleWeeks.length - 2];
  const delta = lastWeek && prevWeek && prevWeek[activeMetric] > 0
    ? ((lastWeek[activeMetric] - prevWeek[activeMetric]) / prevWeek[activeMetric]) * 100
    : null;

  // Bar chart: last week vs prev week side by side for all metrics
  const comparisonData = [
    { name: 'Faturamento',  lastWeek: lastWeek?.faturamento ?? 0,   prevWeek: prevWeek?.faturamento ?? 0,   _fmt: fmtBRLshort },
    { name: 'Pedidos',      lastWeek: lastWeek?.pedidos ?? 0,        prevWeek: prevWeek?.pedidos ?? 0,        _fmt: fmtNumber },
    { name: 'Finalizados',  lastWeek: lastWeek?.finalizados ?? 0,    prevWeek: prevWeek?.finalizados ?? 0,    _fmt: fmtNumber },
    { name: 'Cancelados',   lastWeek: lastWeek?.cancelados ?? 0,     prevWeek: prevWeek?.cancelados ?? 0,    _fmt: fmtNumber },
    { name: 'Ticket Médio', lastWeek: lastWeek?.ticketMedio ?? 0,    prevWeek: prevWeek?.ticketMedio ?? 0,   _fmt: fmtBRLshort },
    { name: 'RPA',          lastWeek: lastWeek?.rpa ?? 0,            prevWeek: prevWeek?.rpa ?? 0,           _fmt: fmtBRLshort },
    { name: 'ANS %',        lastWeek: lastWeek?.ansRate ?? 0,        prevWeek: prevWeek?.ansRate ?? 0,       _fmt: (v: number) => v.toFixed(1) + '%' },
  ];

  const customTooltipEvolution = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: '#1C1814', color: '#FAF7F2', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, lineHeight: 1.75,
        boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{metric.fmt(p.value)}</strong>
          </div>
        ))}
      </div>
    );
  };

  const customTooltipComparison = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = comparisonData.find(d => d.name === label);
    const fmt = row?._fmt ?? fmtNumber;
    return (
      <div style={{
        background: '#1C1814', color: '#FAF7F2', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, lineHeight: 1.75,
        boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{fmt(p.value)}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
          Análise temporal
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
          Comparação Semanal
        </h1>
        <p style={{ fontSize: 14, color: '#6B6258', margin: 0 }}>
          {totalWeeks} semana{totalWeeks !== 1 ? 's' : ''} com dados — evolução e comparação de métricas isoladas por semana
        </p>
      </div>

      {/* Summary KPIs — last week vs prev */}
      {lastWeek && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Faturamento', value: fmtBRLshort(lastWeek.faturamento), raw: lastWeek.faturamento, prev: prevWeek?.faturamento },
            { label: 'Pedidos', value: fmtNumber(lastWeek.pedidos), raw: lastWeek.pedidos, prev: prevWeek?.pedidos },
            { label: 'Ticket Médio', value: fmtBRLshort(lastWeek.ticketMedio), raw: lastWeek.ticketMedio, prev: prevWeek?.ticketMedio },
            { label: 'ANS %', value: lastWeek.ansRate.toFixed(1).replace('.', ',') + '%', raw: lastWeek.ansRate, prev: prevWeek?.ansRate },
          ].map(kpi => {
            const d = kpi.prev && kpi.prev > 0 ? ((kpi.raw - kpi.prev) / kpi.prev) * 100 : null;
            const isUp = d != null && d >= 0;
            return (
              <div key={kpi.label} style={{
                background: 'white', border: '1px solid #E8E2D6',
                borderRadius: 14, padding: 18,
                boxShadow: '0 2px 6px rgba(28,24,20,0.05)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 11, color: '#9B9287' }}>{lastWeek.label}</div>
                {d != null && (
                  <div style={{ fontSize: 12, fontWeight: 500, color: isUp ? '#2E7D5B' : '#B83A3A', marginTop: 4 }}>
                    {isUp ? '↑' : '↓'} {Math.abs(d).toFixed(1).replace('.', ',')}% vs semana anterior
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Metric tabs + window selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: `1px solid ${activeMetric === m.key ? m.color : '#E8E2D6'}`,
                background: activeMetric === m.key ? m.color : 'white',
                color: activeMetric === m.key ? 'white' : '#3D362E',
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {WEEK_WINDOW_OPTIONS.map(w => (
            <button
              key={w}
              onClick={() => setWeekWindow(w)}
              style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: '1px solid #E8E2D6',
                background: weekWindow === w ? '#1C1814' : 'white',
                color: weekWindow === w ? '#FAF7F2' : '#6B6258',
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {/* Evolution chart */}
      <ChartCard
        title={`Evolução semanal — ${metric.label}`}
        subtitle={`${visibleWeeks.length} semanas exibidas`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={visibleWeeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metric.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#6B6258', fontFamily: 'Inter Tight, sans-serif' }}
              angle={-30} textAnchor="end" height={48}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => {
                if (activeMetric === 'ansRate') return v.toFixed(0) + '%';
                if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
                if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
                return String(Math.round(v));
              }}
              width={52}
            />
            <Tooltip content={customTooltipEvolution} />
            <Area
              type="monotone"
              dataKey={activeMetric}
              name={metric.label}
              stroke={metric.color}
              fill="url(#metricGrad)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: metric.color, stroke: 'white', strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Comparison: last 2 weeks side-by-side */}
      {lastWeek && prevWeek && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Comparação direta — últimas 2 semanas"
            subtitle={`${prevWeek.label} vs ${lastWeek.label}`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparisonData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6B6258', fontFamily: 'Inter Tight, sans-serif' }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={v => {
                    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
                    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
                    return String(Math.round(v));
                  }}
                  width={52}
                />
                <Tooltip content={customTooltipComparison} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#6B6258', paddingTop: 8 }}
                />
                <Bar dataKey="prevWeek" name={prevWeek.label} fill="#D8D0C0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lastWeek" name={lastWeek.label} fill="#5B6BBF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Weekly summary table */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Resumo por semana" subtitle={`${visibleWeeks.length} semanas`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Semana', 'Faturamento', 'Pedidos', 'Finalizados', 'Cancelados', 'Ticket Médio', 'Ativos', 'RPA', 'ANS %'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Semana' ? 'left' : 'right',
                      padding: '8px 12px',
                      borderBottom: '1px solid #E8E2D6',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: '#6B6258',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...visibleWeeks].reverse().map((w, idx) => {
                  const isLast = idx === 0;
                  return (
                    <tr key={w.weekKey} style={{ background: isLast ? 'rgba(91,107,191,0.04)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', fontWeight: isLast ? 600 : 400 }}>
                        {w.label}
                        {isLast && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 600,
                            background: '#5B6BBF', color: 'white',
                            padding: '1px 6px', borderRadius: 4,
                          }}>última</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{fmtBRLshort(w.faturamento)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(w.pedidos)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', color: '#2E7D5B', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(w.finalizados)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', color: w.cancelados > 0 ? '#B83A3A' : '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(w.cancelados)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(w.ticketMedio)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(w.ativos)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtBRLshort(w.rpa)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: w.ansRate >= 80 ? '#2E7D5B' : w.ansRate >= 60 ? '#C07A2B' : '#B83A3A' }}>
                        {w.ansRate.toFixed(1).replace('.', ',')}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default ComparacaoSemanalScreen;
