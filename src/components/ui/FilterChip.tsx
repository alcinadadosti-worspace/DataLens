import React from 'react';
import GlossyContent from './GlossyContent';

interface FilterChipProps {
  column: string;
  op?: string;
  value: string;
  onRemove: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ column, op, value, onRemove }) => {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px 6px 12px',
      borderRadius: 999,
      background: 'white',
      border: '1px solid #E8E2D6',
      fontSize: 13,
    }}>
      <span style={{ color: '#6B6258', fontWeight: 500 }}>{column}</span>
      {op && <span style={{ color: '#9B9287', fontSize: 11 }}>{op}</span>}
      <span style={{ fontWeight: 600 }}>{value}</span>
      <span
        className="glossy-btn"
        onClick={onRemove}
        style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 11 }}
      >
        <GlossyContent compact icon={<span style={{ lineHeight: 1, color: 'rgba(45,45,45,0.85)' }}>×</span>} />
      </span>
    </span>
  );
};

export default FilterChip;
