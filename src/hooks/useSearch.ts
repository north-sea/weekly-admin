import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash-es';

// Search filters interface
export interface SearchFilters {
  contentType?: 'blog' | 'weekly';
  status?: string[];
  categoryIds?: number[];
  tagIds?: number[];
  dateRange?: [string, string];
  sources?: string[];
  userId?: number;
}

// Search options interface
export interface SearchOptions {
  query?: string;
  filters?: SearchFilters;
  sort?: string[];
  page?: number;
  limit?: number;
  highlight?: boolean;
}

// Search result interface
export interface SearchResult {
  hits: any[];
  total: number;
  page: number;
  limit: number;
  processingTimeMs: number;
  query: string;
}

// Search history item interface
export interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: SearchFilters;
  timestamp: number;
}

// Custom hook for search functionality
export function useSearch(initialOptions: SearchOptions = {}) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(initialOptions);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Load search history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('search-history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, []);
  
  // Save search history to localStorage
  const saveSearchHistory = useCallback((history: SearchHistoryItem[]) => {
    try {
      localStorage.setItem('search-history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);
  
  // Add search to history
  const addToHistory = useCallback((query: string, filters?: SearchFilters) => {
    if (!query.trim()) return;
    
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      filters,
      timestamp: Date.now(),
    };
    
    setSearchHistory(prev => {
      // Remove duplicate queries
      const filtered = prev.filter(item => item.query !== historyItem.query);
      // Keep only last 20 items
      const newHistory = [historyItem, ...filtered].slice(0, 20);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, [saveSearchHistory]);
  
  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('search-history');
  }, []);
  
  // Remove item from history
  const removeFromHistory = useCallback((id: string) => {
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, [saveSearchHistory]);
  
  // Build query parameters for API call
  const buildQueryParams = useCallback((options: SearchOptions) => {
    const params = new URLSearchParams();
    
    if (options.query) params.set('q', options.query);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.highlight !== undefined) params.set('highlight', options.highlight.toString());
    
    if (options.filters) {
      const { contentType, status, categoryIds, tagIds, dateRange, sources, userId } = options.filters;
      
      if (contentType) params.set('contentType', contentType);
      if (status && status.length > 0) params.set('status', status.join(','));
      if (categoryIds && categoryIds.length > 0) params.set('categoryIds', categoryIds.join(','));
      if (tagIds && tagIds.length > 0) params.set('tagIds', tagIds.join(','));
      if (sources && sources.length > 0) params.set('sources', sources.join(','));
      if (userId) params.set('userId', userId.toString());
      if (dateRange && dateRange.length === 2) params.set('dateRange', dateRange.join(','));
    }
    
    if (options.sort && options.sort.length > 0) {
      params.set('sort', options.sort.join(','));
    }
    
    return params.toString();
  }, []);
  
  // Main search query
  const {
    data: searchResult,
    isLoading: isSearching,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['search', searchOptions],
    queryFn: async (): Promise<SearchResult> => {
      const queryString = buildQueryParams(searchOptions);
      const response = await fetch(`/api/search?${queryString}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }
      
      return result.data;
    },
    enabled: false, // Don't auto-fetch, only when explicitly called
  });
  
  // Search suggestions query
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/search?action=suggestions&q=${encodeURIComponent(query)}&limit=5`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSuggestions(result.data.suggestions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, []);
  
  // Debounced suggestions fetcher
  const debouncedFetchSuggestions = useMemo(
    () => debounce(fetchSuggestions, 300),
    [fetchSuggestions]
  );
  
  // Update search options
  const updateSearchOptions = useCallback((newOptions: Partial<SearchOptions>) => {
    setSearchOptions(prev => ({ ...prev, ...newOptions }));
  }, []);
  
  // Perform search
  const search = useCallback((options?: Partial<SearchOptions>) => {
    if (options) {
      updateSearchOptions(options);
    }
    
    const finalOptions = { ...searchOptions, ...options };
    
    // Add to history if there's a query
    if (finalOptions.query) {
      addToHistory(finalOptions.query, finalOptions.filters);
    }
    
    refetchSearch();
  }, [searchOptions, updateSearchOptions, addToHistory, refetchSearch]);
  
  // Instant search (for search-as-you-type)
  const instantSearch = useCallback((query: string) => {
    updateSearchOptions({ query, page: 1 });
    debouncedFetchSuggestions(query);
    
    // Debounced search execution
    const debouncedSearch = debounce(() => {
      refetchSearch();
    }, 500);
    
    debouncedSearch();
  }, [updateSearchOptions, debouncedFetchSuggestions, refetchSearch]);
  
  // Apply filters
  const applyFilters = useCallback((filters: SearchFilters) => {
    updateSearchOptions({ filters, page: 1 });
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Clear filters
  const clearFilters = useCallback(() => {
    updateSearchOptions({ filters: {}, page: 1 });
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Change page
  const changePage = useCallback((page: number) => {
    updateSearchOptions({ page });
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Change sort
  const changeSort = useCallback((sort: string[]) => {
    updateSearchOptions({ sort, page: 1 });
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Apply saved search from history
  const applyHistorySearch = useCallback((historyItem: SearchHistoryItem) => {
    const options: SearchOptions = {
      query: historyItem.query,
      filters: historyItem.filters,
      page: 1,
    };
    
    setSearchOptions(prev => ({ ...prev, ...options }));
    refetchSearch();
  }, [refetchSearch]);
  
  return {
    // Search state
    searchOptions,
    searchResult,
    isSearching,
    searchError,
    
    // Search actions
    search,
    instantSearch,
    updateSearchOptions,
    
    // Filter actions
    applyFilters,
    clearFilters,
    
    // Pagination and sorting
    changePage,
    changeSort,
    
    // Suggestions
    suggestions,
    fetchSuggestions: debouncedFetchSuggestions,
    
    // History
    searchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory,
    applyHistorySearch,
  };
}

// Hook for search suggestions only
export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchSuggestions = useCallback(async (query: string, limit: number = 5) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?action=suggestions&q=${encodeURIComponent(query)}&limit=${limit}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSuggestions(result.data.suggestions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const debouncedFetchSuggestions = useMemo(
    () => debounce(fetchSuggestions, 300),
    [fetchSuggestions]
  );
  
  return {
    suggestions,
    isLoading,
    fetchSuggestions: debouncedFetchSuggestions,
    clearSuggestions: () => setSuggestions([]),
  };
}