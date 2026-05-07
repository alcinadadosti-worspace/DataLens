import React from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, action }) => {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E8E2D6',
      borderRadius: 14,
      padding: 20,
      boxShadow: '0 2px 6px rgba(28,24,20,0.05)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6B6258',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 13, color: '#3D362E', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

export default ChartCard;
