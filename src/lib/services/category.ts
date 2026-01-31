import { CategoryInput, CategoryUpdate, CategoryQuery, CategoryMerge, CategoryMove, CategoryArchive, CategoryMigrate } from '@/lib/validations/category';
import { prisma } from '@/lib/db';
import { OperationLogger } from '@/lib/middleware/operation-logger';
import { NextRequest } from 'next/server';
import { DEFAULT_MAX_DEPTH } from '@/lib/utils/category-helpers';

export interface CategoryWithStats {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  description?: string;
  sort_order: number;
  created_at?: Date;
  updated_at?: Date;
  content_count: number;
  children?: CategoryWithStats[];
  parent?: {
    id: number;
    name: string;
    slug: string;
  };
}

export class CategoryService {
  private static slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private static async ensureUniqueSlug(desired: string, excludeId?: number): Promise<string> {
    const base = desired || 'category';
    let slug = this.slugify(base) || `category-${Date.now()}`;
    let counter = 1;

    // 保证 slug 唯一（忽略大小写）
    // 避免死循环，最多尝试 100 次
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await prisma.categories.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) break;
      slug = `${this.slugify(base)}-${counter++}`;
      if (counter > 100) {
        slug = `${this.slugify(base)}-${Date.now()}`;
        break;
      }
    }
    return slug;
  }

  // 获取分类列表（支持层级结构）
  static async getCategoryList(query: CategoryQuery): Promise<CategoryWithStats[]> {
    const { parent_id, keyword, include_children } = query;
    
    const where: Record<string, unknown> = {};
    
    // 父级分类筛选
    if (parent_id !== undefined) {
      where.parent_id = parent_id;
    } else {
      // 默认只获取顶级分类
      where.parent_id = null;
    }
    
    // 关键词搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } }
      ];
    }
    
    const categories = await prisma.categories.findMany({
      where,
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' }
      ]
    });
    
    const result: CategoryWithStats[] = [];
    
    for (const category of categories) {
      // 手动计算内容数量
      const contentCount = await prisma.contents.count({
        where: { category_id: category.id }
      });
      
      const categoryWithStats: CategoryWithStats = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id || undefined,
        description: category.description || undefined,
        sort_order: category.sort_order || 0,
        created_at: category.created_at || undefined,
        updated_at: category.updated_at || undefined,
        content_count: contentCount
      };
      
      // 递归获取子分类
      if (include_children) {
        const children = await this.getCategoryList({
          parent_id: category.id,
          keyword,
          include_children: true
        });
        if (children.length > 0) {
          categoryWithStats.children = children;
        }
      }
      
      result.push(categoryWithStats);
    }
    
    return result;
  }

  // 获取所有分类（扁平列表）
  static async getAllCategories(): Promise<CategoryWithStats[]> {
    const categories = await prisma.categories.findMany({
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' }
      ]
    });

    const contentCounts = await prisma.contents.groupBy({
      by: ['category_id'],
      _count: { category_id: true },
    });

    const countMap = new Map<number, number>();
    contentCounts.forEach(({ category_id, _count }) => {
      if (category_id) {
        countMap.set(category_id, _count.category_id || 0);
      }
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || undefined,
      description: category.description || undefined,
      sort_order: category.sort_order || 0,
      created_at: category.created_at || undefined,
      updated_at: category.updated_at || undefined,
      content_count: countMap.get(category.id) || 0,
    }));
  }
  
  // 获取单个分类
  static async getCategoryById(id: number): Promise<CategoryWithStats | null> {
    const category = await prisma.categories.findUnique({
      where: { id }
    });
    
    if (!category) return null;
    
    // 手动计算内容数量
    const contentCount = await prisma.contents.count({
      where: { category_id: id }
    });
    
    // 获取父分类信息
    let parent = null;
    if (category.parent_id) {
      parent = await prisma.categories.findUnique({
        where: { id: category.parent_id },
        select: { id: true, name: true, slug: true }
      });
    }
    
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || undefined,
      description: category.description || undefined,
      sort_order: category.sort_order || 0,
      created_at: category.created_at || undefined,
      updated_at: category.updated_at || undefined,
      content_count: contentCount,
      parent: parent || undefined
    };
  }
  
  // 创建分类
  static async createCategory(data: CategoryInput, userId?: number, request?: NextRequest): Promise<CategoryWithStats> {
    // 检查名称重复（忽略大小写）
    const existingName = await prisma.categories.findFirst({
      where: { name: data.name },
    });
    if (existingName) {
      throw new Error('分类名称已存在');
    }

    // 确保 slug 唯一
    const slug = await this.ensureUniqueSlug(data.slug || data.name);

    // 检查父分类是否存在
    if (data.parent_id) {
      const parentCategory = await prisma.categories.findUnique({
        where: { id: data.parent_id }
      });
      
      if (!parentCategory) {
        throw new Error('父分类不存在');
      }
    }
    
    const category = await prisma.categories.create({
      data: { ...data, slug }
    });
    
    const result = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || undefined,
      description: category.description || undefined,
      sort_order: category.sort_order || 0,
      created_at: category.created_at || undefined,
      updated_at: category.updated_at || undefined,
      content_count: 0
    };

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'CREATE',
        'category',
        category.id,
        { name: category.name, action: 'create' },
        request
      );
    }
    return result;
  }
  
  // 更新分类
  static async updateCategory(data: CategoryUpdate, userId?: number, request?: NextRequest): Promise<CategoryWithStats> {
    const { id, ...updateData } = data;
    
    // 检查分类是否存在
    const existingCategory = await prisma.categories.findUnique({
      where: { id }
    });
    
    if (!existingCategory) {
      throw new Error('分类不存在');
    }
    
    // 检查名称重复（忽略大小写）
    if (updateData.name) {
      const existingName = await prisma.categories.findFirst({
        where: {
          name: updateData.name,
          id: { not: id },
        },
      });
      if (existingName) {
        throw new Error('分类名称已存在');
      }
    }

    // 检查slug是否与其他分类冲突，并自动修正
    if (updateData.slug || updateData.name) {
      const desiredSlug = updateData.slug || updateData.name || existingCategory.slug;
      updateData.slug = await this.ensureUniqueSlug(desiredSlug, id);
    }
    
    // 检查父分类是否存在且不是自己
    if (updateData.parent_id) {
      if (updateData.parent_id === id) {
        throw new Error('不能将自己设为父分类');
      }
      
      const parentCategory = await prisma.categories.findUnique({
        where: { id: updateData.parent_id }
      });
      
      if (!parentCategory) {
        throw new Error('父分类不存在');
      }
      
      // 检查是否会形成循环引用
      const isCircular = await this.checkCircularReference(id, updateData.parent_id);
      if (isCircular) {
        throw new Error('不能形成循环引用');
      }
    }
    
    const category = await prisma.categories.update({
      where: { id },
      data: updateData
    });
    
    // 手动计算内容数量
    const contentCount = await prisma.contents.count({
      where: { category_id: id }
    });
    
    const result = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || undefined,
      description: category.description || undefined,
      sort_order: category.sort_order || 0,
      created_at: category.created_at || undefined,
      updated_at: category.updated_at || undefined,
      content_count: contentCount
    };

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'UPDATE',
        'category',
        id,
        { name: category.name, action: 'update', changes: updateData },
        request
      );
    }
    return result;
  }

  // 合并分类：将源分类的内容迁移到目标分类，并删除源分类
  static async mergeCategories(data: CategoryMerge, userId?: number, request?: NextRequest): Promise<void> {
    const { source_category_ids, target_category_id } = data;

    const target = await prisma.categories.findUnique({ where: { id: target_category_id } });
    if (!target) {
      throw new Error('目标分类不存在');
    }

    const sources = await prisma.categories.findMany({
      where: { id: { in: source_category_ids } },
    });
    if (sources.length !== source_category_ids.length) {
      throw new Error('部分源分类不存在');
    }
    if (source_category_ids.includes(target_category_id)) {
      throw new Error('目标分类不能与源分类相同');
    }

    await prisma.$transaction(async (tx) => {
      // 迁移内容到目标分类
      await tx.contents.updateMany({
        where: { category_id: { in: source_category_ids } },
        data: { category_id: target_category_id },
      });

      // 迁移子分类到目标分类下，避免孤儿节点
      await tx.categories.updateMany({
        where: { parent_id: { in: source_category_ids } },
        data: { parent_id: target_category_id, updated_at: new Date() },
      });

      // 更新目标分类的更新时间
      await tx.categories.update({
        where: { id: target_category_id },
        data: { updated_at: new Date() },
      });

      // 删除源分类
      await tx.categories.deleteMany({
        where: { id: { in: source_category_ids } },
      });
    });

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'UPDATE',
        'category',
        target_category_id,
        {
          name: target.name,
          action: 'merge',
          affectedContentCount: sources.length,
          changes: { mergedFrom: source_category_ids },
        },
        request
      );
    }
  }
  
  // 删除分类
  static async deleteCategory(id: number, userId?: number, request?: NextRequest): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 将子分类提升到顶层，避免孤儿引用
      await tx.categories.updateMany({
        where: { parent_id: id },
        data: { parent_id: null },
      });

      // 将内容的分类置空，避免外键阻塞删除
      await tx.contents.updateMany({
        where: { category_id: id },
        data: { category_id: null },
      });

      // 删除分类（如果已不存在则忽略）
      await tx.categories.deleteMany({
        where: { id },
      });
    });

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'DELETE',
        'category',
        id,
        { action: 'delete' },
        request
      );
    }
  }
  
  // 获取分类使用统计
  static async getCategoryStats(): Promise<Array<{ category: CategoryWithStats; content_count: number }>> {
    const categories = await prisma.categories.findMany({
      orderBy: { name: 'asc' }
    });
    
    const result = [];
    for (const category of categories) {
      const contentCount = await prisma.contents.count({
        where: { category_id: category.id }
      });
      
      result.push({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parent_id: category.parent_id || undefined,
          description: category.description || undefined,
          sort_order: category.sort_order || 0,
          created_at: category.created_at || undefined,
          updated_at: category.updated_at || undefined,
          content_count: contentCount
        },
        content_count: contentCount
      });
    }

    // 按内容数量排序
    return result.sort((a, b) => b.content_count - a.content_count);
  }

  // 检查循环引用
  private static async checkCircularReference(categoryId: number, parentId: number): Promise<boolean> {
    let currentParentId: number | undefined = parentId;

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true;
      }

      const parent: { parent_id: number | null } | null = await prisma.categories.findUnique({
        where: { id: currentParentId },
        select: { parent_id: true }
      });

      currentParentId = parent?.parent_id || undefined;
    }

    return false;
  }

  // 计算分类深度
  private static async getCategoryDepth(categoryId: number): Promise<number> {
    let depth = 0;
    let currentId: number | undefined = categoryId;

    while (currentId) {
      const cat: { parent_id: number | null } | null = await prisma.categories.findUnique({
        where: { id: currentId },
        select: { parent_id: true },
      });

      if (!cat?.parent_id) break;
      depth++;
      currentId = cat.parent_id;

      // 防止无限循环
      if (depth > 100) break;
    }

    return depth;
  }

  // 获取子树最大深度
  private static async getSubtreeMaxDepth(categoryId: number): Promise<number> {
    const children = await prisma.categories.findMany({
      where: { parent_id: categoryId },
      select: { id: true },
    });

    if (children.length === 0) return 0;

    let maxChildDepth = 0;
    for (const child of children) {
      const childDepth = await this.getSubtreeMaxDepth(child.id);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  // 移动分类（更改父级和排序）
  static async moveCategory(
    data: CategoryMove,
    maxDepth: number = DEFAULT_MAX_DEPTH,
    userId?: number,
    request?: NextRequest
  ): Promise<CategoryWithStats> {
    const { id, parent_id, sort_order } = data;

    // 检查分类是否存在
    const category = await prisma.categories.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error('分类不存在');
    }

    // 不能将自己设为父分类
    if (parent_id === id) {
      throw new Error('不能将自己设为父分类');
    }

    // 检查新父分类是否存在
    if (parent_id !== null) {
      const parentCategory = await prisma.categories.findUnique({
        where: { id: parent_id },
      });

      if (!parentCategory) {
        throw new Error('目标父分类不存在');
      }

      // 检查循环引用
      const isCircular = await this.checkCircularReference(id, parent_id);
      if (isCircular) {
        throw new Error('不能形成循环引用');
      }

      // 检查深度限制
      const targetDepth = await this.getCategoryDepth(parent_id);
      const subtreeDepth = await this.getSubtreeMaxDepth(id);

      if (targetDepth + subtreeDepth + 1 >= maxDepth) {
        throw new Error(`移动后将超过最大层级深度限制 (${maxDepth} 层)`);
      }
    }

    // 更新分类
    const updated = await prisma.categories.update({
      where: { id },
      data: {
        parent_id,
        sort_order,
        updated_at: new Date(),
      },
    });

    // 获取内容数量
    const contentCount = await prisma.contents.count({
      where: { category_id: id },
    });

    const result: CategoryWithStats = {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      parent_id: updated.parent_id || undefined,
      description: updated.description || undefined,
      sort_order: updated.sort_order || 0,
      created_at: updated.created_at || undefined,
      updated_at: updated.updated_at || undefined,
      content_count: contentCount,
    };

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'UPDATE',
        'category',
        id,
        {
          name: updated.name,
          action: 'move',
          changes: { parent_id, sort_order },
        },
        request
      );
    }

    return result;
  }

  // 归档/取消归档分类
  static async archiveCategory(
    data: CategoryArchive,
    userId?: number,
    request?: NextRequest
  ): Promise<CategoryWithStats> {
    const { id, archived } = data;

    // 检查分类是否存在
    const category = await prisma.categories.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error('分类不存在');
    }

    // 更新归档状态
    const updated = await prisma.categories.update({
      where: { id },
      data: {
        archived,
        updated_at: new Date(),
      },
    });

    // 获取内容数量
    const contentCount = await prisma.contents.count({
      where: { category_id: id },
    });

    const result: CategoryWithStats = {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      parent_id: updated.parent_id || undefined,
      description: updated.description || undefined,
      sort_order: updated.sort_order || 0,
      created_at: updated.created_at || undefined,
      updated_at: updated.updated_at || undefined,
      content_count: contentCount,
    };

    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'UPDATE',
        'category',
        id,
        {
          name: updated.name,
          action: archived ? 'archive' : 'unarchive',
        },
        request
      );
    }

    return result;
  }

  // 检查是否可以在指定父分类下创建子分类
  static async canCreateChild(
    parentId: number | null,
    maxDepth: number = DEFAULT_MAX_DEPTH
  ): Promise<boolean> {
    if (parentId === null) {
      return true; // 根级分类总是可以创建
    }

    const parentDepth = await this.getCategoryDepth(parentId);
    return parentDepth < maxDepth - 1;
  }

  // 获取分类迁移预览信息
  static async getMigrationPreview(sourceId: number): Promise<{
    category: CategoryWithStats;
    contentCount: number;
    childrenCount: number;
    children: Array<{ id: number; name: string; contentCount: number }>;
  }> {
    const category = await this.getCategoryById(sourceId);
    if (!category) {
      throw new Error('分类不存在');
    }

    // 获取直接子分类
    const children = await prisma.categories.findMany({
      where: { parent_id: sourceId },
      select: { id: true, name: true },
    });

    // 获取每个子分类的内容数量
    const childrenWithCount = await Promise.all(
      children.map(async (child) => {
        const count = await prisma.contents.count({
          where: { category_id: child.id },
        });
        return { id: child.id, name: child.name, contentCount: count };
      })
    );

    return {
      category,
      contentCount: category.content_count,
      childrenCount: children.length,
      children: childrenWithCount,
    };
  }

  // 迁移分类内容并删除分类
  static async migrateAndDelete(
    data: CategoryMigrate,
    userId?: number,
    request?: NextRequest
  ): Promise<{
    migratedContentCount: number;
    migratedChildrenCount: number;
    deletedCategoryId: number;
  }> {
    const { source_id, target_id, migrate_children } = data;

    // 检查源分类是否存在
    const sourceCategory = await prisma.categories.findUnique({
      where: { id: source_id },
    });

    if (!sourceCategory) {
      throw new Error('源分类不存在');
    }

    // 如果指定了目标分类，检查是否存在
    if (target_id !== null) {
      const targetCategory = await prisma.categories.findUnique({
        where: { id: target_id },
      });

      if (!targetCategory) {
        throw new Error('目标分类不存在');
      }

      if (target_id === source_id) {
        throw new Error('目标分类不能与源分类相同');
      }
    }

    // 获取源分类的内容数量
    const contentCount = await prisma.contents.count({
      where: { category_id: source_id },
    });

    // 获取子分类数量
    const childrenCount = await prisma.categories.count({
      where: { parent_id: source_id },
    });

    // 执行迁移
    await prisma.$transaction(async (tx) => {
      // 迁移内容到目标分类
      if (target_id !== null) {
        await tx.contents.updateMany({
          where: { category_id: source_id },
          data: { category_id: target_id },
        });
      } else {
        // 如果没有目标分类，将内容的分类置空
        await tx.contents.updateMany({
          where: { category_id: source_id },
          data: { category_id: null },
        });
      }

      // 处理子分类
      if (migrate_children && target_id !== null) {
        // 将子分类迁移到目标分类下
        await tx.categories.updateMany({
          where: { parent_id: source_id },
          data: { parent_id: target_id, updated_at: new Date() },
        });
      } else {
        // 将子分类提升到根级
        await tx.categories.updateMany({
          where: { parent_id: source_id },
          data: { parent_id: null, updated_at: new Date() },
        });
      }

      // 删除源分类
      await tx.categories.delete({
        where: { id: source_id },
      });
    });

    // 记录操作日志
    if (userId) {
      await OperationLogger.logTaxonomyOperation(
        userId,
        'DELETE',
        'category',
        source_id,
        {
          name: sourceCategory.name,
          action: 'migrate_and_delete',
          affectedContentCount: contentCount,
          changes: {
            migratedTo: target_id,
            migratedChildrenCount: migrate_children ? childrenCount : 0,
          },
        },
        request
      );
    }

    return {
      migratedContentCount: contentCount,
      migratedChildrenCount: migrate_children ? childrenCount : 0,
      deletedCategoryId: source_id,
    };
  }

  // 获取可作为迁移目标的分类列表
  static async getAvailableMigrationTargets(
    sourceId: number
  ): Promise<CategoryWithStats[]> {
    // 获取所有分类
    const allCategories = await this.getAllCategories();

    // 获取源分类的所有子孙 ID
    const descendantIds = new Set<number>();
    const collectDescendants = (parentId: number) => {
      allCategories.forEach((cat) => {
        if (cat.parent_id === parentId && !descendantIds.has(cat.id)) {
          descendantIds.add(cat.id);
          collectDescendants(cat.id);
        }
      });
    };
    collectDescendants(sourceId);

    // 排除源分类及其子孙
    return allCategories.filter(
      (cat) => cat.id !== sourceId && !descendantIds.has(cat.id)
    );
  }
}
