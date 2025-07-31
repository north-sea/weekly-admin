import { CategoryInput, CategoryUpdate, CategoryQuery } from '@/lib/validations/category';
import { prisma } from '@/lib/db';

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
  static async createCategory(data: CategoryInput): Promise<CategoryWithStats> {
    // 检查slug是否已存在
    const existingCategory = await prisma.categories.findFirst({
      where: { slug: data.slug }
    });
    
    if (existingCategory) {
      throw new Error('URL别名已存在');
    }
    
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
      data
    });
    
    return {
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
  }
  
  // 更新分类
  static async updateCategory(data: CategoryUpdate): Promise<CategoryWithStats> {
    const { id, ...updateData } = data;
    
    // 检查分类是否存在
    const existingCategory = await prisma.categories.findUnique({
      where: { id }
    });
    
    if (!existingCategory) {
      throw new Error('分类不存在');
    }
    
    // 检查slug是否与其他分类冲突
    if (updateData.slug) {
      const conflictCategory = await prisma.categories.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id }
        }
      });
      
      if (conflictCategory) {
        throw new Error('URL别名已存在');
      }
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
    
    return {
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
  }
  
  // 删除分类
  static async deleteCategory(id: number): Promise<void> {
    // 检查是否有子分类
    const childrenCount = await prisma.categories.count({
      where: { parent_id: id }
    });
    
    if (childrenCount > 0) {
      throw new Error('请先删除子分类');
    }
    
    // 检查是否有关联的内容
    const contentCount = await prisma.contents.count({
      where: { category_id: id }
    });
    
    if (contentCount > 0) {
      throw new Error('该分类下还有内容，无法删除');
    }
    
    await prisma.categories.delete({
      where: { id }
    });
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