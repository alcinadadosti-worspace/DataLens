import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Treemap, FunnelChart, Funnel, LabelList,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import RankingList, { RankingItem } from './RankingList';
import { TIER_STYLES } from '../../design-system/tierStyles';
import { fmtNumber } from '../../utils/formatters';

// --- Categorias e estilos ------------------------------------------------
// 3 botões, cada um é um "ciclo": o 1º clique ativa a categoria (mostrando o
// estilo já selecionado nela); cliques seguintes, com a categoria já ativa,
// avançam pro próximo estilo do ciclo.

type Category = 'bar' | 'pie' | 'mais';
type BarStyle = 'horizontal' | 'vertical' | 'stacked';
type PieStyle = 'pie' | 'torta' | 'doughnut';
type MaisStyle = 'treemap' | 'funil' | 'radar' | 'linha' | 'nuvem';

const BAR_CYCLE: BarStyle[] = ['horizontal', 'vertical', 'stacked'];
const PIE_CYCLE: PieStyle[] = ['pie', 'torta', 'doughnut'];
const MAIS_CYCLE: MaisStyle[] = ['treemap', 'funil', 'radar', 'linha', 'nuvem'];

const BAR_META: Record<BarStyle, { icon: string; label: string }> = {
  horizontal: { icon: 'ph-chart-bar-horizontal', label: 'Barras horizontais' },
  vertical: { icon: 'ph-chart-bar', label: 'Barras verticais' },
  stacked: { icon: 'ph-stack', label: 'Colunas empilhadas vs. Meta PEF' },
};
const PIE_META: Record<PieStyle, { icon: string; label: string }> = {
  pie: { icon: 'ph-chart-pie-slice', label: 'Pizza' },
  torta: { icon: 'ph-circle-half', label: 'Torta (fatias destacadas)' },
  doughnut: { icon: 'ph-circle-dashed', label: 'Doughnut' },
};
const MAIS_META: Record<MaisStyle, { icon: string; label: string }> = {
  treemap: { icon: 'ph-squares-four', label: 'Treemap' },
  funil: { icon: 'ph-funnel-simple', label: 'Funil' },
  radar: { icon: 'ph-radar', label: 'Radar' },
  linha: { icon: 'ph-chart-line', label: 'Linha (spline)' },
  nuvem: { icon: 'ph-cloud', label: 'Nuvem de palavras' },
};

const PALETTE = ['#B26A3C', '#C9A227', '#2E7D5B', '#6B7FE0', '#B83A3A', '#6B6258', '#9B9287', '#8A5CB8', '#3D9B9B', '#D88A4E'];
const MEDAL_COLORS = [TIER_STYLES.ouro.accent, TIER_STYLES.prata.accent, TIER_STYLES.bronze.accent];
const OTHERS_LABEL_PREFIX = 'Outros (';

function nextInCycle<T>(cycle: T[], current: T): T {
  return cycle[(cycle.indexOf(current) + 1) % cycle.length];
}

function truncateLabel(s: string, max = 14): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function barColor(i: number, medals: boolean): string {
  return medals && i < 3 ? MEDAL_COLORS[i] : PALETTE[0];
}

const tooltipBoxStyle: React.CSSProperties = { background: '#1C1814', border: 'none', borderRadius: 10, color: '#FAF7F2', fontSize: 14, padding: '10px 14px' };

interface RankingChartProps {
  items: RankingItem[];
  medals?: boolean;
  emptyMessage?: string;
  /** Máximo de fatias/pontos nas views agregadas (pizza, treemap, funil, radar, linha, nuvem) — o resto vira "Outros". */
  maxSlices?: number;
}

// --- Barras verticais ------------------------------------------------

const BarVerticalView: React.FC<{ items: RankingItem[]; medals: boolean; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, medals, height, onSelect }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={items.map(i => ({ ...i, labelShort: truncateLabel(i.label) }))} margin={{ top: 10, right: 12, left: -10, bottom: 55 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE2" vertical={false} />
      <XAxis dataKey="labelShort" tick={{ fontSize: 12, fill: '#6B6258' }} interval={0} angle={-30} textAnchor="end" height={64} />
      <YAxis tick={{ fontSize: 12, fill: '#6B6258' }} />
      <Tooltip
        formatter={(_v: number, _n: string, p: any) => [p.payload.valueLabel, p.payload.label]}
        contentStyle={tooltipBoxStyle}
        itemStyle={{ color: '#FAF7F2' }}
        cursor={{ fill: 'rgba(178,106,60,0.08)' }}
      />
      <Bar
        dataKey="value"
        radius={[6, 6, 0, 0]}
        onClick={onSelect ? (d: any) => onSelect(d.payload ?? d) : undefined}
        cursor={onSelect ? 'pointer' : 'default'}
      >
        {items.map((_, i) => <Cell key={i} fill={barColor(i, medals)} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// --- Colunas empilhadas vs. Meta PEF ------------------------------------------------

function StackedTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item: RankingItem = payload[0].payload;
  return (
    <div style={tooltipBoxStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
      <div>Realizado: {item.valueLabel}</div>
      {item.metaTarget != null && (
        <div style={{ color: item.value >= item.metaTarget ? '#9FD4B8' : '#F0A8B3' }}>
          Meta PEF: {fmtNumber(item.metaTarget)} ({item.value >= item.metaTarget ? 'superada' : 'não superada'})
        </div>
      )}
    </div>
  );
}

const BarStackedView: React.FC<{ items: RankingItem[]; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, height, onSelect }) => {
  const data = items.map(it => {
    const meta = it.metaTarget;
    const atingido = meta != null ? Math.min(it.value, meta) : it.value;
    const faltante = meta != null ? Math.max(0, meta - it.value) : 0;
    const excedente = meta != null ? Math.max(0, it.value - meta) : 0;
    return { ...it, labelShort: truncateLabel(it.label), atingido, faltante, excedente };
  });
  const hasMeta = items.some(i => i.metaTarget != null);
  const click = onSelect ? (d: any) => onSelect(d.payload ?? d) : undefined;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 55 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE2" vertical={false} />
        <XAxis dataKey="labelShort" tick={{ fontSize: 12, fill: '#6B6258' }} interval={0} angle={-30} textAnchor="end" height={64} />
        <YAxis tick={{ fontSize: 12, fill: '#6B6258' }} />
        <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(178,106,60,0.08)' }} />
        {hasMeta && <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => ({ atingido: 'Realizado', excedente: 'Acima da meta', faltante: 'Faltando p/ meta' } as Record<string, string>)[v] ?? v} />}
        <Bar dataKey="atingido" stackId="a" name="atingido" fill="#B26A3C" radius={hasMeta ? [0, 0, 0, 0] : [6, 6, 0, 0]} onClick={click} cursor={onSelect ? 'pointer' : 'default'} />
        <Bar dataKey="excedente" stackId="a" name="excedente" fill="#2E7D5B" radius={[6, 6, 0, 0]} onClick={click} cursor={onSelect ? 'pointer' : 'default'} />
        <Bar dataKey="faltante" stackId="a" name="faltante" fill="#E8E2D6" radius={[6, 6, 0, 0]} onClick={click} cursor={onSelect ? 'pointer' : 'default'} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// --- Pizza / Torta / Doughnut ------------------------------------------------
// Recharts' <Pie> não expõe um jeito de sobrescrever a geometria por fatia (só o "activeShape",
// que só se aplica à fatia em hover) — não dá pra "explodir" todas as fatias pra view Torta com
// ele. Por isso essas 3 variações são desenhadas com arcos SVG manuais.

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number): string {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  if (rInner <= 0) {
    return `M ${cx} ${cy} L ${startOuter.x} ${startOuter.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y} Z`;
  }
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  return `M ${startOuter.x} ${startOuter.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y} Z`;
}

const PieView: React.FC<{ items: RankingItem[]; style: PieStyle; maxSlices: number; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, style, maxSlices, height, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((s, i) => s + i.value, 0);
  const data: RankingItem[] = restTotal > 0 ? [...top, { label: `${OTHERS_LABEL_PREFIX}${rest.length})`, value: restTotal, valueLabel: fmtNumber(restTotal) }] : top;
  const total = data.reduce((s, i) => s + i.value, 0) || 1;

  const size = 240;
  const cx = size / 2, cy = size / 2;
  const rOuter = size * 0.4;
  const rInner = style === 'doughnut' ? rOuter * 0.55 : 0;
  const explodeOffset = style === 'torta' ? 10 : 0;

  let cursor = 0;
  const slices = data.map((it, i) => {
    const angleSpan = (it.value / total) * 360;
    const startAngle = cursor;
    const endAngle = cursor + angleSpan;
    cursor = endAngle;
    const midAngle = (startAngle + endAngle) / 2;
    let sliceCx = cx, sliceCy = cy;
    if (explodeOffset > 0) {
      const off = polarToCartesian(cx, cy, explodeOffset, midAngle);
      sliceCx = off.x;
      sliceCy = off.y;
    }
    return { it, path: describeArc(sliceCx, sliceCy, rOuter, rInner, startAngle, endAngle), i };
  });

  function handleMove(e: React.MouseEvent, idx: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ idx, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const svgSize = Math.min(height - 70, 300);

  return (
    <div ref={containerRef} style={{ position: 'relative', minHeight: height }}>
      <div style={{ position: 'relative', width: svgSize, height: svgSize, margin: '0 auto' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={svgSize} height={svgSize}>
          {slices.map(({ it, path, i }) => {
            const isOther = it.label.startsWith(OTHERS_LABEL_PREFIX);
            return (
              <path
                key={i}
                d={path}
                fill={PALETTE[i % PALETTE.length]}
                stroke="#FAF7F2"
                strokeWidth={2}
                opacity={hover && hover.idx !== i ? 0.72 : 1}
                style={{ cursor: onSelect && !isOther ? 'pointer' : 'default', transition: 'opacity 150ms' }}
                onMouseMove={e => handleMove(e, i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { if (onSelect && !isOther) onSelect(it); }}
              />
            );
          })}
        </svg>
        {style === 'doughnut' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(total)}</div>
          </div>
        )}
      </div>

      {hover && (
        <div style={{ position: 'absolute', left: hover.x + 14, top: hover.y + 14, ...tooltipBoxStyle, pointerEvents: 'none', zIndex: 5, whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600 }}>{data[hover.idx].label}</div>
          <div>{data[hover.idx].valueLabel} · {((data[hover.idx].value / total) * 100).toFixed(0)}%</div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 16 }}>
        {data.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3D362E' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: PALETTE[i % PALETTE.length], display: 'inline-block', flexShrink: 0 }} />
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Treemap ------------------------------------------------

const TreemapCell: React.FC<any> = ({ x, y, width, height, item, fill, onSelect }) => {
  if (width == null || height == null || width < 1 || height < 1) return null;
  const showLabel = width > 54 && height > 30;
  return (
    <g onClick={onSelect ? () => onSelect(item) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: '#FAF7F2', strokeWidth: 2 }} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 19} fontSize={12} fontWeight={600} fill="#fff">{truncateLabel(item.label, Math.max(4, Math.floor(width / 7)))}</text>
          <text x={x + 8} y={y + 35} fontSize={11} fill="rgba(255,255,255,0.85)">{item.valueLabel}</text>
        </>
      )}
    </g>
  );
};

const TreemapView: React.FC<{ items: RankingItem[]; maxSlices: number; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, maxSlices, height, onSelect }) => {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((s, i) => s + i.value, 0);
  const list: RankingItem[] = restTotal > 0 ? [...top, { label: `${OTHERS_LABEL_PREFIX}${rest.length})`, value: restTotal, valueLabel: fmtNumber(restTotal) }] : top;
  const data = list.map((it, i) => ({ name: it.label, size: Math.max(it.value, 0.01), fill: PALETTE[i % PALETTE.length], item: it }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        stroke="#FAF7F2"
        isAnimationActive={false}
        content={<TreemapCell onSelect={onSelect} />}
      />
    </ResponsiveContainer>
  );
};

// --- Funil ------------------------------------------------

const FunnelView: React.FC<{ items: RankingItem[]; maxSlices: number; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, maxSlices, height, onSelect }) => {
  const data = [...items].sort((a, b) => b.value - a.value).slice(0, maxSlices).map((it, i) => ({ ...it, fill: PALETTE[i % PALETTE.length] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <FunnelChart>
        <Tooltip
          formatter={(_v: number, _n: string, p: any) => [p.payload.valueLabel, p.payload.label]}
          contentStyle={tooltipBoxStyle}
          itemStyle={{ color: '#FAF7F2' }}
        />
        <Funnel
          dataKey="value"
          nameKey="label"
          data={data}
          isAnimationActive={false}
          onClick={onSelect ? (d: any) => onSelect(d.payload ?? d) : undefined}
          cursor={onSelect ? 'pointer' : 'default'}
        >
          <LabelList position="right" dataKey="label" fill="#3D362E" fontSize={12} stroke="none" />
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
};

// --- Radar ------------------------------------------------

const RadarView: React.FC<{ items: RankingItem[]; maxSlices: number; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, maxSlices, height, onSelect }) => {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, maxSlices);
  const data = sorted.map(it => ({ labelShort: truncateLabel(it.label, 12), value: it.value, fullItem: it }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#E8E2D6" />
        <PolarAngleAxis dataKey="labelShort" tick={{ fontSize: 11, fill: '#6B6258' }} />
        <PolarRadiusAxis tick={{ fontSize: 10, fill: '#9B9287' }} />
        <Tooltip
          formatter={(_v: number, _n: string, p: any) => [p.payload.fullItem.valueLabel, p.payload.fullItem.label]}
          contentStyle={tooltipBoxStyle}
          itemStyle={{ color: '#FAF7F2' }}
        />
        <Radar
          dataKey="value"
          stroke="#B26A3C"
          fill="#B26A3C"
          fillOpacity={0.32}
          isAnimationActive={false}
          dot={(props: any) => {
            const { cx, cy, payload, index } = props;
            return (
              <circle
                key={index} cx={cx} cy={cy} r={4.5} fill="#B26A3C" stroke="#FAF7F2" strokeWidth={1.5}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                onClick={onSelect ? () => onSelect(payload.fullItem) : undefined}
              />
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

// --- Linha (spline) ------------------------------------------------

const LineView: React.FC<{ items: RankingItem[]; maxSlices: number; height: number; onSelect?: (i: RankingItem) => void }> = ({ items, maxSlices, height, onSelect }) => {
  const top = [...items].sort((a, b) => b.value - a.value).slice(0, maxSlices);
  const data = top.map(i => ({ ...i, labelShort: truncateLabel(i.label) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 14 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE2" />
        <XAxis dataKey="labelShort" tick={{ fontSize: 12, fill: '#6B6258' }} interval={0} angle={-25} textAnchor="end" height={56} />
        <YAxis tick={{ fontSize: 12, fill: '#6B6258' }} />
        <Tooltip
          formatter={(_v: number, _n: string, p: any) => [p.payload.valueLabel, p.payload.label]}
          contentStyle={tooltipBoxStyle}
          itemStyle={{ color: '#FAF7F2' }}
          labelStyle={{ color: '#FAF7F2' }}
        />
        <Line
          type="monotone" dataKey="value" stroke="#B26A3C" strokeWidth={3}
          dot={(props: any) => {
            const { cx, cy, payload, index } = props;
            return (
              <circle
                key={index} cx={cx} cy={cy} r={4} fill="#B26A3C" stroke="#FAF7F2" strokeWidth={1.5}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                onClick={onSelect ? () => onSelect(payload) : undefined}
              />
            );
          }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// --- Nuvem de palavras ------------------------------------------------

const WordCloudView: React.FC<{ items: RankingItem[]; maxSlices: number; onSelect?: (i: RankingItem) => void }> = ({ items, maxSlices, onSelect }) => {
  const top = [...items].sort((a, b) => b.value - a.value).slice(0, maxSlices);
  const max = Math.max(...top.map(i => i.value), 1);
  const min = Math.min(...top.map(i => i.value), 0);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'center', padding: '28px 16px', minHeight: 240 }}>
      {top.map((it, i) => {
        const t = max > min ? (it.value - min) / (max - min) : 1;
        const fontSize = 14 + t * 34;
        const fontWeight = t > 0.66 ? 800 : t > 0.33 ? 650 : 500;
        return (
          <span
            key={i}
            onClick={onSelect ? () => onSelect(it) : undefined}
            title={`${it.label}: ${it.valueLabel}`}
            style={{
              fontSize, fontWeight, color: PALETTE[i % PALETTE.length], lineHeight: 1,
              cursor: onSelect ? 'pointer' : 'default', fontFamily: 'Inter Tight, sans-serif',
            }}
          >
            {it.label}
          </span>
        );
      })}
    </div>
  );
};

// --- Painel de detalhe (tela cheia) ------------------------------------------------

const DetailPanel: React.FC<{ item: RankingItem | null }> = ({ item }) => (
  <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #E8E2D6', padding: 24, overflowY: 'auto' }}>
    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9B9287', marginBottom: 14 }}>
      Detalhe
    </div>
    {!item ? (
      <div style={{ color: '#9B9287', fontSize: 14, lineHeight: 1.6 }}>
        Clique numa barra, fatia, ponto ou palavra do gráfico para ver os detalhes aqui.
      </div>
    ) : (
      <>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{item.label}</div>
        {item.sublabel && <div style={{ fontSize: 13, color: '#9B9287', marginTop: 4 }}>{item.sublabel}</div>}
        <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', marginTop: 16 }}>
          {item.valueLabel || fmtNumber(item.value)}
        </div>
        {item.meta && <div style={{ fontSize: 13, color: '#6B6258', marginTop: 8 }}>{item.meta}</div>}
        {item.metaTarget != null && (
          <div style={{
            marginTop: 18, padding: '12px 14px', borderRadius: 10,
            background: item.value >= item.metaTarget ? '#E0F2E8' : '#FBE5E9',
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6258' }}>Meta PEF</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{fmtNumber(item.metaTarget)}</div>
            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: item.value >= item.metaTarget ? '#2E7D5B' : '#B83A3A' }}>
              {item.value >= item.metaTarget ? 'Superou a meta' : 'Abaixo da meta'}
              {item.metaTarget > 0 && ` (${(((item.value - item.metaTarget) / item.metaTarget) * 100).toFixed(1).replace('.', ',')}%)`}
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

// --- Componente principal ------------------------------------------------

const RankingChart: React.FC<RankingChartProps> = ({ items, medals = true, emptyMessage = 'Sem dados', maxSlices = 8 }) => {
  const [category, setCategory] = useState<Category>('bar');
  const [barStyle, setBarStyle] = useState<BarStyle>('horizontal');
  const [pieStyle, setPieStyle] = useState<PieStyle>('pie');
  const [maisStyle, setMaisStyle] = useState<MaisStyle>('treemap');
  const [fullscreen, setFullscreen] = useState(false);
  const [selected, setSelected] = useState<RankingItem | null>(null);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setFullscreen(false); setSelected(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  function handleCategoryClick(cat: Category) {
    if (category !== cat) { setCategory(cat); return; }
    if (cat === 'bar') setBarStyle(s => nextInCycle(BAR_CYCLE, s));
    else if (cat === 'pie') setPieStyle(s => nextInCycle(PIE_CYCLE, s));
    else setMaisStyle(s => nextInCycle(MAIS_CYCLE, s));
  }

  function openFullscreen() {
    setSelected(null);
    setFullscreen(true);
  }

  function renderBody(height: number, onSelect?: (i: RankingItem) => void) {
    if (category === 'bar') {
      if (barStyle === 'horizontal') return <RankingList items={items} medals={medals} emptyMessage={emptyMessage} onItemClick={onSelect} />;
      if (barStyle === 'vertical') return <BarVerticalView items={items} medals={medals} height={height} onSelect={onSelect} />;
      return <BarStackedView items={items} height={height} onSelect={onSelect} />;
    }
    if (category === 'pie') {
      return <PieView items={items} style={pieStyle} maxSlices={maxSlices} height={height} onSelect={onSelect} />;
    }
    if (maisStyle === 'treemap') return <TreemapView items={items} maxSlices={maxSlices} height={height} onSelect={onSelect} />;
    if (maisStyle === 'funil') return <FunnelView items={items} maxSlices={maxSlices} height={height} onSelect={onSelect} />;
    if (maisStyle === 'radar') return <RadarView items={items} maxSlices={maxSlices} height={height} onSelect={onSelect} />;
    if (maisStyle === 'linha') return <LineView items={items} maxSlices={maxSlices} height={height} onSelect={onSelect} />;
    return <WordCloudView items={items} maxSlices={maxSlices} onSelect={onSelect} />;
  }

  const toolbar = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 3, background: '#F2EEE2', borderRadius: 9, padding: 4 }}>
        <button
          onClick={() => handleCategoryClick('bar')}
          title={BAR_META[barStyle].label + ' — clique de novo para alternar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: category === 'bar' ? '#1C1814' : 'transparent',
            color: category === 'bar' ? 'white' : '#6B6258',
            transition: 'background 150ms, color 150ms',
          }}
        >
          <i className={`ph ${BAR_META[barStyle].icon}`} style={{ fontSize: 16 }} />
        </button>
        <button
          onClick={() => handleCategoryClick('pie')}
          title={PIE_META[pieStyle].label + ' — clique de novo para alternar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: category === 'pie' ? '#1C1814' : 'transparent',
            color: category === 'pie' ? 'white' : '#6B6258',
            transition: 'background 150ms, color 150ms',
          }}
        >
          <i className={`ph ${PIE_META[pieStyle].icon}`} style={{ fontSize: 16 }} />
        </button>
        <button
          onClick={() => handleCategoryClick('mais')}
          title={MAIS_META[maisStyle].label + ' — clique de novo para alternar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: category === 'mais' ? '#1C1814' : 'transparent',
            color: category === 'mais' ? 'white' : '#6B6258',
            transition: 'background 150ms, color 150ms',
          }}
        >
          <i className={`ph ${MAIS_META[maisStyle].icon}`} style={{ fontSize: 16 }} />
        </button>
      </div>
      <button
        onClick={openFullscreen}
        title="Tela cheia — clique numa parte do gráfico para ver os detalhes ao lado"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 9, border: '1px solid #E8E2D6', cursor: 'pointer',
          background: 'white', color: '#6B6258',
        }}
      >
        <i className="ph ph-arrows-out" style={{ fontSize: 15 }} />
      </button>
    </div>
  );

  if (items.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{toolbar}</div>
        <div style={{ padding: '28px 0', textAlign: 'center', color: '#9B9287', fontSize: 14 }}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{toolbar}</div>
      {renderBody(300)}

      {fullscreen && (
        <div
          onClick={() => { setFullscreen(false); setSelected(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(28,24,20,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FAF7F2', borderRadius: 20, width: 'min(1200px, 100%)', height: 'min(760px, 100%)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E8E2D6', flexShrink: 0 }}>
              {toolbar}
              <button
                onClick={() => { setFullscreen(false); setSelected(null); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer', color: '#6B6258', fontSize: 20 }}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
                {renderBody(460, setSelected)}
              </div>
              <DetailPanel item={selected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingChart;
