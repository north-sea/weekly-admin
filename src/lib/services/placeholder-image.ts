/**
 * 占位图系统
 * 按分类返回预设占位图 URL
 */

export type PlaceholderCategory = 'frontend' | 'backend' | 'tools' | 'ai' | 'default';

// 分类到占位图的映射
const PLACEHOLDER_MAP: Record<PlaceholderCategory, string> = {
  frontend: '/placeholders/frontend.svg',
  backend: '/placeholders/backend.svg',
  tools: '/placeholders/tools.svg',
  ai: '/placeholders/ai.svg',
  default: '/placeholders/default.svg',
};

// 分类名称到占位图分类的映射
const CATEGORY_MAPPING: Record<string, PlaceholderCategory> = {
  // 前端相关
  前端: 'frontend',
  frontend: 'frontend',
  'front-end': 'frontend',
  react: 'frontend',
  vue: 'frontend',
  angular: 'frontend',
  css: 'frontend',
  html: 'frontend',
  javascript: 'frontend',
  typescript: 'frontend',
  ui: 'frontend',
  ux: 'frontend',

  // 后端相关
  后端: 'backend',
  backend: 'backend',
  'back-end': 'backend',
  server: 'backend',
  api: 'backend',
  database: 'backend',
  数据库: 'backend',
  node: 'backend',
  python: 'backend',
  java: 'backend',
  go: 'backend',
  rust: 'backend',

  // 工具相关
  工具: 'tools',
  tools: 'tools',
  devops: 'tools',
  git: 'tools',
  docker: 'tools',
  kubernetes: 'tools',
  ci: 'tools',
  cd: 'tools',
  测试: 'tools',
  testing: 'tools',

  // AI 相关
  ai: 'ai',
  人工智能: 'ai',
  机器学习: 'ai',
  'machine learning': 'ai',
  ml: 'ai',
  深度学习: 'ai',
  'deep learning': 'ai',
  llm: 'ai',
  gpt: 'ai',
  claude: 'ai',
};

/**
 * 根据分类名称获取占位图 URL
 */
export function getPlaceholderUrl(categoryName?: string | null): string {
  if (!categoryName) {
    return PLACEHOLDER_MAP.default;
  }

  const normalized = categoryName.toLowerCase().trim();
  const placeholderCategory = CATEGORY_MAPPING[normalized];

  if (placeholderCategory) {
    return PLACEHOLDER_MAP[placeholderCategory];
  }

  return PLACEHOLDER_MAP.default;
}

/**
 * 根据分类 ID 获取占位图 URL
 */
export async function getPlaceholderUrlByCategoryId(categoryId?: number | null): Promise<string> {
  if (!categoryId) {
    return PLACEHOLDER_MAP.default;
  }

  // 动态导入以避免循环依赖
  const { prisma } = await import('@/lib/db');

  const category = await prisma.categories.findUnique({
    where: { id: categoryId },
    select: { name: true, slug: true },
  });

  if (!category) {
    return PLACEHOLDER_MAP.default;
  }

  // 优先使用 slug，其次使用 name
  return getPlaceholderUrl(category.slug) !== PLACEHOLDER_MAP.default
    ? getPlaceholderUrl(category.slug)
    : getPlaceholderUrl(category.name);
}

/**
 * 获取所有可用的占位图分类
 */
export function getAvailablePlaceholders(): Array<{
  category: PlaceholderCategory;
  url: string;
  label: string;
}> {
  return [
    { category: 'frontend', url: PLACEHOLDER_MAP.frontend, label: '前端' },
    { category: 'backend', url: PLACEHOLDER_MAP.backend, label: '后端' },
    { category: 'tools', url: PLACEHOLDER_MAP.tools, label: '工具' },
    { category: 'ai', url: PLACEHOLDER_MAP.ai, label: 'AI' },
    { category: 'default', url: PLACEHOLDER_MAP.default, label: '默认' },
  ];
}
