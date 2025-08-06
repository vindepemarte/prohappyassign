/**
 * UI Consistency Checker and Fixer
 * Ensures all UI components follow the design system
 */

export interface UIConsistencyReport {
  inconsistencies: UIInconsistency[];
  suggestions: UISuggestion[];
  score: number; // 0-100
}

export interface UIInconsistency {
  type: 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow' | 'z-index' | 'animation';
  element: string;
  current: string;
  expected: string;
  severity: 'low' | 'medium' | 'high';
  location: string;
}

export interface UISuggestion {
  type: 'improvement' | 'accessibility' | 'performance';
  description: string;
  element: string;
  location: string;
}

export class UIConsistencyChecker {
  private static readonly DESIGN_TOKENS = {
    colors: {
      primary: '#4A90E2',
      primaryDark: '#357ABD',
      secondary: '#F5A623',
      secondaryDark: '#E09820',
      danger: '#D0021B',
      dangerDark: '#B80218',
      success: '#7ED321',
      warning: '#F5A623',
      gray: {
        50: '#F9FAFB',
        100: '#F3F4F6',
        200: '#E5E7EB',
        300: '#D1D5DB',
        400: '#9CA3AF',
        500: '#6B7280',
        600: '#4B5563',
        700: '#374151',
        800: '#1F2937',
        900: '#111827'
      }
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem'
    },
    borderRadius: {
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.5rem'
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)'
    },
    zIndex: {
      dropdown: 1000,
      sticky: 1020,
      fixed: 1030,
      modalBackdrop: 1040,
      modal: 1050,
      popover: 1060,
      tooltip: 1070,
      toast: 1080
    }
  };

  private static readonly CONSISTENT_CLASSES = {
    buttons: {
      base: 'btn',
      variants: ['btn--primary', 'btn--secondary', 'btn--danger', 'btn--ghost'],
      sizes: ['btn--small', 'btn--large']
    },
    inputs: {
      base: 'form-input',
      states: ['form-input--error', 'form-input--success'],
      sizes: ['form-input--small', 'form-input--large']
    },
    cards: {
      base: 'card',
      variants: ['card--hover', 'card--interactive', 'card--error', 'card--success', 'card--warning']
    },
    modals: {
      overlay: 'modal-overlay',
      content: 'modal-content',
      header: 'modal-header',
      body: 'modal-body',
      footer: 'modal-footer'
    },
    dropdowns: {
      base: 'dropdown',
      item: 'dropdown-item',
      states: ['dropdown-item--selected', 'dropdown-item--disabled']
    },
    loading: {
      spinner: 'loading-spinner',
      sizes: ['loading-spinner--small', 'loading-spinner--medium', 'loading-spinner--large'],
      skeleton: 'loading-skeleton'
    },
    badges: {
      base: 'status-badge',
      variants: ['status-badge--pending', 'status-badge--success', 'status-badge--error', 'status-badge--warning', 'status-badge--info', 'status-badge--neutral']
    }
  };

  static checkConsistency(htmlContent: string): UIConsistencyReport {
    const inconsistencies: UIInconsistency[] = [];
    const suggestions: UISuggestion[] = [];

    // Check for inconsistent button styling
    this.checkButtonConsistency(htmlContent, inconsistencies);
    
    // Check for inconsistent input styling
    this.checkInputConsistency(htmlContent, inconsistencies);
    
    // Check for inconsistent z-index usage
    this.checkZIndexConsistency(htmlContent, inconsistencies);
    
    // Check for inconsistent loading states
    this.checkLoadingStateConsistency(htmlContent, inconsistencies);
    
    // Check for accessibility issues
    this.checkAccessibility(htmlContent, suggestions);
    
    // Check for performance issues
    this.checkPerformance(htmlContent, suggestions);

    const score = this.calculateConsistencyScore(inconsistencies);

    return {
      inconsistencies,
      suggestions,
      score
    };
  }

  private static checkButtonConsistency(html: string, inconsistencies: UIInconsistency[]): void {
    // Check for buttons without consistent classes
    const buttonRegex = /<button[^>]*className="([^"]*)"[^>]*>/g;
    let match;

    while ((match = buttonRegex.exec(html)) !== null) {
      const className = match[1];
      const hasBaseClass = className.includes('btn');
      const hasOldStyling = className.includes('bg-gradient-to-r') || className.includes('rounded-2xl');

      if (!hasBaseClass && hasOldStyling) {
        inconsistencies.push({
          type: 'color',
          element: 'button',
          current: className,
          expected: 'btn btn--primary (or appropriate variant)',
          severity: 'medium',
          location: match[0]
        });
      }
    }
  }

  private static checkInputConsistency(html: string, inconsistencies: UIInconsistency[]): void {
    // Check for inputs without consistent classes
    const inputRegex = /<input[^>]*className="([^"]*)"[^>]*>/g;
    let match;

    while ((match = inputRegex.exec(html)) !== null) {
      const className = match[1];
      const hasBaseClass = className.includes('form-input');
      const hasOldStyling = className.includes('px-3 py-2') || className.includes('border-gray-300');

      if (!hasBaseClass && hasOldStyling) {
        inconsistencies.push({
          type: 'spacing',
          element: 'input',
          current: className,
          expected: 'form-input',
          severity: 'medium',
          location: match[0]
        });
      }
    }
  }

  private static checkZIndexConsistency(html: string, inconsistencies: UIInconsistency[]): void {
    // Check for hardcoded z-index values
    const zIndexRegex = /z-\[(\d+)\]/g;
    let match;

    while ((match = zIndexRegex.exec(html)) !== null) {
      const zValue = parseInt(match[1]);
      let expectedClass = '';

      if (zValue >= 1000 && zValue < 1020) expectedClass = 'z-dropdown';
      else if (zValue >= 1040 && zValue < 1050) expectedClass = 'z-modal-backdrop';
      else if (zValue >= 1050 && zValue < 1060) expectedClass = 'z-modal';
      else if (zValue >= 1060 && zValue < 1070) expectedClass = 'z-popover';
      else if (zValue >= 1070 && zValue < 1080) expectedClass = 'z-tooltip';
      else if (zValue >= 1080) expectedClass = 'z-toast';

      if (expectedClass) {
        inconsistencies.push({
          type: 'z-index',
          element: 'element',
          current: match[0],
          expected: expectedClass,
          severity: 'low',
          location: match[0]
        });
      }
    }
  }

  private static checkLoadingStateConsistency(html: string, inconsistencies: UIInconsistency[]): void {
    // Check for inconsistent loading spinners
    const spinnerRegex = /animate-spin[^"]*rounded-full[^"]*border/g;
    let match;

    while ((match = spinnerRegex.exec(html)) !== null) {
      inconsistencies.push({
        type: 'animation',
        element: 'loading-spinner',
        current: match[0],
        expected: 'loading-spinner loading-spinner--medium',
        severity: 'low',
        location: match[0]
      });
    }
  }

  private static checkAccessibility(html: string, suggestions: UISuggestion[]): void {
    // Check for missing ARIA labels
    const buttonRegex = /<button[^>]*>/g;
    let match;

    while ((match = buttonRegex.exec(html)) !== null) {
      const hasAriaLabel = match[0].includes('aria-label') || match[0].includes('aria-labelledby');
      const hasVisibleText = !match[0].includes('sr-only');

      if (!hasAriaLabel && !hasVisibleText) {
        suggestions.push({
          type: 'accessibility',
          description: 'Add aria-label or visible text to button for screen readers',
          element: 'button',
          location: match[0]
        });
      }
    }

    // Check for missing focus states
    const interactiveRegex = /<(button|input|select|textarea|a)[^>]*className="([^"]*)"[^>]*>/g;
    while ((match = interactiveRegex.exec(html)) !== null) {
      const className = match[2];
      const hasFocusClass = className.includes('focus:') || className.includes('focus-ring');

      if (!hasFocusClass) {
        suggestions.push({
          type: 'accessibility',
          description: 'Add focus states for keyboard navigation',
          element: match[1],
          location: match[0]
        });
      }
    }
  }

  private static checkPerformance(html: string, suggestions: UISuggestion[]): void {
    // Check for missing will-change or transform optimizations
    const animatedRegex = /animate-\w+|transition-|transform/g;
    let match;

    while ((match = animatedRegex.exec(html)) !== null) {
      suggestions.push({
        type: 'performance',
        description: 'Consider adding gpu-accelerated class for better animation performance',
        element: 'animated-element',
        location: match[0]
      });
    }
  }

  private static calculateConsistencyScore(inconsistencies: UIInconsistency[]): number {
    if (inconsistencies.length === 0) return 100;

    const severityWeights = { low: 1, medium: 3, high: 5 };
    const totalWeight = inconsistencies.reduce((sum, inc) => sum + severityWeights[inc.severity], 0);
    
    // Score decreases based on weighted inconsistencies
    const maxPossibleWeight = inconsistencies.length * 5; // Assuming all high severity
    const score = Math.max(0, 100 - (totalWeight / maxPossibleWeight) * 100);
    
    return Math.round(score);
  }

  static generateFixSuggestions(inconsistencies: UIInconsistency[]): string[] {
    return inconsistencies.map(inc => {
      switch (inc.type) {
        case 'color':
          return `Replace "${inc.current}" with "${inc.expected}" for consistent color scheme`;
        case 'spacing':
          return `Use "${inc.expected}" instead of "${inc.current}" for consistent spacing`;
        case 'z-index':
          return `Replace "${inc.current}" with "${inc.expected}" for proper layering`;
        case 'animation':
          return `Use "${inc.expected}" for consistent loading animations`;
        default:
          return `Update "${inc.current}" to "${inc.expected}" for better consistency`;
      }
    });
  }

  static autoFix(htmlContent: string): string {
    let fixed = htmlContent;

    // Auto-fix common inconsistencies
    
    // Fix button classes
    fixed = fixed.replace(
      /className="([^"]*bg-gradient-to-r[^"]*rounded-2xl[^"]*)"/g,
      'className="btn btn--primary"'
    );

    // Fix input classes
    fixed = fixed.replace(
      /className="([^"]*px-3 py-2[^"]*border-gray-300[^"]*)"/g,
      'className="form-input"'
    );

    // Fix z-index values
    fixed = fixed.replace(/z-\[9999\]/g, 'z-dropdown');
    fixed = fixed.replace(/z-\[1050\]/g, 'z-modal');
    fixed = fixed.replace(/z-\[1040\]/g, 'z-modal-backdrop');

    // Fix loading spinners
    fixed = fixed.replace(
      /animate-spin rounded-full h-\d+ w-\d+ border-\d+ border-\w+-\d+ border-t-transparent/g,
      'loading-spinner loading-spinner--medium'
    );

    return fixed;
  }
}

export default UIConsistencyChecker;