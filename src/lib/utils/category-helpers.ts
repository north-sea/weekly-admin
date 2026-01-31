/**
 * 分类层级辅助工具
 */

import { CategoryWithStats } from '@/types/category';

// 默认最大层级深度
export const DEFAULT_MAX_DEPTH = 3;

/**
 * 计算分类的层级深度
 * @param categoryId 分类 ID
 * @param categories 所有分类列表
 * @returns 层级深度（根节点为 0）
 */
export function getCategoryDepth(
  categoryId: number,
  categories: CategoryWithStats[]
): number {
  const categoryMap = new Map<number, CategoryWithStats>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat));

  let depth = 0;
  let current = categoryMap.get(categoryId);

  while (current?.parent_id) {
    depth++;
    current = categoryMap.get(current.parent_id);
    // 防止循环引用导致无限循环
    if (depth > 100) break;
  }

  return depth;
}

/**
 * 获取分类的完整路径
 * @param categoryId 分类 ID
 * @param categories 所有分类列表
 * @returns 从根到当前分类的路径数组
 */
export function getCategoryPath(
  categoryId: number,
  categories: CategoryWithStats[]
): CategoryWithStats[] {
  const categoryMap = new Map<number, CategoryWithStats>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat));

  const path: CategoryWithStats[] = [];
  let current = categoryMap.get(categoryId);

  while (current) {
    path.unshift(current);
    if (current.parent_id) {
      current = categoryMap.get(current.parent_id);
    } else {
      break;
    }
    // 防止循环引用
    if (path.length > 100) break;
  }

  return path;
}

/**
 * 检查是否可以在指定父分类下创建子分类
 * @param parentId 父分类 ID（null 表示根级）
 * @param categories 所有分类列表
 * @param maxDepth 最大层级深度
 * @returns 是否可以创建
 */
export function canCreateChildCategory(
  parentId: number | null,
  categories: CategoryWithStats[],
  maxDepth: number = DEFAULT_MAX_DEPTH
): boolean {
  if (parentId === null) {
    return true; // 根级分类总是可以创建
  }

  const parentDepth = getCategoryDepth(parentId, categories);
  return parentDepth < maxDepth - 1; // 子分类深度 = 父分类深度 + 1
}

/**
 * 获取可作为父分类的分类列表
 * 排除会导致超过最大深度的分类
 * @param categories 所有分类列表
 * @param excludeId 要排除的分类 ID（编辑时排除自己及其子孙）
 * @param maxDepth 最大层级深度
 * @returns 可选的父分类列表
 */
export function getAvailableParentCategories(
  categories: CategoryWithStats[],
  excludeId?: number,
  maxDepth: number = DEFAULT_MAX_DEPTH
): CategoryWithStats[] {
  // 获取要排除的分类及其所有子孙
  const excludeIds = new Set<number>();
  if (excludeId) {
    excludeIds.add(excludeId);
    const collectDescendants = (parentId: number) => {
      categories.forEach((cat) => {
        if (cat.parent_id === parentId && !excludeIds.has(cat.id)) {
          excludeIds.add(cat.id);
          collectDescendants(cat.id);
        }
      });
    };
    collectDescendants(excludeId);
  }

  return categories.filter((cat) => {
    // 排除自己及其子孙
    if (excludeIds.has(cat.id)) return false;

    // 检查深度限制
    const depth = getCategoryDepth(cat.id, categories);
    return depth < maxDepth - 1;
  });
}

/**
 * 计算拖拽后的新 sort_order 值
 * @param siblings 同级分类列表（已按 sort_order 排序）
 * @param targetIndex 目标位置索引
 * @param movingId 正在移动的分类 ID（可选，用于排除自己）
 * @returns 新的 sort_order 值
 */
export function calculateNewSortOrder(
  siblings: CategoryWithStats[],
  targetIndex: number,
  movingId?: number
): number {
  // 过滤掉正在移动的分类
  const filteredSiblings = movingId
    ? siblings.filter((s) => s.id !== movingId)
    : siblings;

  if (filteredSiblings.length === 0) {
    return 1000; // 第一个元素
  }

  if (targetIndex <= 0) {
    // 移动到最前面
    const firstOrder = filteredSiblings[0]?.sort_order ?? 1000;
    return Math.max(0, firstOrder - 1000);
  }

  if (targetIndex >= filteredSiblings.length) {
    // 移动到最后面
    const lastOrder = filteredSiblings[filteredSiblings.length - 1]?.sort_order ?? 0;
    return lastOrder + 1000;
  }

  // 移动到中间
  const prevOrder = filteredSiblings[targetIndex - 1]?.sort_order ?? 0;
  const nextOrder = filteredSiblings[targetIndex]?.sort_order ?? prevOrder + 2000;

  // 计算中间值
  const newOrder = Math.floor((prevOrder + nextOrder) / 2);

  // 如果中间值与前后值相同，需要重新排序
  if (newOrder === prevOrder || newOrder === nextOrder) {
    // 返回一个临时值，调用方需要触发重新排序
    return prevOrder + 1;
  }

  return newOrder;
}

/**
 * 重新计算同级分类的 sort_order
 * 当 sort_order 值过于接近时使用
 * @param siblings 同级分类列表
 * @returns 新的 sort_order 映射 { id: newSortOrder }
 */
export function recalculateSortOrders(
  siblings: CategoryWithStats[]
): Map<number, number> {
  const sorted = [...siblings].sort((a, b) => a.sort_order - b.sort_order);
  const result = new Map<number, number>();

  sorted.forEach((cat, index) => {
    result.set(cat.id, (index + 1) * 1000);
  });

  return result;
}

/**
 * 获取分类的所有子孙分类 ID
 * @param categoryId 分类 ID
 * @param categories 所有分类列表
 * @returns 子孙分类 ID 集合
 */
export function getDescendantIds(
  categoryId: number,
  categories: CategoryWithStats[]
): Set<number> {
  const descendants = new Set<number>();

  const collect = (parentId: number) => {
    categories.forEach((cat) => {
      if (cat.parent_id === parentId && !descendants.has(cat.id)) {
        descendants.add(cat.id);
        collect(cat.id);
      }
    });
  };

  collect(categoryId);
  return descendants;
}

/**
 * 获取分类树的统计信息
 * @param categories 所有分类列表
 * @returns 统计信息
 */
export function getCategoryTreeStats(categories: CategoryWithStats[]): {
  totalCount: number;
  maxDepth: number;
  rootCount: number;
  leafCount: number;
  totalContentCount: number;
} {
  const parentIds = new Set(categories.map((c) => c.parent_id).filter(Boolean));

  let maxDepth = 0;
  categories.forEach((cat) => {
    const depth = getCategoryDepth(cat.id, categories);
    if (depth > maxDepth) maxDepth = depth;
  });

  return {
    totalCount: categories.length,
    maxDepth: maxDepth + 1, // 深度从 0 开始，层数从 1 开始
    rootCount: categories.filter((c) => !c.parent_id).length,
    leafCount: categories.filter((c) => !parentIds.has(c.id)).length,
    totalContentCount: categories.reduce((sum, c) => sum + (c.content_count || 0), 0),
  };
}

/**
 * 验证分类层级结构的完整性
 * @param categories 所有分类列表
 * @returns 验证结果
 */
export function validateCategoryTree(categories: CategoryWithStats[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const categoryMap = new Map<number, CategoryWithStats>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat));

  // 检查孤儿节点（parent_id 指向不存在的分类）
  categories.forEach((cat) => {
    if (cat.parent_id && !categoryMap.has(cat.parent_id)) {
      errors.push(`分类 "${cat.name}" (ID: ${cat.id}) 的父分类不存在`);
    }
  });

  // 检查循环引用
  categories.forEach((cat) => {
    const visited = new Set<number>();
    let current: CategoryWithStats | undefined = cat;

    while (current?.parent_id) {
      if (visited.has(current.id)) {
        errors.push(`检测到循环引用，涉及分类 "${cat.name}" (ID: ${cat.id})`);
        break;
      }
      visited.add(current.id);
      current = categoryMap.get(current.parent_id);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
