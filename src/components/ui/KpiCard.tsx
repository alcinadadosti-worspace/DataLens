import React, { useState } from 'react';
import InfoHint from './InfoHint';
import { useBorderGlowHandler } from './useBorderGlow';
import '../../design-system/borderGlow.css';

interface KpiCardProps {
  eyebrow: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  meta?: string;
  tooltip?: React.ReactNode;
  /** Texto do hover que explica o que o indicador quer dizer (e a sigla, se houver uma). */
  hint?: string;
  /** Contorno que acompanha o cursor perto da borda (BorderGlow, Modo Loja only) — default off, não afeta o app original. */
  glow?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ eyebrow, value, delta, deltaDirection, meta, tooltip, hint, glow }) => {
  const [hovered, setHovered] = useState(false);
  const onPointerMove = useBorderGlowHandler();
  const deltaColor = deltaDirection === 'down' ? 'var(--loja-danger, #B83A3A)' : 'var(--loja-success, #2E7D5B)';
  const arrow = deltaDirection === 'down' ? '↓' : '↑';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerMove={glow ? onPointerMove : undefined}
      className={glow ? 'loja-glow-card' : undefined}
      style={{
        background: 'var(--loja-surface, #FFFFFF)',
        border: '1px solid var(--loja-border, #E8E2D6)',
        borderRadius: 16,
        padding: 22,
        boxShadow: hovered && (tooltip || glow) ? '0 10px 26px rgba(0,0,0,0.13)' : '0 2px 6px rgba(28,24,20,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        position: 'relative',
        transition: 'box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: glow && hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {glow && <span className="loja-glow-edge" />}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--loja-text-secondary, #6B6258)',
        display: 'flex',
        alignItems: 'center',
      }}>
        {eyebrow}
        {hint && <InfoHint text={hint} size={14} />}
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {delta && (
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: deltaColor,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          {arrow} {delta}
          {meta && <span style={{ color: 'var(--loja-text-secondary, #6B6258)', fontWeight: 400 }}>{meta}</span>}
        </div>
      )}
      {tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: 0,
          background: 'var(--loja-ink, #1C1814)',
          color: 'var(--loja-bg, #FAF7F2)',
          borderRadius: 10,
          padding: '11px 15px',
          fontSize: 13,
          lineHeight: 1.75,
          boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 180ms, transform 180ms',
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid var(--loja-ink, #1C1814)',
          }} />
        </div>
      )}
    </div>
  );
};

export default KpiCard;
