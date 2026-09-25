import React from 'react';

/** Estilo de pill de filtro/tab usado junto com `glossy-btn`+`GlossyContent` — mesmo padrão de ComparacaoSemanalScreen.tsx. */
export function pillBtn(active: boolean, color = 'var(--vd-ink, #1C1814)'): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? color : 'var(--vd-border, #E8E2D6)'}`,
    cursor: 'pointer', transition: 'all 150ms',
  };
}
