import { useState, useEffect, useCallback, useMemo } from 'react';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  persistToUrl?: boolean;
  urlParamPrefix?: string;
}

interface PaginationResult<T> {
  // State
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  
  // Data
  items: T[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refresh: () => void;
  
  // Computed
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

export const usePagination = <T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ data: T[]; total: number; hasMore: boolean }>,
  options: PaginationOptions = {}
): PaginationResult<T> => {
  const {
    initialPage = 1,
    initialPageSize = 20,
    persistToUrl = false,
    urlParamPrefix = 'page'
  } = options;

  // Initialize state from URL if persistence is enabled
  const getInitialState = (): PaginationState => {
    if (persistToUrl && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPage = parseInt(urlParams.get(`${urlParamPrefix}_num`) || '1');
      const urlPageSize = parseInt(urlParams.get(`${urlParamPrefix}_size`) || initialPageSize.toString());
      
      return {
        currentPage: Math.max(1, urlPage),
        pageSize: Math.max(1, urlPageSize),
        totalItems: 0,
        totalPages: 0
      };
    }
    
    return {
      currentPage: initialPage,
      pageSize: initialPageSize,
      totalItems: 0,
      totalPages: 0
    };
  };

  const [state, setState] = useState<PaginationState>(getInitialState);
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update URL when state changes
  const updateUrl = useCallback((page: number, pageSize: number) => {
    if (!persistToUrl || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set(`${urlParamPrefix}_num`, page.toString());
    url.searchParams.set(`${urlParamPrefix}_size`, pageSize.toString());
    
    window.history.replaceState({}, '', url.toString());
  }, [persistToUrl, urlParamPrefix]);

  // Fetch data
  const fetchData = useCallback(async (page: number, pageSize: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn(page, pageSize);
      
      setItems(result.data);
      setState(prev => ({
        ...prev,
        currentPage: page,
        pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / pageSize)
      }));
      
      updateUrl(page, pageSize);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, updateUrl]);

  // Set page
  const setPage = useCallback((page: number) => {
    if (page < 1 || (state.totalPages > 0 && page > state.totalPages)) return;
    fetchData(page, state.pageSize);
  }, [fetchData, state.pageSize, state.totalPages]);

  // Set page size
  const setPageSize = useCallback((size: number) => {
    if (size < 1) return;
    
    // Calculate what page we should be on with the new page size
    const currentFirstItem = (state.currentPage - 1) * state.pageSize + 1;
    const newPage = Math.ceil(currentFirstItem / size);
    
    fetchData(newPage, size);
  }, [fetchData, state.currentPage, state.pageSize]);

  // Refresh current page
  const refresh = useCallback(() => {
    fetchData(state.currentPage, state.pageSize);
  }, [fetchData, state.currentPage, state.pageSize]);

  // Initial fetch
  useEffect(() => {
    fetchData(state.currentPage, state.pageSize);
  }, []); // Only run once on mount

  // Computed values
  const computed = useMemo(() => ({
    hasNextPage: state.currentPage < state.totalPages,
    hasPreviousPage: state.currentPage > 1,
    startIndex: (state.currentPage - 1) * state.pageSize + 1,
    endIndex: Math.min(state.currentPage * state.pageSize, state.totalItems)
  }), [state.currentPage, state.pageSize, state.totalPages, state.totalItems]);

  return {
    // State
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    totalItems: state.totalItems,
    totalPages: state.totalPages,
    
    // Data
    items,
    isLoading,
    error,
    
    // Actions
    setPage,
    setPageSize,
    refresh,
    
    // Computed
    ...computed
  };
};

// Hook for client-side pagination of already loaded data
export const useClientPagination = <T>(
  allItems: T[],
  options: Omit<PaginationOptions, 'persistToUrl'> = {}
) => {
  const {
    initialPage = 1,
    initialPageSize = 20
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Get current page items
  const items = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allItems.slice(startIndex, endIndex);
  }, [allItems, currentPage, pageSize]);

  // Set page with bounds checking
  const setPage = useCallback((page: number) => {
    const boundedPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(boundedPage);
  }, [totalPages]);

  // Set page size and adjust current page if needed
  const setPageSizeAndAdjustPage = useCallback((size: number) => {
    if (size < 1) return;
    
    const currentFirstItem = (currentPage - 1) * pageSize + 1;
    const newPage = Math.ceil(currentFirstItem / size);
    const newTotalPages = Math.ceil(totalItems / size);
    
    setPageSize(size);
    setCurrentPage(Math.max(1, Math.min(newPage, newTotalPages || 1)));
  }, [currentPage, pageSize, totalItems]);

  // Reset to first page when items change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [allItems.length, currentPage, totalPages]);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    items,
    setPage,
    setPageSize: setPageSizeAndAdjustPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    startIndex: totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0,
    endIndex: Math.min(currentPage * pageSize, totalItems)
  };
};