import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  onClick,
  type = 'button',
  disabled,
}) => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    borderRadius: size === 'lg' ? 12 : size === 'sm' ? 8 : 10,
    padding: size === 'lg' ? '14px 24px' : size === 'sm' ? '6px 12px' : '10px 18px',
    fontSize: size === 'lg' ? 16 : size === 'sm' ? 13 : 14,
    transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
    opacity: disabled ? 0.5 : 1,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#1C1814', color: '#FAF7F2', boxShadow: '0 2px 6px rgba(28,24,20,0.15)' },
    secondary: { background: '#FFFFFF', color: '#1C1814', border: '1px solid #E8E2D6' },
    ghost: { background: 'transparent', color: '#1C1814' },
    danger: { background: '#FBE8E8', color: '#B83A3A' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant] }}
      onMouseDown={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)')}
      onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = '')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = '')}
    >
      {icon}{children}
    </button>
  );
};

export default Button;
