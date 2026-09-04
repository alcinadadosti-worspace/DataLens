import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import RankingList, { RankingItem } from './RankingList';

type ChartView = 'bar' | 'pie' | 'spline';

const VIEW_OPTIONS: { id: ChartView; icon: string; label: string }[] = [
  { id: 'bar', icon: 'ph-chart-bar-horizontal', label: 'Barras' },
  { id: 'pie', icon: 'ph-chart-pie-slice', label: 'Pizza' },
  { id: 'spline', icon: 'ph-chart-line', label: 'Linha (spline)' },
];

const PALETTE = ['#B26A3C', '#C9A227', '#2E7D5B', '#6B7FE0', '#B83A3A', '#6B6258', '#9B9287', '#8A5CB8', '#3D9B9B', '#D88A4E'];

interface RankingChartProps {
  items: RankingItem[];
  medals?: boolean;
  emptyMessage?: string;
  /** Máximo de fatias/pontos nas views de pizza e linha — o resto some em "Outros" (pizza) ou é truncado (linha). */
  maxSlices?: number;
}

function truncateLabel(s: string, max = 16): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const RankingChart: React.FC<RankingChartProps> = ({ items, medals = true, emptyMessage = 'Sem dados', maxSlices = 8 }) => {
  const [view, setView] = useState<ChartView>('bar');

  const toggle = (
    <div style={{ display: 'flex', gap: 2, background: '#F2EEE2', borderRadius: 8, padding: 3, flexShrink: 0 }}>
      {VIEW_OPTIONS.map(opt => (
        <button
          key={opt.id}
          onClick={() => setView(opt.id)}
          title={opt.label}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: view === opt.id ? '#1C1814' : 'transparent',
            color: view === opt.id ? 'white' : '#6B6258',
            transition: 'background 150ms, color 150ms',
          }}
        >
          <i className={`ph ${opt.icon}`} style={{ fontSize: 13 }} />
        </button>
      ))}
    </div>
  );

  if (items.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{toggle}</div>
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#9B9287', fontSize: 13 }}>{emptyMessage}</div>
      </div>
    );
  }

  // Pizza e linha ficam ilegíveis com dezenas de fatias/pontos — mostra as N maiores e agrupa o resto.
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restTotal = rest.reduce((s, i) => s + i.value, 0);
  const pieData = restTotal > 0 ? [...top, { label: `Outros (${rest.length})`, value: restTotal, valueLabel: '', meta: '' }] : top;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{toggle}</div>

      {view === 'bar' && <RankingList items={items} medals={medals} emptyMessage={emptyMessage} />}

      {view === 'pie' && (
        <ResponsiveContainer width="100%" height={Math.max(220, pieData.length * 26)}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius="78%"
              labelLine={false}
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), name]}
              contentStyle={{ background: '#1C1814', border: 'none', borderRadius: 8, color: '#FAF7F2', fontSize: 12 }}
              itemStyle={{ color: '#FAF7F2' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {view === 'spline' && (
        <ResponsiveContainer width="100%" height={Math.max(220, 40)}>
          <LineChart data={top.map(i => ({ ...i, label: truncateLabel(i.label) }))} margin={{ top: 10, right: 12, left: -20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2EEE2" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B6258' }} interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: '#6B6258' }} />
            <Tooltip
              formatter={(value: number) => value.toLocaleString('pt-BR')}
              contentStyle={{ background: '#1C1814', border: 'none', borderRadius: 8, color: '#FAF7F2', fontSize: 12 }}
              itemStyle={{ color: '#FAF7F2' }}
              labelStyle={{ color: '#FAF7F2' }}
            />
            <Line type="monotone" dataKey="value" stroke="#B26A3C" strokeWidth={2.5} dot={{ r: 3, fill: '#B26A3C' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default RankingChart;
