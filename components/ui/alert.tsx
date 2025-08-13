import React from 'react';

interface AlertProps {
  variant?: 'default' | 'destructive';
  className?: string;
  children: React.ReactNode;
}

interface AlertDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'default', className = '', children }) => {
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800'
  };
  
  return (
    <div className={`relative w-full rounded-lg border p-4 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ className = '', children }) => {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
};