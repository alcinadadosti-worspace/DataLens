import React, { useState } from 'react';

interface InfoHintProps {
  text: string;
  size?: number;
}

/** Ícone "i" com tooltip escuro ao passar o mouse — usado para explicar títulos e siglas. */
const InfoHint: React.FC<InfoHintProps> = ({ text, size = 14 }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6, cursor: 'help' }}
    >
      <i className="ph ph-info" style={{ fontSize: size, color: '#9B9287' }} />
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1C1814',
            color: '#FAF7F2',
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
            pointerEvents: 'none',
            zIndex: 200,
          }}
        >
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1C1814',
          }} />
        </div>
      )}
    </span>
  );
};

export default InfoHint;
