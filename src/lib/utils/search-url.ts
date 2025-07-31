import { SearchFilters, SearchOptions } from '@/hooks/useSearch';

/**
 * Convert search options to URL search parameters
 */
export function searchOptionsToUrlParams(options: SearchOptions): URLSearchParams {
  const params = new URLSearchParams();
  
  if (options.query) {
    params.set('q', options.query);
  }
  
  if (options.page && options.page > 1) {
    params.set('page', options.page.toString());
  }
  
  if (options.limit && options.limit !== 20) {
    params.set('limit', options.limit.toString());
  }
  
  if (options.sort && options.sort.length > 0) {
    params.set('sort', options.sort.join(','));
  }
  
  if (options.filters) {
    const { filters } = options;
    
    if (filters.contentType) {
      params.set('type', filters.contentType);
    }
    
    if (filters.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      params.set('categories', filters.categoryIds.join(','));
    }
    
    if (filters.tagIds && filters.tagIds.length > 0) {
      params.set('tags', filters.tagIds.join(','));
    }
    
    if (filters.sources && filters.sources.length > 0) {
      params.set('sources', filters.sources.join(','));
    }
    
    if (filters.userId) {
      params.set('user', filters.userId.toString());
    }
    
    if (filters.dateRange && filters.dateRange.length === 2) {
      params.set('from', filters.dateRange[0]);
      params.set('to', filters.dateRange[1]);
    }
  }
  
  return params;
}

/**
 * Convert URL search parameters to search options
 */
export function urlParamsToSearchOptions(params: URLSearchParams): SearchOptions {
  const options: SearchOptions = {};
  
  const query = params.get('q');
  if (query) {
    options.query = query;
  }
  
  const page = params.get('page');
  if (page) {
    options.page = parseInt(page, 10);
  }
  
  const limit = params.get('limit');
  if (limit) {
    options.limit = parseInt(limit, 10);
  }
  
  const sort = params.get('sort');
  if (sort) {
    options.sort = sort.split(',');
  }
  
  // Parse filters
  const filters: SearchFilters = {};
  
  const contentType = params.get('type');
  if (contentType === 'blog' || contentType === 'weekly') {
    filters.contentType = contentType;
  }
  
  const status = params.get('status');
  if (status) {
    filters.status = status.split(',');
  }
  
  const categories = params.get('categories');
  if (categories) {
    filters.categoryIds = categories.split(',').map(Number).filter(n => !isNaN(n));
  }
  
  const tags = params.get('tags');
  if (tags) {
    filters.tagIds = tags.split(',').map(Number).filter(n => !isNaN(n));
  }
  
  const sources = params.get('sources');
  if (sources) {
    filters.sources = sources.split(',');
  }
  
  const user = params.get('user');
  if (user) {
    const userId = parseInt(user, 10);
    if (!isNaN(userId)) {
      filters.userId = userId;
    }
  }
  
  const from = params.get('from');
  const to = params.get('to');
  if (from && to) {
    filters.dateRange = [from, to];
  }
  
  if (Object.keys(filters).length > 0) {
    options.filters = filters;
  }
  
  return options;
}

/**
 * Generate a shareable search URL
 */
export function generateSearchUrl(options: SearchOptions, baseUrl: string = '/search'): string {
  const params = searchOptionsToUrlParams(options);
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Parse search URL and extract options
 */
export function parseSearchUrl(url: string): SearchOptions {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlParamsToSearchOptions(urlObj.searchParams);
  } catch (error) {
    console.error('Failed to parse search URL:', error);
    return {};
  }
}

/**
 * Create a search filter hash for caching/comparison
 */
export function createFilterHash(filters: SearchFilters): string {
  const sortedKeys = Object.keys(filters).sort();
  const hashParts = sortedKeys.map(key => {
    const value = (filters as any)[key];
    if (Array.isArray(value)) {
      return `${key}:${value.sort().join(',')}`;
    }
    return `${key}:${value}`;
  });
  return hashParts.join('|');
}

/**
 * Check if two filter objects are equal
 */
export function areFiltersEqual(filters1: SearchFilters, filters2: SearchFilters): boolean {
  return createFilterHash(filters1) === createFilterHash(filters2);
}

/**
 * Merge search options with defaults
 */
export function mergeSearchOptions(options: SearchOptions, defaults: SearchOptions): SearchOptions {
  return {
    query: options.query || defaults.query || '',
    page: options.page || defaults.page || 1,
    limit: options.limit || defaults.limit || 20,
    sort: options.sort || defaults.sort || [],
    filters: {
      ...defaults.filters,
      ...options.filters,
    },
    attributesToHighlight: options.attributesToHighlight || defaults.attributesToHighlight,
  };
}

/**
 * Validate search options
 */
export function validateSearchOptions(options: SearchOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (options.page && (options.page < 1 || !Number.isInteger(options.page))) {
    errors.push('Page must be a positive integer');
  }
  
  if (options.limit && (options.limit < 1 || options.limit > 100 || !Number.isInteger(options.limit))) {
    errors.push('Limit must be an integer between 1 and 100');
  }
  
  if (options.filters?.contentType && !['blog', 'weekly'].includes(options.filters.contentType)) {
    errors.push('Content type must be "blog" or "weekly"');
  }
  
  if (options.filters?.dateRange) {
    const [from, to] = options.filters.dateRange;
    if (!from || !to) {
      errors.push('Date range must have both start and end dates');
    } else if (new Date(from) > new Date(to)) {
      errors.push('Start date must be before end date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}