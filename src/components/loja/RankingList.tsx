import React from 'react';
import { TIER_STYLES } from '../../design-system/tierStyles';

export interface RankingItem {
  label: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
  meta?: string;
}

interface RankingListProps {
  items: RankingItem[];
  medals?: boolean;
  emptyMessage?: string;
}

const MEDAL_COLORS = [TIER_STYLES.ouro.accent, TIER_STYLES.prata.accent, TIER_STYLES.bronze.accent];
const MEDAL_BG = [TIER_STYLES.ouro.bg, TIER_STYLES.prata.bg, TIER_STYLES.bronze.bg];

const RankingList: React.FC<RankingListProps> = ({ items, medals = true, emptyMessage = 'Sem dados' }) => {
  if (items.length === 0) {
    return <div style={{ padding: '24px 0', textAlign: 'center', color: '#9B9287', fontSize: 13 }}>{emptyMessage}</div>;
  }

  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => {
        const isMedal = medals && i < 3;
        const badgeColor = isMedal ? MEDAL_COLORS[i] : '#6B6258';
        const badgeBg = isMedal ? MEDAL_BG[i] : '#F2EEE2';
        const pct = Math.max((item.value / max) * 100, 1.5);

        return (
          <div key={item.label + i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: badgeBg, color: badgeColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              border: isMedal ? `1px solid ${badgeColor}55` : '1px solid #E8E2D6',
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1814', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                  {item.sublabel && <span style={{ fontWeight: 400, color: '#9B9287', marginLeft: 6, fontSize: 12 }}>{item.sublabel}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                  {item.meta && <span style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>{item.meta}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#1C1814' }}>{item.valueLabel}</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#F2EEE6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 3,
                  background: isMedal ? badgeColor : '#D8D0C0',
                  transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RankingList;
