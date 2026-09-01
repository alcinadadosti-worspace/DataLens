import React from 'react';
import GlossyContent from './GlossyContent';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const SIZE_FONT: Record<string, number> = { sm: 12, md: 14, lg: 16 };
const SIZE_RADIUS: Record<string, number> = { sm: 8, md: 10, lg: 12 };

const Button: React.FC<ButtonProps> = ({
  size = 'md',
  icon,
  children,
  onClick,
  type = 'button',
  disabled,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="glossy-btn"
      style={{ fontSize: SIZE_FONT[size], borderRadius: SIZE_RADIUS[size] }}
    >
      <GlossyContent icon={icon}>{children}</GlossyContent>
    </button>
  );
};

export default Button;
