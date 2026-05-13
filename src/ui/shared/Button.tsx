import type { ReactNode, MouseEventHandler } from 'react';
import './Button.css';

interface Props {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  title?: string;
}

export function Button({
  onClick,
  disabled,
  children,
  variant = 'secondary',
  size = 'md',
  fullWidth,
  title,
}: Props) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size}${fullWidth ? ' btn-block' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
