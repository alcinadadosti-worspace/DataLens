import React, { useState } from 'react';
import InfoHint from '../ui/InfoHint';
import '../../design-system/borderGlow.css';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Texto do hover que explica o que o título quer dizer (e a sigla, se houver uma). */
  hint?: string;
  /** Contorno giratório na borda ao passar o mouse (BorderGlow, Modo Loja only) — default off, não afeta o app original. */
  glow?: boolean;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, action, hint, glow }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={glow ? () => setHovered(true) : undefined}
      onMouseLeave={glow ? () => setHovered(false) : undefined}
      className={glow ? 'loja-glow-card' : undefined}
      style={{
        background: 'var(--loja-surface, #FFFFFF)',
        border: '1px solid var(--loja-border, #E8E2D6)',
        borderRadius: 16,
        padding: 24,
        boxShadow: glow && hovered ? '0 12px 30px rgba(0,0,0,0.14)' : '0 2px 6px rgba(28,24,20,0.05)',
        transition: glow ? 'box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
      }}>
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--loja-text-secondary, #6B6258)',
            display: 'flex',
            alignItems: 'center',
          }}>
            {title}
            {hint && <InfoHint text={hint} size={14} />}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: 'var(--loja-text-strong, #3D362E)', marginTop: 5 }}>{subtitle}</div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

export default ChartCard;
