
import React, { useState } from 'react';
import { COLORS } from '../constants';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  loading = false,
  icon,
  size = 'md',
  disabled,
  onClick,
  ...props 
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const sizeClasses = {
    sm: 'py-2 px-4 text-sm',
    md: 'py-4 px-6 text-base',
    lg: 'py-5 px-8 text-lg'
  };

  const baseClasses = `
    relative overflow-hidden w-full text-center font-bold uppercase tracking-wider 
    rounded-2xl border-b-4 transition-all duration-200 transform 
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    ${sizeClasses[size]}
  `;
  
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white border-[#3a75b8] 
      hover:from-[#4382ce] hover:to-[#2E6BA8] hover:shadow-lg hover:-translate-y-0.5
      focus:ring-[#4A90E2] active:translate-y-0
    `,
    secondary: `
      bg-gradient-to-r from-[#F5A623] to-[#E09820] text-white border-[#c4851c] 
      hover:from-[#e09820] hover:to-[#CC8A1C] hover:shadow-lg hover:-translate-y-0.5
      focus:ring-[#F5A623] active:translate-y-0
    `,
    danger: `
      bg-gradient-to-r from-[#D0021B] to-[#B80218] text-white border-[#a60216] 
      hover:from-[#b80218] hover:to-[#A00115] hover:shadow-lg hover:-translate-y-0.5
      focus:ring-[#D0021B] active:translate-y-0
    `,
    ghost: `
      bg-gradient-to-r from-gray-200 to-gray-300 text-[#777777] border-gray-400 
      hover:from-gray-300 hover:to-gray-400 hover:shadow-md hover:-translate-y-0.5
      focus:ring-gray-400 active:translate-y-0
    `,
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Create ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    
    setRipples(prev => [...prev, newRipple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);

    if (onClick) {
      onClick(e);
    }
  };

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  return (
    <button 
      className={`
        ${baseClasses} ${variantClasses[variant]} ${className}
        ${isPressed ? 'scale-95' : ''}
        ${loading ? 'cursor-wait' : ''}
      `}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Ripple Effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white bg-opacity-30 rounded-full animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}

      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transition-opacity duration-500 transform -skew-x-12 -translate-x-full hover:translate-x-full"></div>

      {/* Content */}
      <div className="relative flex items-center justify-center space-x-2">
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </div>
    </button>
  );
};

export default Button;
