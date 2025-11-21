import { TagInput, TagUpdate, TagQuery, TagMerge } from '@/lib/validations/tag';
import { prisma } from '@/lib/db';

export interface TagWithStats {
  id: number;
  name: string;
  slug: string;
  count: number;
  created_at?: Date;
  updated_at?: Date;
}

export class TagService {
  // 获取标签列表（支持分页）
  static async getTagList(query: TagQuery): Promise<{
    data: TagWithStats[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      keyword,
      sort_by = 'count',
      sort_order = 'desc',
      page,
      pageSize,
    } = query;
    
    const where: Record<string, unknown> = {};
    
    if (keyword) {
      where.name = { contains: keyword };
    }
    
    const orderBy: Record<string, string> = {};
    orderBy[sort_by] = sort_order;

    const usePagination = page !== undefined && pageSize !== undefined;
    const currentPage = page ?? 1;
    const currentPageSize = pageSize ?? 20;
    const skip = usePagination ? (currentPage - 1) * currentPageSize : undefined;

    const [total, tags] = await Promise.all([
      prisma.tags.count({ where }),
      prisma.tags.findMany({
        where,
        orderBy,
        skip,
        take: usePagination ? currentPageSize : undefined,
      }),
    ]);
    
    const mapped = await Promise.all(tags.map(async (tag) => {
      const count = await prisma.content_tags.count({
        where: { tag_id: tag.id }
      });
      
      return {
        ...tag,
        count: count || 0,
        created_at: tag.created_at || undefined,
        updated_at: tag.updated_at || undefined
      };
    }));
    
    return {
      data: mapped,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / currentPageSize)),
      },
    };
  }
  
  // 获取单个标签
  static async getTagById(id: number): Promise<TagWithStats | null> {
    const tag = await prisma.tags.findUnique({
      where: { id }
    });
    
    if (!tag) return null;
    
    const count = await prisma.content_tags.count({
      where: { tag_id: id }
    });
    
    return {
      ...tag,
      count: count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined
    };
  }
  
  // 创建标签
  static async createTag(data: TagInput): Promise<TagWithStats> {
    // 检查名称是否已存在
    const existingTag = await prisma.tags.findFirst({
      where: {
        OR: [
          { name: data.name },
          { slug: data.slug }
        ]
      }
    });
    
    if (existingTag) {
      if (existingTag.name === data.name) {
        throw new Error('标签名称已存在');
      }
      if (existingTag.slug === data.slug) {
        throw new Error('URL别名已存在');
      }
    }
    
    const tag = await prisma.tags.create({
      data: {
        ...data,
        count: 0
      }
    });
    
    return {
      ...tag,
      count: tag.count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined
    };
  }
  
  // 更新标签
  static async updateTag(data: TagUpdate): Promise<TagWithStats> {
    const { id, ...updateData } = data;
    
    // 检查标签是否存在
    const existingTag = await prisma.tags.findUnique({
      where: { id }
    });
    
    if (!existingTag) {
      throw new Error('标签不存在');
    }
    
    // 检查名称和slug是否与其他标签冲突
    if (updateData.name || updateData.slug) {
      const whereConditions = [];
      if (updateData.name) whereConditions.push({ name: updateData.name });
      if (updateData.slug) whereConditions.push({ slug: updateData.slug });
      
      const conflictTag = whereConditions.length > 0 ? await prisma.tags.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: whereConditions }
          ]
        }
      }) : null;
      
      if (conflictTag) {
        if (conflictTag.name === updateData.name) {
          throw new Error('标签名称已存在');
        }
        if (conflictTag.slug === updateData.slug) {
          throw new Error('URL别名已存在');
        }
      }
    }
    
    const tag = await prisma.tags.update({
      where: { id },
      data: updateData
    });
    
    return {
      ...tag,
      count: tag.count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined
    };
  }
  
  // 删除标签
  static async deleteTag(id: number): Promise<void> {
    // 删除标签与内容的关联
    await prisma.content_tags.deleteMany({
      where: { tag_id: id }
    });
    
    // 删除标签
    await prisma.tags.delete({
      where: { id }
    });
  }
  
  // 合并标签
  static async mergeTags(data: TagMerge): Promise<void> {
    const { source_tag_ids, target_tag_id } = data;
    
    // 检查目标标签是否存在
    const targetTag = await prisma.tags.findUnique({
      where: { id: target_tag_id }
    });
    
    if (!targetTag) {
      throw new Error('目标标签不存在');
    }
    
    // 检查源标签是否都存在
    const sourceTags = await prisma.tags.findMany({
      where: { id: { in: source_tag_ids } }
    });
    
    if (sourceTags.length !== source_tag_ids.length) {
      throw new Error('部分源标签不存在');
    }
    
    // 确保目标标签不在源标签列表中
    if (source_tag_ids.includes(target_tag_id)) {
      throw new Error('目标标签不能在源标签列表中');
    }
    
    // 开始事务处理
    await prisma.$transaction(async (tx) => {
      // 获取所有需要更新的内容标签关联
      const contentTags = await tx.content_tags.findMany({
        where: { tag_id: { in: source_tag_ids } }
      });
      
      // 删除原有的内容标签关联
      await tx.content_tags.deleteMany({
        where: { tag_id: { in: source_tag_ids } }
      });
      
      // 为每个内容创建与目标标签的关联（避免重复）
      const uniqueContentIds = [...new Set(contentTags.map(ct => ct.content_id))];
      
      for (const contentId of uniqueContentIds) {
        // 检查是否已经存在关联
        const existingRelation = await tx.content_tags.findFirst({
          where: {
            content_id: contentId,
            tag_id: target_tag_id
          }
        });
        
        // 如果不存在关联，则创建
        if (!existingRelation) {
          await tx.content_tags.create({
            data: {
              content_id: contentId,
              tag_id: target_tag_id
            }
          });
        }
      }
      
      // 更新目标标签的计数
      const newCount = await tx.content_tags.count({
        where: { tag_id: target_tag_id }
      });
      
      await tx.tags.update({
        where: { id: target_tag_id },
        data: { count: newCount }
      });
      
      // 删除源标签
      await tx.tags.deleteMany({
        where: { id: { in: source_tag_ids } }
      });
    });
  }
  
  // 更新标签使用计数
  static async updateTagCounts(): Promise<void> {
    const tags = await prisma.tags.findMany();
    
    for (const tag of tags) {
      const count = await prisma.content_tags.count({
        where: { tag_id: tag.id }
      });
      
      await prisma.tags.update({
        where: { id: tag.id },
        data: { count }
      });
    }
  }
  
  // 获取标签使用统计
  static async getTagStats(): Promise<Array<{ tag: TagWithStats; content_count: number }>> {
    const tags = await prisma.tags.findMany({
      orderBy: { count: 'desc' }
    });
    
    return tags.map(tag => ({
      tag: {
        ...tag,
        count: tag.count || 0,
        created_at: tag.created_at || undefined,
        updated_at: tag.updated_at || undefined
      },
      content_count: tag.count || 0
    }));
  }
  
  // 获取热门标签
  static async getPopularTags(limit: number = 10): Promise<TagWithStats[]> {
    const tags = await prisma.tags.findMany({
      orderBy: { count: 'desc' },
      take: limit
    });
    
    return tags.map(tag => ({
      ...tag,
      count: tag.count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined
    }));
  }
}
