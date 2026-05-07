import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ icon, ...props }) => {
  if (icon) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 40,
        padding: '0 14px',
        borderRadius: 10,
        background: 'white',
        border: '1px solid #D8D0C0',
      }}>
        <span style={{ color: '#6B6258', display: 'flex' }}>{icon}</span>
        <input
          {...props}
          style={{
            border: 'none',
            outline: 'none',
            flex: 1,
            fontSize: 14,
            fontFamily: 'inherit',
            background: 'transparent',
            color: '#1C1814',
          }}
        />
      </div>
    );
  }

  return (
    <input
      {...props}
      style={{
        height: 40,
        padding: '0 14px',
        borderRadius: 10,
        background: 'white',
        border: '1px solid #D8D0C0',
        fontFamily: 'inherit',
        fontSize: 14,
        color: '#1C1814',
        outline: 'none',
        ...props.style,
      }}
    />
  );
};

export default Input;
