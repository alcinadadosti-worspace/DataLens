import React, { useState } from 'react';
import FloatingTooltip from './FloatingTooltip';

interface InfoHintProps {
  text: string;
  size?: number;
  /** Lado preferido do balão — 'up' (padrão) sobe a partir do ícone; 'down' desce. Se não couber
   * na tela do lado pedido, o balão abre do outro lado sozinho. */
  direction?: 'up' | 'down';
}

/** Ícone "i" com tooltip escuro ao passar o mouse — usado para explicar títulos e siglas. O balão é
 * renderizado por FloatingTooltip, acima do cabeçalho fixo e fora de contêineres com overflow. */
const InfoHint: React.FC<InfoHintProps> = ({ text, size = 14, direction = 'up' }) => {
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);

  return (
    <span
      ref={setAnchor}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6, cursor: 'help' }}
    >
      <i className="ph ph-info" style={{ fontSize: size, color: 'var(--loja-text-muted, #9B9287)' }} />
      <FloatingTooltip
        anchor={anchor}
        open={hovered}
        placement={direction}
        style={{
          background: 'var(--loja-ink, #1C1814)',
          color: 'var(--loja-bg, #FAF7F2)',
          borderRadius: 11,
          padding: '11px 14px',
          fontSize: 13,
          lineHeight: 1.65,
          fontWeight: 400,
          fontStyle: 'normal',
          textTransform: 'none',
          letterSpacing: 'normal',
          fontFamily: 'Inter Tight, sans-serif',
          boxShadow: '0 4px 20px rgba(28,24,20,0.3)',
          whiteSpace: 'normal',
          width: 280,
        }}
      >
        {text}
      </FloatingTooltip>
    </span>
  );
};

export default InfoHint;
