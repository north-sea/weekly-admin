import { useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash-es';
import { useSearchQuery, useSearchSuggestions } from '@/hooks/queries/useSearchQueries';

// Re-export types from the centralized location
export type { SearchFilters, SearchOptions, SearchResult, SearchHistoryItem } from '@/lib/types/search';
import type { SearchFilters, SearchOptions, SearchHistoryItem } from '@/lib/types/search';

// Custom hook for search functionality with React Query
export function useSearch(initialOptions: SearchOptions = {}) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(initialOptions);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [shouldSearch, setShouldSearch] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState(initialOptions.query ?? '');
  
  // Use React Query for search
  const {
    data: searchResult,
    isLoading: isSearching,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchQuery(searchOptions, shouldSearch);
  
  // Use React Query for suggestions
  const {
    data: suggestionsData,
  } = useSearchSuggestions(
    suggestionQuery,
    5,
    Boolean(suggestionQuery.trim())
  );
  
  const suggestions = suggestionsData?.suggestions || [];
  
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
    
    setShouldSearch(true);
    refetchSearch();
  }, [searchOptions, updateSearchOptions, addToHistory, refetchSearch]);
  
  // Instant search (for search-as-you-type)
  const instantSearch = useCallback((query: string) => {
    updateSearchOptions({ query, page: 1 });
    
    // Debounced search execution
    const debouncedSearch = debounce(() => {
      setShouldSearch(true);
      refetchSearch();
    }, 500);
    
    debouncedSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Apply filters
  const applyFilters = useCallback((filters: SearchFilters) => {
    updateSearchOptions({ filters, page: 1 });
    setShouldSearch(true);
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Clear filters
  const clearFilters = useCallback(() => {
    updateSearchOptions({ filters: {}, page: 1 });
    setShouldSearch(true);
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Change page
  const changePage = useCallback((page: number) => {
    updateSearchOptions({ page });
    setShouldSearch(true);
    refetchSearch();
  }, [updateSearchOptions, refetchSearch]);
  
  // Change sort
  const changeSort = useCallback((sort: string[]) => {
    updateSearchOptions({ sort, page: 1 });
    setShouldSearch(true);
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
    setShouldSearch(true);
    refetchSearch();
  }, [refetchSearch]);
  
  // Fetch suggestions - now using React Query hook
  const fetchSuggestions = useCallback((query: string) => {
    setSuggestionQuery(query);
  }, []);
  
  const debouncedFetchSuggestions = useMemo(
    () => debounce(fetchSuggestions, 300),
    [fetchSuggestions]
  );
  
  useEffect(() => {
    if (searchOptions.query !== undefined) {
      setSuggestionQuery(searchOptions.query);
    }
  }, [searchOptions.query]);
  
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
export function useSearchSuggestionsOnly() {
  const [query, setQuery] = useState('');
  const [suggestionLimit, setSuggestionLimit] = useState(5);
  
  const {
    data: suggestionsData,
    isLoading,
  } = useSearchSuggestions(query, suggestionLimit, !!query.trim());
  
  const suggestions = suggestionsData?.suggestions || [];
  
  const fetchSuggestions = useCallback((newQuery: string, limit: number = 5) => {
    setSuggestionLimit(limit);
    setQuery(newQuery);
  }, []);
  
  const debouncedFetchSuggestions = useMemo(
    () => debounce(fetchSuggestions, 300),
    [fetchSuggestions]
  );
  
  return {
    suggestions,
    isLoading,
    fetchSuggestions: debouncedFetchSuggestions,
    clearSuggestions: () => setQuery(''),
  };
}
