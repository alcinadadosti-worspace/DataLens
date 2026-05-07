import React from 'react';

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
        onClick={onRemove}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#F2EEE6',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#6B6258',
          fontSize: 12,
          lineHeight: '1',
        }}
      >
        ×
      </span>
    </span>
  );
};

export default FilterChip;
