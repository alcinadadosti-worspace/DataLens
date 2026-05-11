import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useOrderStore } from '../store/useOrderStore';
import { parseBRDate } from '../utils/dateUtils';
import { fmtBRLshort, fmtNumber } from '../utils/formatters';
import ChartCard from '../components/charts/ChartCard';
import Button from '../components/ui/Button';
import { Order } from '../types/order';

/* ─── Types ─────────────────────────────────────────────────── */

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
  peakDayOrders: number;
  peakDayLabel: string;
}

interface RankingItem {
  name: string;
  value: number;
  sub?: string;
}

interface PeriodRankings {
  resellerRevenue: RankingItem | null;
  resellerOrders: RankingItem | null;
  resellerCancelled: RankingItem | null;
  segmentRevenue: RankingItem | null;
  segmentOrders: RankingItem | null;
  supervisorRevenue: RankingItem | null;
  supervisorOrders: RankingItem | null;
  meioCaptacaoOrders: RankingItem | null;
  totalFaturamento: number;
  totalPedidos: number;
}

type MetricKey = 'faturamento' | 'pedidos' | 'finalizados' | 'cancelados' | 'ticketMedio' | 'rpa' | 'ansRate';

/* ─── Constants ──────────────────────────────────────────────── */

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string; color: string }[] = [
  { key: 'faturamento',  label: 'Faturamento',   fmt: fmtBRLshort,                               color: '#5B6BBF' },
  { key: 'pedidos',      label: 'Pedidos',        fmt: fmtNumber,                                 color: '#2E7D5B' },
  { key: 'ticketMedio',  label: 'Ticket Médio',   fmt: fmtBRLshort,                               color: '#C07A2B' },
  { key: 'ansRate',      label: 'ANS %',          fmt: v => v.toFixed(1).replace('.', ',') + '%', color: '#8B3A8F' },
  { key: 'rpa',          label: 'RPA',            fmt: fmtBRLshort,                               color: '#B83A3A' },
  { key: 'cancelados',   label: 'Cancelamentos',  fmt: fmtNumber,                                 color: '#D97B3A' },
];

const WEEK_WINDOW_OPTIONS = [4, 8, 12, 0] as const;
const WINDOW_LABELS: Record<number, string> = { 4: 'Últimas 4', 8: 'Últimas 8', 12: 'Últimas 12', 0: 'Todas' };

const COMP_WINDOW_OPTIONS: (2 | 3 | 4)[] = [2, 3, 4];

const COLOR_A = '#5B6BBF';
const COLOR_B = '#2E7D5B';

/* ─── Helpers ────────────────────────────────────────────────── */

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7) + 1;
  return { year: d.getFullYear(), week };
}

function weekLabel(year: number, week: number) {
  return `Sem ${String(week).padStart(2, '0')}/${year}`;
}

function weekSortKey(year: number, week: number) {
  return `${year}-${String(week).padStart(2, '0')}`;
}

function isCancelled(o: Order) {
  return o.SituacaoComercial === 'Cancelado' || o.DetalheSituacaoComercial === 'Cancelado Pelo Usuário';
}

function yFmt(v: number, isRate = false) {
  if (isRate) return v.toFixed(0) + '%';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return String(Math.round(v));
}

function computeRankings(orders: Order[]): PeriodRankings {
  if (!orders.length) {
    return {
      resellerRevenue: null, resellerOrders: null, resellerCancelled: null,
      segmentRevenue: null, segmentOrders: null,
      supervisorRevenue: null, supervisorOrders: null,
      meioCaptacaoOrders: null, totalFaturamento: 0, totalPedidos: 0,
    };
  }

  const resellers = new Map<string, { revenue: number; orders: number; cancelled: number; id: string }>();
  const segments = new Map<string, { revenue: number; orders: number }>();
  const supervisors = new Map<string, { revenue: number; orders: number }>();
  const meios = new Map<string, number>();

  for (const o of orders) {
    const key = o.NomePessoa || o.Pessoa || 'Desconhecido';
    const cancelled = isCancelled(o);
    const eligible = !cancelled;

    // Resellers
    if (!resellers.has(key)) resellers.set(key, { revenue: 0, orders: 0, cancelled: 0, id: o.Pessoa });
    const r = resellers.get(key)!;
    r.orders++;
    if (cancelled) r.cancelled++;
    if (eligible) r.revenue += o.ValorPraticado;

    // Segments (Papel / tier)
    const seg = o.Papel || 'Sem segmentação';
    if (!segments.has(seg)) segments.set(seg, { revenue: 0, orders: 0 });
    const s = segments.get(seg)!;
    s.orders++;
    if (eligible) s.revenue += o.ValorPraticado;

    // Supervisors
    const sup = o.ResponsavelEstrutura || 'Sem supervisor';
    if (!supervisors.has(sup)) supervisors.set(sup, { revenue: 0, orders: 0 });
    const sv = supervisors.get(sup)!;
    sv.orders++;
    if (eligible) sv.revenue += o.ValorPraticado;

    // Meio captação
    const meio = o.MeioCaptacao || 'Desconhecido';
    meios.set(meio, (meios.get(meio) ?? 0) + 1);
  }

  function topBy<T extends object>(map: Map<string, T>, key: keyof T): [string, T] | null {
    let best: [string, T] | null = null;
    for (const entry of map.entries()) {
      if (!best || (entry[1][key] as number) > (best[1][key] as number)) best = entry;
    }
    return best;
  }

  const topResellerRev = topBy(resellers, 'revenue');
  const topResellerOrd = topBy(resellers, 'orders');
  const topResellerCanc = topBy(resellers, 'cancelled');
  const topSegRev = topBy(segments, 'revenue');
  const topSegOrd = topBy(segments, 'orders');
  const topSupRev = topBy(supervisors, 'revenue');
  const topSupOrd = topBy(supervisors, 'orders');

  let topMeio: [string, number] | null = null;
  for (const entry of meios.entries()) {
    if (!topMeio || entry[1] > topMeio[1]) topMeio = entry;
  }

  const eligible = orders.filter(o => !isCancelled(o));

  return {
    resellerRevenue: topResellerRev
      ? { name: topResellerRev[0], value: topResellerRev[1].revenue, sub: `${topResellerRev[1].orders} pedidos` }
      : null,
    resellerOrders: topResellerOrd
      ? { name: topResellerOrd[0], value: topResellerOrd[1].orders, sub: fmtBRLshort(topResellerOrd[1].revenue) }
      : null,
    resellerCancelled: topResellerCanc && topResellerCanc[1].cancelled > 0
      ? { name: topResellerCanc[0], value: topResellerCanc[1].cancelled }
      : null,
    segmentRevenue: topSegRev
      ? { name: topSegRev[0], value: topSegRev[1].revenue, sub: `${topSegRev[1].orders} pedidos` }
      : null,
    segmentOrders: topSegOrd
      ? { name: topSegOrd[0], value: topSegOrd[1].orders, sub: fmtBRLshort(topSegOrd[1].revenue) }
      : null,
    supervisorRevenue: topSupRev
      ? { name: topSupRev[0], value: topSupRev[1].revenue, sub: `${topSupRev[1].orders} pedidos` }
      : null,
    supervisorOrders: topSupOrd
      ? { name: topSupOrd[0], value: topSupOrd[1].orders, sub: fmtBRLshort(topSupOrd[1].revenue) }
      : null,
    meioCaptacaoOrders: topMeio
      ? { name: topMeio[0], value: topMeio[1] }
      : null,
    totalFaturamento: eligible.reduce((s, o) => s + o.ValorPraticado, 0),
    totalPedidos: orders.length,
  };
}

/* ─── Sub-components ─────────────────────────────────────────── */

interface RankCardProps {
  icon: string;
  label: string;
  accentColor: string;
  itemA: RankingItem | null;
  itemB: RankingItem | null;
  fmtVal: (v: number) => string;
  labelA: string;
  labelB: string;
  showB: boolean;
}

const RankCard: React.FC<RankCardProps> = ({ icon, label, accentColor, itemA, itemB, fmtVal, labelA, labelB, showB }) => {
  const maxVal = Math.max(itemA?.value ?? 0, itemB?.value ?? 0) || 1;

  const Item: React.FC<{ item: RankingItem | null; color: string; periodLabel: string }> = ({ item, color, periodLabel }) => (
    <div style={{ marginBottom: showB ? 14 : 0 }}>
      {showB && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color, marginBottom: 4 }}>
          {periodLabel}
        </div>
      )}
      {item ? (
        <>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#1C1814',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '100%',
          }} title={item.name}>
            {item.name}
          </div>
          {item.sub && (
            <div style={{ fontSize: 11, color: '#6B6258', marginBottom: 4 }}>{item.sub}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1, height: 5, background: '#F2EEE6', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${(item.value / maxVal) * 100}%`,
                height: '100%', background: color, borderRadius: 3,
                transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {fmtVal(item.value)}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#9B9287', fontStyle: 'italic' }}>Sem dados</div>
      )}
    </div>
  );

  return (
    <div style={{
      background: 'white', border: '1px solid #E8E2D6', borderRadius: 12,
      padding: '14px 16px',
      borderLeft: `3px solid ${accentColor}`,
      boxShadow: '0 1px 4px rgba(28,24,20,0.05)',
      transition: 'box-shadow 200ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <i className={`ph ph-${icon}`} style={{ fontSize: 14, color: accentColor }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
          {label}
        </span>
      </div>
      <Item item={itemA} color={COLOR_A} periodLabel={labelA} />
      {showB && <Item item={itemB} color={COLOR_B} periodLabel={labelB} />}
    </div>
  );
};

/* Two-week metric comparison card (fixes scale issue in shared bar chart) */
interface MetricCompCardProps {
  label: string;
  lastValue: number;
  prevValue: number;
  lastLabel: string;
  prevLabel: string;
  fmt: (v: number) => string;
  color: string;
}

const MetricCompCard: React.FC<MetricCompCardProps> = ({
  label, lastValue, prevValue, lastLabel, prevLabel, fmt, color,
}) => {
  const maxVal = Math.max(lastValue, prevValue) || 1;
  const delta = prevValue > 0 ? ((lastValue - prevValue) / prevValue) * 100 : null;
  const isUp = delta != null && delta >= 0;

  return (
    <div style={{
      background: 'white', border: '1px solid #E8E2D6', borderRadius: 12,
      padding: '14px 16px', boxShadow: '0 1px 4px rgba(28,24,20,0.05)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 10 }}>
        {label}
      </div>

      {[
        { val: prevValue, lbl: prevLabel, barColor: '#D8D0C0', textColor: '#6B6258' },
        { val: lastValue, lbl: lastLabel, barColor: color, textColor: '#1C1814' },
      ].map(row => (
        <div key={row.lbl} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: row.textColor, marginBottom: 3, fontWeight: row.textColor === '#1C1814' ? 600 : 400 }}>
            <span>{row.lbl}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(row.val)}</span>
          </div>
          <div style={{ height: 6, background: '#F2EEE6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(row.val / maxVal) * 100}%`,
              height: '100%', background: row.barColor, borderRadius: 3,
              transition: 'width 500ms ease',
            }} />
          </div>
        </div>
      ))}

      {delta != null && (
        <div style={{ fontSize: 11, fontWeight: 600, color: isUp ? '#2E7D5B' : '#B83A3A', marginTop: 6 }}>
          {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1).replace('.', ',')}%
        </div>
      )}
    </div>
  );
};

/* ─── Main Screen ────────────────────────────────────────────── */

interface ComparacaoSemanalScreenProps {
  onNavigate: (route: string) => void;
}

const ComparacaoSemanalScreen: React.FC<ComparacaoSemanalScreenProps> = ({ onNavigate }) => {
  const orders = useOrderStore(s => s.orders);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('faturamento');
  const [weekWindow, setWeekWindow] = useState<2 | 3 | 4>(4);
  const [evolWindow, setEvolWindow] = useState<2 | 3 | 4>(4);
  const [compWindow, setCompWindow] = useState<2 | 3 | 4>(2);
  const [compMetric, setCompMetric] = useState<MetricKey>('faturamento');
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  /* ── Weekly aggregation ── */
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
        const eligible = wo.filter(o => !isCancelled(o));
        const faturamento = eligible.reduce((s, o) => s + o.ValorPraticado, 0);
        const pedidos = wo.length;
        const finalizados = eligible.length;
        const cancelados = pedidos - finalizados;
        const ticketMedio = finalizados > 0 ? faturamento / finalizados : 0;
        const ativos = new Set(eligible.map(o => o.Pessoa).filter(Boolean)).size;
        const rpa = ativos > 0 ? faturamento / ativos : 0;
        const ansRate = pedidos > 0 ? (finalizados / pedidos) * 100 : 0;

        // Daily peak within week
        const dayMap = new Map<string, number>();
        for (const o of wo) {
          const d = parseBRDate(o.DataCaptacao);
          if (!d) continue;
          const dk = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          dayMap.set(dk, (dayMap.get(dk) ?? 0) + 1);
        }
        let peakDayOrders = 0; let peakDayLabel = '';
        for (const [dk, cnt] of dayMap) {
          if (cnt > peakDayOrders) { peakDayOrders = cnt; peakDayLabel = dk; }
        }

        return {
          weekKey: weekSortKey(year, week), label: weekLabel(year, week),
          faturamento, pedidos, finalizados, cancelados, ticketMedio, ativos, rpa, ansRate,
          peakDayOrders, peakDayLabel,
        };
      });
  }, [orders]);

  const visibleWeeks = useMemo(
    () => weekWindow ? weeklyData.slice(-weekWindow) : weeklyData,
    [weeklyData, weekWindow],
  );

  const evolWeeks = useMemo(
    () => weeklyData.slice(-evolWindow),
    [weeklyData, evolWindow],
  );

  /* ── Period comparison ── */
  const periodAWeeks = useMemo(() => weeklyData.slice(-compWindow), [weeklyData, compWindow]);
  const periodBWeeks = useMemo(() => {
    if (weeklyData.length <= compWindow) return [];
    return weeklyData.slice(-(compWindow * 2), -compWindow);
  }, [weeklyData, compWindow]);

  const hasPeriodB = periodBWeeks.length > 0;

  const getOrdersForWeeks = useCallback((weeks: WeekData[]) => {
    if (!weeks.length) return [];
    const first = weeks[0].weekKey;
    const last = weeks[weeks.length - 1].weekKey;
    return orders.filter(o => {
      const d = parseBRDate(o.DataCaptacao);
      if (!d) return false;
      const { year, week } = getISOWeek(d);
      const k = weekSortKey(year, week);
      return k >= first && k <= last;
    });
  }, [orders]);

  const periodAOrders = useMemo(() => getOrdersForWeeks(periodAWeeks), [periodAWeeks, getOrdersForWeeks]);
  const periodBOrders = useMemo(() => getOrdersForWeeks(periodBWeeks), [periodBWeeks, getOrdersForWeeks]);

  const rankingsA = useMemo(() => computeRankings(periodAOrders), [periodAOrders]);
  const rankingsB = useMemo(() => computeRankings(periodBOrders), [periodBOrders]);

  const compMetricDef = METRICS.find(m => m.key === compMetric)!;
  const metric = METRICS.find(m => m.key === activeMetric)!;
  const hasCancelamentos = visibleWeeks.some(w => w.cancelados > 0);
  const maxPeakInVisible = Math.max(...visibleWeeks.map(w => w.peakDayOrders), 0);

  /* ── Comparison line/bar data ── */
  const compLineData = useMemo(() => {
    const maxLen = Math.max(periodAWeeks.length, periodBWeeks.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      semana: `Sem ${i + 1}`,
      periodoA: periodAWeeks[i] != null ? (periodAWeeks[i][compMetric] as number) : null,
      periodoB: periodBWeeks[i] != null ? (periodBWeeks[i][compMetric] as number) : null,
    }));
  }, [periodAWeeks, periodBWeeks, compMetric]);

  const aggregateData = useMemo(() => {
    const sum = (arr: WeekData[], k: MetricKey) => arr.reduce((s, w) => s + (w[k] as number), 0);
    const avg = (arr: WeekData[], k: MetricKey) => arr.length ? sum(arr, k) / arr.length : 0;
    const isAvg = (k: MetricKey) => ['ticketMedio', 'rpa', 'ansRate'].includes(k);
    const calc = (arr: WeekData[], k: MetricKey) => isAvg(k) ? avg(arr, k) : sum(arr, k);
    return [
      { name: 'Faturamento',  periodoA: calc(periodAWeeks, 'faturamento'),  periodoB: calc(periodBWeeks, 'faturamento'),  fmt: fmtBRLshort },
      { name: 'Pedidos',      periodoA: calc(periodAWeeks, 'pedidos'),      periodoB: calc(periodBWeeks, 'pedidos'),      fmt: fmtNumber },
      { name: 'Cancelados',   periodoA: calc(periodAWeeks, 'cancelados'),   periodoB: calc(periodBWeeks, 'cancelados'),   fmt: fmtNumber },
      { name: 'Ticket Médio', periodoA: calc(periodAWeeks, 'ticketMedio'),  periodoB: calc(periodBWeeks, 'ticketMedio'),  fmt: fmtBRLshort },
      { name: 'RPA',          periodoA: calc(periodAWeeks, 'rpa'),          periodoB: calc(periodBWeeks, 'rpa'),          fmt: fmtBRLshort },
    ];
  }, [periodAWeeks, periodBWeeks]);

  /* ── PDF Export ── */
  const handleExportPDF = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const canvas = await html2canvas(exportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#FAF7F2',
        logging: false,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      const pageCount = Math.ceil(imgH / ph);

      for (let p = 0; p < pageCount; p++) {
        if (p > 0) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL('image/png'), 'PNG',
          0, -(p * ph), pw, imgH,
        );
      }

      const now = new Date();
      const stamp = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;
      pdf.save(`comparacao-semanal-${stamp}.pdf`);
    } catch (e) {
      console.error('Erro ao exportar PDF', e);
    } finally {
      setExporting(false);
    }
  }, []);

  /* ── Tooltip helpers ── */
  const ttStyle: React.CSSProperties = {
    background: '#1C1814', color: '#FAF7F2', borderRadius: 10,
    padding: '10px 14px', fontSize: 12, lineHeight: 1.75,
    boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
  };

  const ttEvol = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{metric.fmt(p.value)}</strong>
          </div>
        ))}
      </div>
    );
  };

  const ttCompLine = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => p.value != null && (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{compMetricDef.fmt(p.value)}</strong>
          </div>
        ))}
      </div>
    );
  };

  const ttCompBar = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = aggregateData.find(d => d.name === label);
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{(row?.fmt ?? fmtNumber)(p.value)}</strong>
          </div>
        ))}
      </div>
    );
  };

  const ttFat = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ color: COLOR_A }}>Faturamento: <strong>{fmtBRLshort(payload[0]?.value ?? 0)}</strong></div>
      </div>
    );
  };

  const ttCanc = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#D97B3A' }}>Cancelados: <strong>{fmtNumber(payload[0]?.value ?? 0)}</strong></div>
      </div>
    );
  };

  const ttPeak = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const w = visibleWeeks.find(w => w.label === label);
    return (
      <div style={ttStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#C07A2B' }}>Pico diário: <strong>{fmtNumber(payload[0]?.value ?? 0)} pedidos</strong></div>
        {w?.peakDayLabel && <div style={{ color: '#9B9287', fontSize: 11 }}>Dia: {w.peakDayLabel}</div>}
      </div>
    );
  };

  /* ── Period label helpers ── */
  const periodLabel = (weeks: WeekData[]) =>
    weeks.length ? `${weeks[0].label} — ${weeks[weeks.length - 1].label}` : '—';

  const pillBtn = (active: boolean, color = '#1C1814'): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? color : '#E8E2D6'}`,
    background: active ? color : 'white',
    color: active ? 'white' : '#6B6258',
    cursor: 'pointer', transition: 'all 150ms',
  });

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#6B6258', margin: '32px 0 12px',
    }}>{text}</div>
  );

  /* ── KPI cards ── */
  const lastWeek = visibleWeeks[visibleWeeks.length - 1];
  const prevWeek = visibleWeeks[visibleWeeks.length - 2];

  /* ── Comparison direct metrics (one card per metric) ── */
  const directCompMetrics = lastWeek && prevWeek ? [
    { label: 'Faturamento',  last: lastWeek.faturamento,  prev: prevWeek.faturamento,  fmt: fmtBRLshort, color: '#5B6BBF' },
    { label: 'Pedidos',      last: lastWeek.pedidos,      prev: prevWeek.pedidos,      fmt: fmtNumber,   color: '#2E7D5B' },
    { label: 'Finalizados',  last: lastWeek.finalizados,  prev: prevWeek.finalizados,  fmt: fmtNumber,   color: '#2E7D5B' },
    { label: 'Cancelados',   last: lastWeek.cancelados,   prev: prevWeek.cancelados,   fmt: fmtNumber,   color: '#D97B3A' },
    { label: 'Ticket Médio', last: lastWeek.ticketMedio,  prev: prevWeek.ticketMedio,  fmt: fmtBRLshort, color: '#C07A2B' },
    { label: 'RPA',          last: lastWeek.rpa,          prev: prevWeek.rpa,          fmt: fmtBRLshort, color: '#B83A3A' },
    { label: 'ANS %',        last: lastWeek.ansRate,      prev: prevWeek.ansRate,      fmt: (v: number) => v.toFixed(1).replace('.',',' ) + '%', color: '#8B3A8F' },
  ] : [];

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

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '32px 32px 64px' }} ref={exportRef}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
            Análise temporal
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
            Comparação Semanal
          </h1>
          <p style={{ fontSize: 14, color: '#6B6258', margin: 0 }}>
            {weeklyData.length} semana{weeklyData.length !== 1 ? 's' : ''} com dados
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: '1px solid #E8E2D6',
            background: exporting ? '#F2EEE6' : '#1C1814',
            color: exporting ? '#9B9287' : 'white',
            cursor: exporting ? 'default' : 'pointer',
            transition: 'all 150ms',
          }}
        >
          <i className={`ph ph-${exporting ? 'spinner' : 'file-pdf'}`} style={{ fontSize: 16 }} />
          {exporting ? 'Gerando PDF…' : 'Exportar Relatório'}
        </button>
      </div>

      {/* ── KPI summary cards ── */}
      {lastWeek && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Faturamento', value: fmtBRLshort(lastWeek.faturamento), raw: lastWeek.faturamento, prev: prevWeek?.faturamento },
            { label: 'Pedidos',     value: fmtNumber(lastWeek.pedidos),        raw: lastWeek.pedidos,     prev: prevWeek?.pedidos },
            { label: 'Ticket Médio',value: fmtBRLshort(lastWeek.ticketMedio),  raw: lastWeek.ticketMedio, prev: prevWeek?.ticketMedio },
            { label: 'ANS %',       value: lastWeek.ansRate.toFixed(1).replace('.', ',') + '%', raw: lastWeek.ansRate, prev: prevWeek?.ansRate },
          ].map(kpi => {
            const d = kpi.prev && kpi.prev > 0 ? ((kpi.raw - kpi.prev) / kpi.prev) * 100 : null;
            const isUp = d != null && d >= 0;
            return (
              <div key={kpi.label} style={{
                background: 'white', border: '1px solid #E8E2D6',
                borderRadius: 14, padding: 18, boxShadow: '0 2px 6px rgba(28,24,20,0.05)',
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

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: FATURAMENTO SEMANAL
      ═══════════════════════════════════════════════════════ */}
      {sectionLabel('Faturamento Semanal')}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: 4 }}>
        {COMP_WINDOW_OPTIONS.map(w => (
          <button key={w} onClick={() => setWeekWindow(w)} style={pillBtn(weekWindow === w)}>{w} semanas</button>
        ))}
      </div>
      <ChartCard title="Faturamento semanal" subtitle={`${visibleWeeks.length} semanas`}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={visibleWeeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_A} stopOpacity={0.15} />
                <stop offset="95%" stopColor={COLOR_A} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B6258' }} angle={-25} textAnchor="end" height={44} />
            <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => yFmt(v)} width={56} />
            <Tooltip content={ttFat} />
            <Area type="monotone" dataKey="faturamento" name="Faturamento"
              stroke={COLOR_A} fill="url(#fatGrad)" strokeWidth={2.5}
              dot={{ r: 3, fill: COLOR_A, stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: CANCELAMENTOS SEMANAIS (condicional)
      ═══════════════════════════════════════════════════════ */}
      {hasCancelamentos && (
        <>
          {sectionLabel('Cancelamentos Semanais')}
          <ChartCard title="Cancelamentos por semana" subtitle="Pedidos com status cancelado">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={visibleWeeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B6258' }} angle={-25} textAnchor="end" height={44} />
                <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={v => String(Math.round(v))} width={36} />
                <Tooltip content={ttCanc} />
                <Bar dataKey="cancelados" name="Cancelados" radius={[4, 4, 0, 0]}>
                  {visibleWeeks.map((w, i) => (
                    <Cell key={i} fill={w.cancelados > 0 ? '#D97B3A' : '#E8E2D6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: PICOS DE PEDIDOS
      ═══════════════════════════════════════════════════════ */}
      {sectionLabel('Picos de Pedidos')}
      <ChartCard title="Pico diário de pedidos por semana" subtitle="Maior volume em um único dia de cada semana">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={visibleWeeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B6258' }} angle={-25} textAnchor="end" height={44} />
            <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => String(Math.round(v))} width={36} />
            <Tooltip content={ttPeak} />
            {maxPeakInVisible > 0 && (
              <ReferenceLine y={maxPeakInVisible} stroke="#C07A2B" strokeDasharray="4 3"
                label={{ value: `Máx. ${fmtNumber(maxPeakInVisible)}`, fontSize: 10, fill: '#C07A2B', position: 'insideTopRight' }} />
            )}
            <Bar dataKey="peakDayOrders" name="Pico diário" radius={[4, 4, 0, 0]}>
              {visibleWeeks.map((w, i) => (
                <Cell key={i} fill={w.peakDayOrders === maxPeakInVisible && maxPeakInVisible > 0 ? '#C07A2B' : '#D8D0C0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: COMPARAÇÃO X vs Y
      ═══════════════════════════════════════════════════════ */}
      {sectionLabel('Comparação de Períodos — X vs Y')}

      {/* Period selector panel */}
      <div style={{
        background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
        padding: '18px 20px', marginBottom: 16, boxShadow: '0 2px 6px rgba(28,24,20,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 8 }}>
              Janela
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {COMP_WINDOW_OPTIONS.map(w => (
                <button key={w} onClick={() => setCompWindow(w)} style={pillBtn(compWindow === w)}>
                  {w} semanas
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { color: COLOR_A, label: 'Período A (mais recente)', weeks: periodAWeeks },
              { color: COLOR_B, label: 'Período B (anterior)', weeks: periodBWeeks },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3D362E' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#9B9287' }}>
                    {p.weeks.length ? periodLabel(p.weeks) : 'Dados insuficientes'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 8 }}>
              Métrica
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {METRICS.map(m => (
                <button key={m.key} onClick={() => setCompMetric(m.key)} style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${compMetric === m.key ? m.color : '#E8E2D6'}`,
                  background: compMetric === m.key ? m.color : 'white',
                  color: compMetric === m.key ? 'white' : '#3D362E',
                  cursor: 'pointer', transition: 'all 150ms',
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hasPeriodB ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <ChartCard title={`${compMetricDef.label} — semana a semana`} subtitle="Períodos alinhados relativamente">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={compLineData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#6B6258' }} />
                <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={v => yFmt(v, compMetric === 'ansRate')} width={52} />
                <Tooltip content={ttCompLine} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="periodoA" name={`Período A`}
                  stroke={COLOR_A} strokeWidth={2.5} dot={{ r: 4, fill: COLOR_A, stroke: 'white', strokeWidth: 2 }}
                  connectNulls activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="periodoB" name={`Período B`}
                  stroke={COLOR_B} strokeWidth={2.5} strokeDasharray="5 3"
                  dot={{ r: 4, fill: COLOR_B, stroke: 'white', strokeWidth: 2 }}
                  connectNulls activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Totais agregados por período" subtitle="Soma / média das métricas em cada período">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aggregateData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6258' }} />
                <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={v => yFmt(v)} width={52} />
                <Tooltip content={ttCompBar} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="periodoA" name="Período A" fill={COLOR_A} radius={[4, 4, 0, 0]} />
                <Bar dataKey="periodoB" name="Período B" fill={COLOR_B} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : (
        <div style={{
          background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
          padding: '28px 24px', textAlign: 'center', color: '#9B9287', fontSize: 14, marginBottom: 20,
        }}>
          <i className="ph ph-warning" style={{ fontSize: 28, display: 'block', marginBottom: 8, color: '#D8D0C0' }} />
          Dados insuficientes para o Período B com janela de {compWindow} semanas.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: RANKINGS / DESTAQUES
      ═══════════════════════════════════════════════════════ */}
      {sectionLabel('Destaques por Período')}

      {/* Category header legend */}
      <div style={{
        background: '#1C1814', borderRadius: 14, padding: '16px 20px', marginBottom: 16,
        display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FAF7F2', marginBottom: 2 }}>Rankings comparativos</div>
          <div style={{ fontSize: 11, color: '#9B9287' }}>
            Baseado nos pedidos de cada período selecionado
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_A }} />
            <span style={{ fontSize: 11, color: '#D8D0C0' }}>Período A — {periodLabel(periodAWeeks)}</span>
          </div>
          {hasPeriodB && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_B }} />
              <span style={{ fontSize: 11, color: '#D8D0C0' }}>Período B — {periodLabel(periodBWeeks)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rankings grid */}
      {[
        {
          category: 'Revendedores',
          icon: 'users',
          color: '#5B6BBF',
          rows: [
            {
              icon: 'trophy', label: 'Maior faturamento',
              itemA: rankingsA.resellerRevenue,
              itemB: rankingsB.resellerRevenue,
              fmtVal: fmtBRLshort,
            },
            {
              icon: 'shopping-cart-simple', label: 'Mais pedidos',
              itemA: rankingsA.resellerOrders,
              itemB: rankingsB.resellerOrders,
              fmtVal: (v: number) => `${fmtNumber(v)} pedidos`,
            },
            ...(rankingsA.resellerCancelled || rankingsB.resellerCancelled ? [{
              icon: 'x-circle', label: 'Mais cancelamentos',
              itemA: rankingsA.resellerCancelled,
              itemB: rankingsB.resellerCancelled,
              fmtVal: (v: number) => `${fmtNumber(v)} cancel.`,
            }] : []),
          ],
        },
        {
          category: 'Segmentação',
          icon: 'chart-pie',
          color: '#8B3A8F',
          rows: [
            {
              icon: 'currency-dollar', label: 'Maior faturamento',
              itemA: rankingsA.segmentRevenue,
              itemB: rankingsB.segmentRevenue,
              fmtVal: fmtBRLshort,
            },
            {
              icon: 'list-bullets', label: 'Mais pedidos',
              itemA: rankingsA.segmentOrders,
              itemB: rankingsB.segmentOrders,
              fmtVal: (v: number) => `${fmtNumber(v)} pedidos`,
            },
          ],
        },
        {
          category: 'Supervisores',
          icon: 'identification-badge',
          color: '#C07A2B',
          rows: [
            {
              icon: 'currency-dollar', label: 'Maior faturamento',
              itemA: rankingsA.supervisorRevenue,
              itemB: rankingsB.supervisorRevenue,
              fmtVal: fmtBRLshort,
            },
            {
              icon: 'check-circle', label: 'Mais pedidos fechados',
              itemA: rankingsA.supervisorOrders,
              itemB: rankingsB.supervisorOrders,
              fmtVal: (v: number) => `${fmtNumber(v)} pedidos`,
            },
          ],
        },
        {
          category: 'Meio de Captação',
          icon: 'device-mobile',
          color: '#2E7D5B',
          rows: [
            {
              icon: 'star', label: 'Canal mais utilizado',
              itemA: rankingsA.meioCaptacaoOrders,
              itemB: rankingsB.meioCaptacaoOrders,
              fmtVal: (v: number) => `${fmtNumber(v)} pedidos`,
            },
          ],
        },
      ].map(section => (
        <div key={section.category} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: section.color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`ph ph-${section.icon}`} style={{ fontSize: 14, color: section.color }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: section.color }}>{section.category}</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(section.rows.length, 3)}, 1fr)`,
            gap: 12,
          }}>
            {section.rows.map(row => (
              <RankCard
                key={row.label}
                icon={row.icon}
                label={row.label}
                accentColor={section.color}
                itemA={row.itemA}
                itemB={row.itemB ?? null}
                fmtVal={row.fmtVal}
                labelA={`Período A — ${periodLabel(periodAWeeks)}`}
                labelB={`Período B — ${periodLabel(periodBWeeks)}`}
                showB={hasPeriodB}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: COMPARAÇÃO DIRETA (últimas 2 semanas)
      ═══════════════════════════════════════════════════════ */}
      {lastWeek && prevWeek && (
        <>
          {sectionLabel(`Comparação Direta — ${prevWeek.label} vs ${lastWeek.label}`)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {directCompMetrics.map(m => (
              <MetricCompCard
                key={m.label}
                label={m.label}
                lastValue={m.last}
                prevValue={m.prev}
                lastLabel={lastWeek.label}
                prevLabel={prevWeek.label}
                fmt={m.fmt}
                color={m.color}
              />
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: EVOLUÇÃO GERAL (métrica selecionável)
      ═══════════════════════════════════════════════════════ */}
      {sectionLabel('Evolução Geral')}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: `1px solid ${activeMetric === m.key ? m.color : '#E8E2D6'}`,
              background: activeMetric === m.key ? m.color : 'white',
              color: activeMetric === m.key ? 'white' : '#3D362E',
              cursor: 'pointer', transition: 'all 150ms',
            }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {COMP_WINDOW_OPTIONS.map(w => (
            <button key={w} onClick={() => setEvolWindow(w)} style={pillBtn(evolWindow === w)}>{w} semanas</button>
          ))}
        </div>
      </div>
      <ChartCard title={`Evolução semanal — ${metric.label}`} subtitle={`${evolWeeks.length} semanas`}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={evolWeeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metric.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE6" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B6258' }} angle={-30} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 9, fill: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => yFmt(v, activeMetric === 'ansRate')} width={52} />
            <Tooltip content={ttEvol} />
            <Area type="monotone" dataKey={activeMetric} name={metric.label}
              stroke={metric.color} fill="url(#metricGrad)" strokeWidth={2.5}
              dot={{ r: 3, fill: metric.color, stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: TABELA RESUMO
      ═══════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Resumo por semana" subtitle={`${visibleWeeks.length} semanas`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Semana', 'Faturamento', 'Pedidos', 'Finalizados', 'Cancelados', 'Ticket Médio', 'Ativos', 'RPA', 'ANS %', 'Pico/dia'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Semana' ? 'left' : 'right', padding: '8px 12px',
                      borderBottom: '1px solid #E8E2D6',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: '#6B6258', whiteSpace: 'nowrap',
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
                        {isLast && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, background: '#5B6BBF', color: 'white', padding: '1px 6px', borderRadius: 4 }}>última</span>}
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
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: w.peakDayOrders === maxPeakInVisible && maxPeakInVisible > 0 ? '#C07A2B' : '#3D362E', fontWeight: w.peakDayOrders === maxPeakInVisible && maxPeakInVisible > 0 ? 600 : 400 }}>
                        {fmtNumber(w.peakDayOrders)}
                        {w.peakDayLabel && <span style={{ fontSize: 10, color: '#9B9287', marginLeft: 4 }}>({w.peakDayLabel})</span>}
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
