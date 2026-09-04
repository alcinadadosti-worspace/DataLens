import React from 'react';
import InfoHint from './InfoHint';

interface PageTitleProps {
  eyebrow: string;
  title: string;
  hint?: string;
}

/** Cabeçalho padrão das telas do Modo Loja: eyebrow + h1, com hover explicando o título. */
const PageTitle: React.FC<PageTitleProps> = ({ eyebrow, title, hint }) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
      {eyebrow}
    </div>
    <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', margin: '7px 0 0', display: 'flex', alignItems: 'center' }}>
      {title}
      {hint && <InfoHint text={hint} size={18} />}
    </h1>
  </div>
);

export default PageTitle;
