import { ContentInput, ContentQuery, ContentUpdate, BatchOperation } from '@/lib/validations/content';
import { prisma } from '@/lib/db';
import { syncContentToSearch, removeContentFromSearch } from '@/lib/search';
import { VersionService } from './version';
import { OperationLogger } from '@/lib/middleware/operation-logger';
import { NextRequest } from 'next/server';

export interface ContentWithRelations {
  id: bigint;
  title: string;
  slug: string;
  description?: string;
  summary?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  content: string;
  content_format?: string | null;
  source?: string | null;
  source_url?: string | null;
  status: string;
  meta_title?: string | null;
  meta_description?: string | null;
  word_count?: number | null;
  reading_time?: number | null;
  view_count?: number | null;
  screenshot_api?: string | null;
  recommendation_reason?: string | null;
  featured?: boolean;
  published_at?: Date;
  created_at?: Date;
  updated_at?: Date;
  content_type: {
    id: number;
    name: string;
    slug: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  attributes: Array<{
    attribute_name: string;
    attribute_value: string;
    attribute_type: string;
  }>;
}

export interface ContentListResponse {
  data: ContentWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class ContentService {
  // 获取内容列表
  static async getContentList(query: ContentQuery): Promise<ContentListResponse> {
    const { page, pageSize, contentType, status, category_id, tag_ids, keyword, sortBy, sortOrder, featured } = query;
    
    // 构建查询条件
    const where: Record<string, unknown> = {};
    
    // 内容类型筛选
    if (contentType !== 'all') {
      const contentTypeMap = { blog: 4, weekly: 3 };
      where.content_type_id = contentTypeMap[contentType as keyof typeof contentTypeMap];
    }
    
    // 状态筛选
    if (status) {
      where.status = status;
    }
    
    // 分类筛选
    if (category_id) {
      where.category_id = category_id;
    }
    
    // 标签筛选
    if (tag_ids && tag_ids.length > 0) {
      const contentIdsWithTags = await prisma.content_tags.findMany({
        where: { tag_id: { in: tag_ids } },
        select: { content_id: true }
      });
      const contentIds = contentIdsWithTags.map(ct => ct.content_id);
      where.id = { in: contentIds };
    }
    
    // 关键词搜索
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { content: { contains: keyword } }
      ];
    }
    
    // 精选筛选
    if (featured !== undefined) {
      where.featured = featured;
    }
    
    // 计算分页
    const skip = (page - 1) * pageSize;
    
    // 排序配置
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;
    
    // 执行查询
    const [contents, total] = await Promise.all([
      prisma.contents.findMany({
        where,
        skip,
        take: pageSize,
        orderBy
      }),
      prisma.contents.count({ where })
    ]);
    
    // 手动获取关联数据
    const data = await Promise.all(contents.map(async (content) => {
      return await this.enrichContentWithRelations({
        ...content,
        status: content.status || 'draft',
        title: content.title || '',
        content: content.content || ''
      });
    }));
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
  
  // 获取单个内容
  static async getContentById(id: number): Promise<ContentWithRelations | null> {
    const content = await prisma.contents.findUnique({
      where: { id: BigInt(id) }
    });
    
    if (!content) return null;
    
    return await this.enrichContentWithRelations({
      ...content,
      status: content.status || 'draft',
      title: content.title || '',
      content: content.content || ''
    });
  }
  
  // 丰富内容数据，添加关联信息
  private static async enrichContentWithRelations(content: {
    id: bigint;
    title: string;
    slug: string;
    description?: string | null;
    summary?: string | null;
    image_url?: string | null;
    content: string;
    content_format?: string | null;
    source?: string | null;
    source_url?: string | null;
    status: string;
    meta_title?: string | null;
    meta_description?: string | null;
    word_count?: number | null;
    reading_time?: number | null;
    view_count?: bigint | number | null;
    screenshot_api?: string | null;
    cover_image?: string | null;
    recommendation_reason?: string | null;
    featured?: boolean | null;
    published_at?: Date | null;
    created_at?: Date | null;
    updated_at?: Date | null;
    content_type_id: number;
    category_id?: number | null;
    [key: string]: unknown;
  }): Promise<ContentWithRelations> {
    // 获取内容类型
    const contentType = await prisma.content_types.findUnique({
      where: { id: content.content_type_id },
      select: { id: true, name: true, slug: true }
    });
    
    // 获取分类
    let category = null;
    if (content.category_id) {
      category = await prisma.categories.findUnique({
        where: { id: content.category_id },
        select: { id: true, name: true, slug: true }
      });
    }
    
    // 获取标签
    const contentTags = await prisma.content_tags.findMany({
      where: { content_id: content.id }
    });
    
    const tags = await Promise.all(
      contentTags.map(async (ct) => {
        const tag = await prisma.tags.findUnique({
          where: { id: ct.tag_id },
          select: { id: true, name: true, slug: true }
        });
        return tag!;
      })
    );
    
    // 获取属性
    const rawAttributes = await prisma.content_attributes.findMany({
      where: { content_id: content.id },
      select: { attribute_name: true, attribute_value: true, attribute_type: true }
    });
    
    const attributes = rawAttributes.map(attr => ({
      attribute_name: attr.attribute_name,
      attribute_value: attr.attribute_value || '',
      attribute_type: attr.attribute_type?.toString() || 'string'
    }));
    const coverImageAttr = rawAttributes.find(attr => attr.attribute_name === 'cover_image');
    const recommendationReasonAttr = rawAttributes.find(attr => attr.attribute_name === 'recommendation_reason');
    
    return {
      id: content.id,
      title: content.title,
      slug: content.slug,
      description: content.description ?? undefined,
      summary: content.summary ?? undefined,
      image_url: content.image_url ?? undefined,
      cover_image: (coverImageAttr?.attribute_value as string | null | undefined) ?? undefined,
      content: content.content,
      content_format: content.content_format ?? undefined,
      source: content.source ?? undefined,
      source_url: content.source_url ?? undefined,
      status: content.status,
      meta_title: content.meta_title ?? undefined,
      meta_description: content.meta_description ?? undefined,
      word_count: content.word_count ?? undefined,
      reading_time: content.reading_time ?? undefined,
      view_count: content.view_count !== null && content.view_count !== undefined ? Number(content.view_count) : undefined,
      screenshot_api: content.screenshot_api ?? undefined,
      recommendation_reason: (recommendationReasonAttr?.attribute_value as string | null | undefined) ?? undefined,
      featured: content.featured ?? undefined,
      published_at: content.published_at ?? undefined,
      created_at: content.created_at ?? undefined,
      updated_at: content.updated_at ?? undefined,
      content_type: contentType!,
      category: category || undefined,
      tags,
      attributes
    };
  }
  
  // 创建内容
  static async createContent(data: ContentInput, userId: number, request?: NextRequest): Promise<ContentWithRelations> {
    const { tag_ids, ...contentData } = data;
    
    // 生成slug
    const slug = this.generateSlug(data.title);
    
    // 创建内容
    const content = await prisma.contents.create({
      data: {
        ...contentData,
        slug,
        user_id: userId,
        published_at: data.status === 'published' ? new Date() : null
      }
    });
    
    // 处理标签关联
    if (tag_ids && tag_ids.length > 0) {
      await prisma.content_tags.createMany({
        data: tag_ids.map(tag_id => ({
          content_id: content.id,
          tag_id
        }))
      });
    }
    
    // 处理特殊属性（Blog和Weekly的专用字段）
    await this.handleContentAttributes(content.id, data);
    
    const result = await this.getContentById(Number(content.id));
    if (!result) {
      throw new Error('Failed to retrieve created content');
    }
    
    // 创建初始版本
    try {
      await VersionService.createVersion(
        content.id,
        {
          title: data.title,
          content: data.content,
          description: data.description,
          source: data.source,
          source_url: data.source_url,
          changes_summary: '初始版本'
        },
        userId
      );
    } catch (error) {
      console.error('Failed to create initial version:', error);
    }
    
    // 记录操作日志
    try {
      await OperationLogger.logContentOperation(
        userId,
        'CREATE',
        Number(content.id),
        {
          title: data.title,
          contentType: data.content_type_id === 3 ? 'weekly' : 'blog',
          status: data.status
        },
        request
      );
    } catch (error) {
      console.error('Failed to log content creation:', error);
    }
    
    // Sync to search index
    try {
      await syncContentToSearch(result);
    } catch (error) {
      console.error('Failed to sync new content to search:', error);
    }
    
    return result;
  }
  
  // 更新内容
  static async updateContent(data: ContentUpdate, userId: number, request?: NextRequest): Promise<ContentWithRelations> {
    const { id, tag_ids, ...updateData } = data;
    const contentId = BigInt(id);
    
    // 获取更新前的内容以便比较变化
    const oldContent = await prisma.contents.findUnique({
      where: { id: contentId }
    });
    
    if (!oldContent) {
      throw new Error('Content not found');
    }
    
    // 更新基本信息
    await prisma.contents.update({
      where: { id: contentId },
      data: {
        ...updateData,
        published_at: updateData.status === 'published' ? new Date() : undefined
      }
    });
    
    // 更新标签关联
    if (tag_ids !== undefined) {
      // 删除现有标签关联
      await prisma.content_tags.deleteMany({
        where: { content_id: contentId }
      });
      
      // 创建新的标签关联
      if (tag_ids.length > 0) {
        await prisma.content_tags.createMany({
          data: tag_ids.map((tag_id: number) => ({
            content_id: contentId,
            tag_id
          }))
        });
      }
    }
    
    // 更新特殊属性
    if (data.content_type_id) {
      await this.handleContentAttributes(contentId, data);
    }
    
    const result = await this.getContentById(id);
    if (!result) {
      throw new Error('Failed to retrieve updated content');
    }
    
    // 创建版本历史
    try {
      const changes = this.detectChanges(oldContent, updateData);
      const changesSummary = this.generateChangesSummary(changes);
      
      await VersionService.createVersion(
        contentId,
        {
          title: updateData.title || oldContent.title,
          content: updateData.content || oldContent.content,
          description: updateData.description || oldContent.description,
          source: updateData.source || oldContent.source,
          source_url: updateData.source_url || oldContent.source_url,
          changes_summary: changesSummary
        },
        userId
      );
    } catch (error) {
      console.error('Failed to create version:', error);
    }
    
    // 记录操作日志
    try {
      const changes = this.detectChanges(oldContent, updateData);
      await OperationLogger.logContentOperation(
        userId,
        'UPDATE',
        id,
        {
          title: updateData.title || oldContent.title,
          contentType: oldContent.content_type_id === 3 ? 'weekly' : 'blog',
          status: updateData.status || oldContent.status,
          changes
        },
        request
      );
    } catch (error) {
      console.error('Failed to log content update:', error);
    }
    
    // Sync to search index
    try {
      await syncContentToSearch(result);
    } catch (error) {
      console.error('Failed to sync updated content to search:', error);
    }
    
    return result;
  }
  
  // 删除内容
  static async deleteContent(id: number, userId: number, request?: NextRequest): Promise<void> {
    const contentId = BigInt(id);
    
    // 获取内容信息用于日志记录
    const content = await prisma.contents.findUnique({
      where: { id: contentId },
      select: { title: true, content_type_id: true, status: true }
    });
    
    // 删除相关数据
    await Promise.all([
      prisma.content_tags.deleteMany({ where: { content_id: contentId } }),
      prisma.content_attributes.deleteMany({ where: { content_id: contentId } }),
      prisma.content_relations.deleteMany({
        where: {
          OR: [
            { source_content_id: contentId },
            { target_content_id: contentId }
          ]
        }
      }),
      prisma.content_versions.deleteMany({ where: { content_id: contentId } })
    ]);
    
    // 删除内容
    await prisma.contents.delete({ where: { id: contentId } });
    
    // 记录操作日志
    if (content) {
      try {
        await OperationLogger.logContentOperation(
          userId,
          'DELETE',
          id,
          {
            title: content.title,
            contentType: content.content_type_id === 3 ? 'weekly' : 'blog',
            status: content.status || 'unknown'
          },
          request
        );
      } catch (error) {
        console.error('Failed to log content deletion:', error);
      }
    }
    
    // Remove from search index
    try {
      await removeContentFromSearch(id);
    } catch (error) {
      console.error('Failed to remove content from search:', error);
    }
  }
  
  // 批量操作
  static async batchOperation(operation: BatchOperation, userId: number, request?: NextRequest): Promise<void> {
    const { ids, operation: op } = operation;
    const contentIds = ids.map(id => BigInt(id));
    
    switch (op) {
      case 'delete':
        for (const id of ids) {
          await this.deleteContent(id, userId, request);
        }
        break;
        
      case 'publish':
        await prisma.contents.updateMany({
          where: { id: { in: contentIds } },
          data: { status: 'published', published_at: new Date() }
        });
        break;
        
      case 'archive':
        await prisma.contents.updateMany({
          where: { id: { in: contentIds } },
          data: { status: 'archived' }
        });
        break;
        
      case 'hide':
        await prisma.contents.updateMany({
          where: { id: { in: contentIds } },
          data: { status: 'hidden' }
        });
        break;
        
      case 'feature':
        await prisma.contents.updateMany({
          where: { id: { in: contentIds } },
          data: { featured: true }
        });
        break;
        
      case 'unfeature':
        await prisma.contents.updateMany({
          where: { id: { in: contentIds } },
          data: { featured: false }
        });
        break;
    }
    
    // 记录批量操作日志
    try {
      await OperationLogger.logBatchOperation(
        userId,
        op === 'delete' ? 'DELETE' : 'UPDATE',
        'content',
        {
          operation: op,
          resourceIds: ids,
          affectedCount: ids.length
        },
        request
      );
    } catch (error) {
      console.error('Failed to log batch operation:', error);
    }
  }
  
  // 处理内容属性（Blog和Weekly的专用字段）
  private static async handleContentAttributes(contentId: bigint, data: {
    content_type_id?: number;
    cover_image?: string;
    recommendation_reason?: string;
    [key: string]: unknown;
  }): Promise<void> {
    const attributes: Array<{ name: string; value: string; type: string }> = [];
    
    if (data.content_type_id === 4) { // Blog
      if (data.cover_image) {
        attributes.push({ name: 'cover_image', value: data.cover_image, type: 'string' });
      }
    } else if (data.content_type_id === 3) { // Weekly
      if (data.recommendation_reason) {
        attributes.push({ name: 'recommendation_reason', value: data.recommendation_reason, type: 'string' });
      }
    }
    
    // 删除现有属性
    await prisma.content_attributes.deleteMany({
      where: { content_id: contentId }
    });
    
    // 创建新属性
    if (attributes.length > 0) {
      await prisma.content_attributes.createMany({
        data: attributes.map(attr => ({
          content_id: contentId,
          attribute_name: attr.name,
          attribute_value: attr.value,
          attribute_type: attr.type as 'string' | 'number' | 'boolean' | 'json' | 'date'
        }))
      });
    }
  }
  
  // 生成slug
  private static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
  
  // 检测内容变化
  private static detectChanges(
    oldContent: any,
    newData: Partial<ContentUpdate>
  ): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};
    
    const fieldsToCheck = ['title', 'content', 'description', 'status', 'source', 'source_url'];
    
    fieldsToCheck.forEach(field => {
      if (newData[field as keyof ContentUpdate] !== undefined && 
          newData[field as keyof ContentUpdate] !== oldContent[field]) {
        changes[field] = {
          old: oldContent[field],
          new: newData[field as keyof ContentUpdate]
        };
      }
    });
    
    return changes;
  }
  
  // 生成变化摘要
  private static generateChangesSummary(changes: Record<string, { old: any; new: any }>): string {
    const changeDescriptions: string[] = [];
    
    Object.keys(changes).forEach(field => {
      switch (field) {
        case 'title':
          changeDescriptions.push('修改了标题');
          break;
        case 'content':
          changeDescriptions.push('修改了内容');
          break;
        case 'description':
          changeDescriptions.push('修改了描述');
          break;
        case 'status':
          changeDescriptions.push(`状态从 ${changes[field].old} 改为 ${changes[field].new}`);
          break;
        case 'source':
          changeDescriptions.push('修改了来源');
          break;
        case 'source_url':
          changeDescriptions.push('修改了来源链接');
          break;
        default:
          changeDescriptions.push(`修改了 ${field}`);
      }
    });
    
    return changeDescriptions.length > 0 ? changeDescriptions.join(', ') : '内容更新';
  }
}
