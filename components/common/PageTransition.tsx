import React, { useEffect, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  animationType?: 'fade' | 'slide' | 'scale' | 'blur';
  duration?: number;
}

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  isLoading = false,
  className = '',
  animationType = 'fade',
  duration = 300
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isLoading, duration]);

  const getAnimationClasses = () => {
    const baseClasses = `transition-all duration-${duration} ease-out`;
    
    switch (animationType) {
      case 'fade':
        return `${baseClasses} ${isVisible ? 'opacity-100' : 'opacity-0'}`;
      case 'slide':
        return `${baseClasses} transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`;
      case 'scale':
        return `${baseClasses} transform ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`;
      case 'blur':
        return `${baseClasses} ${isVisible ? 'blur-0 opacity-100' : 'blur-sm opacity-0'}`;
      default:
        return baseClasses;
    }
  };

  if (!shouldRender && isLoading) {
    return null;
  }

  return (
    <div className={`${getAnimationClasses()} ${className}`}>
      {children}
    </div>
  );
};

export default PageTransition;