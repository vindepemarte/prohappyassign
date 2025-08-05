import { useState, useEffect, useCallback } from 'react';
import { TimeFilter, TimeFilterType } from '../components/common/FilterBar';

interface UseFilterStateOptions {
  defaultFilter?: TimeFilter;
  persistToUrl?: boolean;
  urlParamPrefix?: string;
}

interface UseFilterStateReturn {
  currentFilter: TimeFilter;
  setFilter: (filter: TimeFilter) => void;
  resetFilter: () => void;
  isValidFilter: (filter: TimeFilter) => boolean;
}

const useFilterState = (options: UseFilterStateOptions = {}): UseFilterStateReturn => {
  const {
    defaultFilter = { type: 'month' },
    persistToUrl = true,
    urlParamPrefix = 'filter'
  } = options;

  // Initialize filter state
  const [currentFilter, setCurrentFilter] = useState<TimeFilter>(() => {
    if (persistToUrl && typeof window !== 'undefined') {
      return loadFilterFromUrl(urlParamPrefix) || getDefaultFilterWithDates(defaultFilter);
    }
    return getDefaultFilterWithDates(defaultFilter);
  });

  // Get default filter with calculated dates
  function getDefaultFilterWithDates(filter: TimeFilter): TimeFilter {
    if (filter.type === 'week') {
      const { start, end } = getWeekRange();
      return { type: 'week', startDate: start, endDate: end };
    } else if (filter.type === 'month') {
      const { start, end } = getMonthRange();
      return { type: 'month', startDate: start, endDate: end };
    }
    return filter;
  }

  // Calculate week range (Sunday to Saturday)
  function getWeekRange() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
  }

  // Calculate month range
  function getMonthRange() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return { start: startOfMonth, end: endOfMonth };
  }

  // Load filter from URL parameters
  function loadFilterFromUrl(prefix: string): TimeFilter | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const type = urlParams.get(`${prefix}_type`) as TimeFilterType;
      const startDateStr = urlParams.get(`${prefix}_start`);
      const endDateStr = urlParams.get(`${prefix}_end`);

      if (!type || !['week', 'month', 'custom'].includes(type)) {
        return null;
      }

      let filter: TimeFilter = { type };

      if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        // Validate dates
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          filter.startDate = startDate;
          filter.endDate = endDate;
        }
      }

      // If no valid dates but type is week/month, calculate them
      if (!filter.startDate || !filter.endDate) {
        if (type === 'week') {
          const { start, end } = getWeekRange();
          filter.startDate = start;
          filter.endDate = end;
        } else if (type === 'month') {
          const { start, end } = getMonthRange();
          filter.startDate = start;
          filter.endDate = end;
        }
      }

      return filter;
    } catch (error) {
      console.warn('Failed to load filter from URL:', error);
      return null;
    }
  }

  // Save filter to URL parameters
  function saveFilterToUrl(filter: TimeFilter, prefix: string) {
    if (typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      // Set filter parameters
      params.set(`${prefix}_type`, filter.type);
      
      if (filter.startDate) {
        params.set(`${prefix}_start`, filter.startDate.toISOString());
      } else {
        params.delete(`${prefix}_start`);
      }
      
      if (filter.endDate) {
        params.set(`${prefix}_end`, filter.endDate.toISOString());
      } else {
        params.delete(`${prefix}_end`);
      }

      // Update URL without triggering page reload
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      console.warn('Failed to save filter to URL:', error);
    }
  }

  // Validate filter
  const isValidFilter = useCallback((filter: TimeFilter): boolean => {
    if (!filter.type || !['week', 'month', 'custom'].includes(filter.type)) {
      return false;
    }

    if (filter.type === 'custom') {
      if (!filter.startDate || !filter.endDate) {
        return false;
      }
      
      if (filter.startDate > filter.endDate) {
        return false;
      }

      // Check if date range is reasonable (not more than 2 years)
      const daysDifference = Math.ceil(
        (filter.endDate.getTime() - filter.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 730) {
        return false;
      }
    }

    return true;
  }, []);

  // Set filter with validation and URL persistence
  const setFilter = useCallback((filter: TimeFilter) => {
    if (!isValidFilter(filter)) {
      console.warn('Invalid filter provided:', filter);
      return;
    }

    setCurrentFilter(filter);

    if (persistToUrl) {
      saveFilterToUrl(filter, urlParamPrefix);
    }
  }, [isValidFilter, persistToUrl, urlParamPrefix]);

  // Reset to default filter
  const resetFilter = useCallback(() => {
    const resetFilter = getDefaultFilterWithDates(defaultFilter);
    setFilter(resetFilter);
  }, [defaultFilter, setFilter]);

  // Update URL when filter changes (for cases where filter is set directly)
  useEffect(() => {
    if (persistToUrl && isValidFilter(currentFilter)) {
      saveFilterToUrl(currentFilter, urlParamPrefix);
    }
  }, [currentFilter, persistToUrl, urlParamPrefix, isValidFilter]);

  return {
    currentFilter,
    setFilter,
    resetFilter,
    isValidFilter
  };
};

export default useFilterState;