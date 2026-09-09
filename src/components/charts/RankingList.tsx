import React from 'react';
import { motion } from 'framer-motion';
import { TIER_STYLES } from '../../design-system/tierStyles';

export interface RankingItem {
  label: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
  meta?: string;
  /** Meta PEF (ou outro alvo) associada a esse item, quando existir — habilita a view de colunas empilhadas com fundo de meta no RankingChart. */
  metaTarget?: number;
  /** Código de loja, quando esse item representa uma unidade — habilita a quebra por colaborador no painel de detalhe em tela cheia. */
  lojaCodigo?: string;
}

/** Uma linha da quebra por colaborador mostrada no painel de detalhe (tela cheia) de um item que representa uma loja. */
export interface BreakdownRow {
  label: string;
  value: number;
  valueLabel: string;
  pct: number;
  /** Texto extra opcional exibido junto do valor (ex. "31/75 boletos fidelizados"). */
  meta?: string;
}

interface RankingListProps {
  items: RankingItem[];
  medals?: boolean;
  emptyMessage?: string;
  onItemClick?: (item: RankingItem, index: number) => void;
}

const MEDAL_COLORS = [TIER_STYLES.ouro.accent, TIER_STYLES.prata.accent, TIER_STYLES.bronze.accent];
const MEDAL_BG = [TIER_STYLES.ouro.bg, TIER_STYLES.prata.bg, TIER_STYLES.bronze.bg];

const RankingList: React.FC<RankingListProps> = ({ items, medals = true, emptyMessage = 'Sem dados', onItemClick }) => {
  if (items.length === 0) {
    return <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--chart-text-muted, #9B9287)', fontSize: 14 }}>{emptyMessage}</div>;
  }

  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((item, i) => {
        const isMedal = medals && i < 3;
        const badgeColor = isMedal ? MEDAL_COLORS[i] : 'var(--chart-text-secondary, #6B6258)';
        const badgeBg = isMedal ? MEDAL_BG[i] : 'var(--chart-bg-subtle, #F2EEE2)';
        const pct = Math.max((item.value / max) * 100, 1.5);

        return (
          <motion.div
            key={item.label + i}
            onClick={onItemClick ? () => onItemClick(item, i) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, cursor: onItemClick ? 'pointer' : 'default',
              borderRadius: 10, padding: '4px 6px', margin: '-4px -6px',
            }}
            whileHover={onItemClick ? { backgroundColor: 'var(--chart-bg-subtle, #F2EEE2)', x: 2 } : { x: 2 }}
            whileTap={onItemClick ? { scale: 0.985 } : undefined}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: badgeBg, color: badgeColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              border: isMedal ? `1px solid ${badgeColor}55` : '1px solid var(--chart-border, #E8E2D6)',
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--chart-ink, #1C1814)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                  {item.sublabel && <span style={{ fontWeight: 400, color: 'var(--chart-text-muted, #9B9287)', marginLeft: 6, fontSize: 13 }}>{item.sublabel}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                  {item.meta && <span style={{ fontSize: 12, color: 'var(--chart-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace' }}>{item.meta}</span>}
                  <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--chart-ink, #1C1814)' }}>{item.valueLabel}</span>
                </div>
              </div>
              <div style={{ height: 9, borderRadius: 4, background: 'var(--chart-bg-track, #F2EEE6)', overflow: 'hidden' }}>
                {/* scaleX (transform) em vez de animar "width" — width força reflow a cada frame,
                    o que pesa muito quando várias linhas animam ao mesmo tempo (ex. "Mostrar todas"). */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    height: '100%', width: '100%', borderRadius: 4, transformOrigin: 'left',
                    background: isMedal ? badgeColor : 'var(--chart-border-strong, #D8D0C0)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RankingList;
