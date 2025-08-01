/**
 * React Query 缓存策略配置
 * 根据不同数据类型定义优化的缓存策略
 */

// 缓存时间常量 (毫秒)
export const CACHE_TIMES = {
  // 超长缓存 - 极少变化的数据
  ULTRA_LONG: 24 * 60 * 60 * 1000, // 24小时
  // 长缓存 - 较少变化的数据  
  LONG: 60 * 60 * 1000,           // 1小时
  // 中等缓存 - 中等变化频率的数据
  MEDIUM: 30 * 60 * 1000,         // 30分钟
  // 短缓存 - 经常变化的数据
  SHORT: 5 * 60 * 1000,           // 5分钟
  // 实时数据 - 需要频繁更新
  REAL_TIME: 30 * 1000,           // 30秒
} as const;

// GC (垃圾回收) 时间常量
export const GC_TIMES = {
  ULTRA_LONG: 48 * 60 * 60 * 1000, // 48小时
  LONG: 2 * 60 * 60 * 1000,        // 2小时
  MEDIUM: 60 * 60 * 1000,          // 1小时  
  SHORT: 30 * 60 * 1000,           // 30分钟
  REAL_TIME: 5 * 60 * 1000,        // 5分钟
} as const;

// 数据类型缓存策略
export const CACHE_STRATEGIES = {
  // 静态配置数据
  STATIC: {
    staleTime: CACHE_TIMES.ULTRA_LONG,
    gcTime: GC_TIMES.ULTRA_LONG,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  
  // 用户数据 (分类、标签等)
  USER_DATA: {
    staleTime: CACHE_TIMES.LONG,
    gcTime: GC_TIMES.LONG,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  
  // 内容数据 (文章、列表等)
  CONTENT: {
    staleTime: CACHE_TIMES.MEDIUM,
    gcTime: GC_TIMES.MEDIUM,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  
  // 分析统计数据
  ANALYTICS: {
    staleTime: CACHE_TIMES.SHORT,
    gcTime: GC_TIMES.SHORT,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  
  // 实时数据 (活动日志等)
  REAL_TIME: {
    staleTime: CACHE_TIMES.REAL_TIME,
    gcTime: GC_TIMES.REAL_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: CACHE_TIMES.REAL_TIME,
  },
  
  // 搜索结果
  SEARCH: {
    staleTime: CACHE_TIMES.SHORT,
    gcTime: GC_TIMES.SHORT,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
} as const;

// 查询键工厂函数
export const cacheKeyFactories = {
  // 内容相关
  content: {
    all: () => ['content'] as const,
    lists: () => [...cacheKeyFactories.content.all(), 'list'] as const,
    list: (params?: Record<string, any>) => [...cacheKeyFactories.content.lists(), params] as const,
    infinite: (params?: Record<string, any>) => [...cacheKeyFactories.content.all(), 'infinite', params] as const,
    details: () => [...cacheKeyFactories.content.all(), 'detail'] as const,
    detail: (id: string | number) => [...cacheKeyFactories.content.details(), id] as const,
    versions: (id: string | number) => [...cacheKeyFactories.content.detail(id), 'versions'] as const,
    stats: () => [...cacheKeyFactories.content.all(), 'stats'] as const,
  },
  
  // 分类相关
  categories: {
    all: () => ['categories'] as const,
    lists: () => [...cacheKeyFactories.categories.all(), 'list'] as const,
    list: (params?: Record<string, any>) => [...cacheKeyFactories.categories.lists(), params] as const,
    tree: () => [...cacheKeyFactories.categories.all(), 'tree'] as const,
    detail: (id: string | number) => [...cacheKeyFactories.categories.all(), 'detail', id] as const,
    stats: () => [...cacheKeyFactories.categories.all(), 'stats'] as const,
  },
  
  // 标签相关
  tags: {
    all: () => ['tags'] as const,
    lists: () => [...cacheKeyFactories.tags.all(), 'list'] as const,
    list: (params?: Record<string, any>) => [...cacheKeyFactories.tags.lists(), params] as const,
    detail: (id: string | number) => [...cacheKeyFactories.tags.all(), 'detail', id] as const,
    stats: () => [...cacheKeyFactories.tags.all(), 'stats'] as const,
    popular: () => [...cacheKeyFactories.tags.all(), 'popular'] as const,
  },
  
  // 分析数据相关
  analytics: {
    all: () => ['analytics'] as const,
    overview: (timeRange?: number) => [...cacheKeyFactories.analytics.all(), 'overview', timeRange] as const,
    sources: (timeRange?: number) => [...cacheKeyFactories.analytics.all(), 'sources', timeRange] as const,
    advanced: (timeRange?: number) => [...cacheKeyFactories.analytics.all(), 'advanced', timeRange] as const,
    export: () => [...cacheKeyFactories.analytics.all(), 'export'] as const,
  },
  
  // 周刊相关
  weekly: {
    all: () => ['weekly'] as const,
    lists: () => [...cacheKeyFactories.weekly.all(), 'list'] as const,
    list: (params?: Record<string, any>) => [...cacheKeyFactories.weekly.lists(), params] as const,
    detail: (id: string | number) => [...cacheKeyFactories.weekly.all(), 'detail', id] as const,
    contents: (id: string | number) => [...cacheKeyFactories.weekly.detail(id), 'contents'] as const,
    available: () => [...cacheKeyFactories.weekly.all(), 'available'] as const,
    stats: (id: string | number) => [...cacheKeyFactories.weekly.detail(id), 'stats'] as const,
  },
  
  // 操作日志相关
  operationLogs: {
    all: () => ['operationLogs'] as const,
    lists: () => [...cacheKeyFactories.operationLogs.all(), 'list'] as const,
    list: (params?: Record<string, any>) => [...cacheKeyFactories.operationLogs.lists(), params] as const,
    stats: () => [...cacheKeyFactories.operationLogs.all(), 'stats'] as const,
    export: () => [...cacheKeyFactories.operationLogs.all(), 'export'] as const,
  },
  
  // 搜索相关
  search: {
    all: () => ['search'] as const,
    results: (query: string, filters?: Record<string, any>) => [...cacheKeyFactories.search.all(), 'results', query, filters] as const,
    suggestions: (query: string) => [...cacheKeyFactories.search.all(), 'suggestions', query] as const,
  },
  
  // 用户相关
  user: {
    all: () => ['user'] as const,
    profile: () => [...cacheKeyFactories.user.all(), 'profile'] as const,
    settings: () => [...cacheKeyFactories.user.all(), 'settings'] as const,
    activity: () => [...cacheKeyFactories.user.all(), 'activity'] as const,
  },
} as const;

// 获取特定类型的缓存配置
export function getCacheConfig(type: keyof typeof CACHE_STRATEGIES) {
  return CACHE_STRATEGIES[type];
}

// 缓存失效策略
export const INVALIDATION_PATTERNS = {
  // 内容相关操作触发的失效
  CONTENT_MUTATION: [
    cacheKeyFactories.content.all(),
    cacheKeyFactories.analytics.all(),
    cacheKeyFactories.categories.stats(),
    cacheKeyFactories.tags.stats(),
  ],
  
  // 分类相关操作触发的失效
  CATEGORY_MUTATION: [
    cacheKeyFactories.categories.all(),
    cacheKeyFactories.content.lists(),
  ],
  
  // 标签相关操作触发的失效
  TAG_MUTATION: [
    cacheKeyFactories.tags.all(),
    cacheKeyFactories.content.lists(),
  ],
  
  // 周刊相关操作触发的失效
  WEEKLY_MUTATION: [
    cacheKeyFactories.weekly.all(),
    cacheKeyFactories.analytics.all(),
  ],
} as const;

// 预取策略配置
export const PREFETCH_CONFIG = {
  // 关键数据的预取
  CRITICAL: {
    staleTime: CACHE_TIMES.SHORT,
    priority: 'high' as const,
  },
  
  // 次要数据的预取
  SECONDARY: {
    staleTime: CACHE_TIMES.MEDIUM,
    priority: 'normal' as const,
  },
  
  // 后台预取
  BACKGROUND: {
    staleTime: CACHE_TIMES.LONG,
    priority: 'low' as const,
  },
} as const;