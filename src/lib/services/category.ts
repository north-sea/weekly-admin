import { CategoryInput, CategoryUpdate, CategoryQuery, CategoryMerge } from '@/lib/validations/category';
import { prisma } from '@/lib/db';
import { OperationLogger } from '@/lib/middleware/operation-logger';
import { NextRequest } from 'next/server';

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
}
