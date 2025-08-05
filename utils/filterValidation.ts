import { TimeFilter } from '../components/common/FilterBar';

export interface FilterValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

export interface FilterValidationOptions {
  maxRangeDays?: number;
  minDate?: Date;
  maxDate?: Date;
  allowFutureDates?: boolean;
}

/**
 * Validates a time filter and returns validation result with error messages
 */
export function validateTimeFilter(
  filter: TimeFilter,
  options: FilterValidationOptions = {}
): FilterValidationResult {
  const {
    maxRangeDays = 365,
    minDate = new Date('2020-01-01'),
    maxDate = new Date(),
    allowFutureDates = false
  } = options;

  // Check if filter type is valid
  if (!filter.type || !['week', 'month', 'custom'].includes(filter.type)) {
    return {
      isValid: false,
      error: 'Invalid filter type. Must be "week", "month", or "custom".'
    };
  }

  // For week and month filters, dates should be automatically calculated
  if (filter.type === 'week' || filter.type === 'month') {
    if (!filter.startDate || !filter.endDate) {
      return {
        isValid: false,
        error: `${filter.type} filter must have start and end dates calculated.`
      };
    }
  }

  // For custom filters, both dates are required
  if (filter.type === 'custom') {
    if (!filter.startDate || !filter.endDate) {
      return {
        isValid: false,
        error: 'Custom filter requires both start and end dates.'
      };
    }
  }

  // If we have dates, validate them
  if (filter.startDate && filter.endDate) {
    // Check if start date is before end date
    if (filter.startDate > filter.endDate) {
      return {
        isValid: false,
        error: 'Start date must be before end date.'
      };
    }

    // Check if dates are within allowed range
    if (filter.startDate < minDate) {
      return {
        isValid: false,
        error: `Start date cannot be before ${minDate.toLocaleDateString()}.`
      };
    }

    if (!allowFutureDates && filter.endDate > maxDate) {
      return {
        isValid: false,
        error: `End date cannot be after ${maxDate.toLocaleDateString()}.`
      };
    }

    // Check if date range is not too large
    const daysDifference = Math.ceil(
      (filter.endDate.getTime() - filter.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference > maxRangeDays) {
      return {
        isValid: false,
        error: `Date range cannot exceed ${maxRangeDays} days.`
      };
    }

    // Add warnings for potentially problematic ranges
    let warning: string | undefined;
    
    if (daysDifference > 180) {
      warning = 'Large date ranges may affect performance.';
    } else if (daysDifference < 1) {
      warning = 'Date range is less than 1 day.';
    }

    return {
      isValid: true,
      warning
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes a time filter by correcting common issues
 */
export function sanitizeTimeFilter(filter: TimeFilter): TimeFilter {
  const sanitized = { ...filter };

  // Ensure dates are Date objects if they exist
  if (sanitized.startDate && typeof sanitized.startDate === 'string') {
    sanitized.startDate = new Date(sanitized.startDate);
  }
  
  if (sanitized.endDate && typeof sanitized.endDate === 'string') {
    sanitized.endDate = new Date(sanitized.endDate);
  }

  // Fix invalid dates
  if (sanitized.startDate && isNaN(sanitized.startDate.getTime())) {
    delete sanitized.startDate;
  }
  
  if (sanitized.endDate && isNaN(sanitized.endDate.getTime())) {
    delete sanitized.endDate;
  }

  // Swap dates if they're in wrong order
  if (sanitized.startDate && sanitized.endDate && sanitized.startDate > sanitized.endDate) {
    const temp = sanitized.startDate;
    sanitized.startDate = sanitized.endDate;
    sanitized.endDate = temp;
  }

  // Set proper time boundaries
  if (sanitized.startDate) {
    sanitized.startDate.setHours(0, 0, 0, 0);
  }
  
  if (sanitized.endDate) {
    sanitized.endDate.setHours(23, 59, 59, 999);
  }

  return sanitized;
}

/**
 * Creates a safe filter with fallback to default values
 */
export function createSafeTimeFilter(
  filter: Partial<TimeFilter>,
  fallbackType: 'week' | 'month' = 'month'
): TimeFilter {
  try {
    const sanitized = sanitizeTimeFilter(filter as TimeFilter);
    const validation = validateTimeFilter(sanitized);
    
    if (validation.isValid) {
      return sanitized;
    }
  } catch (error) {
    console.warn('Error creating safe time filter:', error);
  }

  // Return fallback filter
  return createDefaultFilter(fallbackType);
}

/**
 * Creates a default filter with calculated dates
 */
export function createDefaultFilter(type: 'week' | 'month' = 'month'): TimeFilter {
  const now = new Date();
  
  if (type === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
      type: 'week',
      startDate: startOfWeek,
      endDate: endOfWeek
    };
  } else {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return {
      type: 'month',
      startDate: startOfMonth,
      endDate: endOfMonth
    };
  }
}

/**
 * Formats a time filter for display
 */
export function formatFilterForDisplay(filter: TimeFilter): string {
  if (!filter.startDate || !filter.endDate) {
    return filter.type.charAt(0).toUpperCase() + filter.type.slice(1);
  }

  const start = filter.startDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short'
  });
  
  const end = filter.endDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return `${start} - ${end}`;
}

/**
 * Checks if two filters are equivalent
 */
export function areFiltersEqual(filter1: TimeFilter, filter2: TimeFilter): boolean {
  if (filter1.type !== filter2.type) {
    return false;
  }

  const start1 = filter1.startDate?.getTime();
  const end1 = filter1.endDate?.getTime();
  const start2 = filter2.startDate?.getTime();
  const end2 = filter2.endDate?.getTime();

  return start1 === start2 && end1 === end2;
}