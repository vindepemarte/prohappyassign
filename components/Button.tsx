
import React from 'react';
import { COLORS } from '../constants';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'w-full text-center font-bold uppercase tracking-wider py-4 px-6 rounded-2xl border-b-4 transition-transform transform active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: `bg-[#4A90E2] text-white border-[#3a75b8] hover:bg-[#4382ce] focus:ring-[#4A90E2]`,
    secondary: `bg-[#F5A623] text-white border-[#c4851c] hover:bg-[#e09820] focus:ring-[#F5A623]`,
    danger: `bg-[#D0021B] text-white border-[#a60216] hover:bg-[#b80218] focus:ring-[#D0021B]`,
    ghost: `bg-gray-200 text-[#777777] border-gray-300 hover:bg-gray-300 focus:ring-gray-400`,
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
