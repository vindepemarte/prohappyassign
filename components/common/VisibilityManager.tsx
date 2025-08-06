import { useEffect, useRef } from 'react';

interface VisibilityManagerProps {
  onVisibilityChange?: (isVisible: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  preventReloadOnTabSwitch?: boolean;
}

/**
 * Component to handle tab switching and visibility changes gracefully
 * Prevents unnecessary loading states when user switches tabs
 */
export const useVisibilityManager = ({
  onVisibilityChange,
  onFocus,
  onBlur,
  preventReloadOnTabSwitch = true
}: VisibilityManagerProps = {}) => {
  const wasVisibleRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      if (preventReloadOnTabSwitch) {
        // Clear any pending reload timeouts
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Don't trigger loading states for quick tab switches
        if (!isVisible) {
          wasVisibleRef.current = false;
        } else if (!wasVisibleRef.current) {
          // Only trigger reload if tab was hidden for more than 5 minutes
          const hiddenTime = Date.now() - (document.lastVisibilityChange || 0);
          if (hiddenTime > 5 * 60 * 1000) { // 5 minutes
            onVisibilityChange?.(isVisible);
          }
          wasVisibleRef.current = true;
        }
      } else {
        onVisibilityChange?.(isVisible);
      }
    };

    const handleFocus = () => {
      if (preventReloadOnTabSwitch) {
        // Small delay to prevent unnecessary reloads
        timeoutRef.current = setTimeout(() => {
          onFocus?.();
        }, 1000);
      } else {
        onFocus?.();
      }
    };

    const handleBlur = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      onBlur?.();
    };

    // Track visibility change time
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
      if (type === 'visibilitychange') {
        const wrappedListener = (e: Event) => {
          (document as any).lastVisibilityChange = Date.now();
          if (typeof listener === 'function') {
            listener(e);
          } else if (listener && typeof listener.handleEvent === 'function') {
            listener.handleEvent(e);
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onVisibilityChange, onFocus, onBlur, preventReloadOnTabSwitch]);

  return {
    isVisible: !document.hidden,
    wasVisible: wasVisibleRef.current
  };
};

export default useVisibilityManager;