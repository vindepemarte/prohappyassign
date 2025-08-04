import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

const Input: React.FC<InputProps> = ({ label, id, icon, containerClassName = '', ...props }) => (
  <div className={`w-full ${containerClassName}`}>
    {label && <label htmlFor={id} className="text-sm font-bold text-gray-600 mb-2 block">{label}</label>}
    <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">{icon}</div>}
        <input
          id={id}
          className={`w-full bg-gray-50 border-2 border-gray-200 rounded-xl py-3 text-base text-gray-800 focus:outline-none focus:border-[#4A90E2] transition-colors ${icon ? 'pl-10 pr-4' : 'px-4'}`}
          {...props}
        />
    </div>
  </div>
);

export default Input;
