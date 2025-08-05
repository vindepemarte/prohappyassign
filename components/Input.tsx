import React, { useState, useEffect } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
  error?: string;
  success?: boolean;
  helperText?: string;
  validationRules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: string) => string | null;
  };
  onValidation?: (isValid: boolean, error?: string) => void;
}

const Input: React.FC<InputProps> = ({ 
  label, 
  id, 
  icon, 
  containerClassName = '', 
  error,
  success,
  helperText,
  validationRules,
  onValidation,
  onChange,
  onBlur,
  value,
  ...props 
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    setHasValue(!!value);
  }, [value]);

  const validateInput = (inputValue: string): string | null => {
    if (!validationRules) return null;

    if (validationRules.required && !inputValue.trim()) {
      return 'This field is required';
    }

    if (validationRules.minLength && inputValue.length < validationRules.minLength) {
      return `Minimum ${validationRules.minLength} characters required`;
    }

    if (validationRules.maxLength && inputValue.length > validationRules.maxLength) {
      return `Maximum ${validationRules.maxLength} characters allowed`;
    }

    if (validationRules.pattern && !validationRules.pattern.test(inputValue)) {
      return 'Invalid format';
    }

    if (validationRules.custom) {
      return validationRules.custom(inputValue);
    }

    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHasValue(!!newValue);
    
    // Clear error on change
    if (internalError) {
      setInternalError('');
    }

    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    if (validationRules) {
      const validationError = validateInput(e.target.value);
      setInternalError(validationError || '');
      
      if (onValidation) {
        onValidation(!validationError, validationError || undefined);
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const displayError = error || internalError;
  const isError = !!displayError;
  const isSuccess = success && !isError;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label 
          htmlFor={id} 
          className={`
            text-sm font-semibold mb-3 block transition-colors duration-200
            ${isError ? 'text-red-600' : isSuccess ? 'text-green-600' : 'text-gray-700'}
          `}
        >
          {label}
          {validationRules?.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className={`
            absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none
            transition-colors duration-200
            ${isError ? 'text-red-500' : isSuccess ? 'text-green-500' : 'text-gray-400'}
          `}>
            {icon}
          </div>
        )}
        
        <input
          id={id}
          className={`
            form-input w-full rounded-xl py-4 text-base transition-all duration-200
            ${icon ? 'pl-12 pr-4' : 'px-4'}
            ${isError 
              ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500' 
              : isSuccess 
                ? 'border-green-300 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500'
                : 'border-gray-200 bg-gray-50 text-gray-800 focus:border-blue-500 focus:ring-blue-500'
            }
            ${isFocused ? 'shadow-lg' : 'shadow-sm'}
          `}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          {...props}
        />

        {/* Success/Error Icons */}
        {(isError || isSuccess) && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {isError ? (
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}

        {/* Floating Label Animation */}
        {label && (isFocused || hasValue) && (
          <div className={`
            absolute -top-2 left-3 px-2 text-xs font-medium transition-all duration-200
            ${isError ? 'text-red-600 bg-red-50' : isSuccess ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-white'}
            rounded-md
          `}>
            {label}
          </div>
        )}
      </div>

      {/* Helper Text and Error Messages */}
      {(displayError || helperText) && (
        <div className="mt-2 min-h-[1.25rem]">
          {displayError ? (
            <p className="text-sm text-red-600 flex items-center animate-slideInFromTop">
              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {displayError}
            </p>
          ) : helperText ? (
            <p className="text-sm text-gray-500">{helperText}</p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Input;
