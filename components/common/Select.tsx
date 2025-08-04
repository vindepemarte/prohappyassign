
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
  containerClassName?: string;
  label?: string;
}

const Select: React.FC<SelectProps> = ({ children, containerClassName = '', label, id, ...props }) => {
  return (
    <div className={`relative w-full ${containerClassName}`}>
      {label && <label htmlFor={id} className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>}
      <select
        id={id}
        className="w-full appearance-none bg-white border-2 border-gray-200 rounded-xl py-2 px-4 pr-8 text-base text-gray-800 focus:outline-none focus:border-[#4A90E2] transition-colors"
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
};

export default Select;
