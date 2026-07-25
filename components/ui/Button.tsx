import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  style,
  ...props 
}) => {
  const baseStyle = "rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg, #4A2D7A, #7B55A8)', color: 'white' },
    secondary: { background: 'white', color: '#4A2D7A', border: '1.5px solid #E0D0F5' },
    danger: { background: '#ef4444', color: 'white' },
    ghost: { background: 'transparent', color: '#7B55A8' },
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button 
      className={`${baseStyle} ${sizes[size]} ${className}`}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;