/**
 * 草稿数据服务层
 * 处理草稿的 CRUD 操作、同步、去重、分类建议等
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { fetchKarakeepBookmarks, KarakeepBookmark, karakeepApi, addBookmarkToKarakeepList } from './karakeep-api';

// 草稿查询参数类型
export interface DraftQuery {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'adopted' | 'rejected';
  priority?: number;
  keyword?: string;
  categoryFrom?: string;
  categoryTo?: string;
  dateFrom?: string;
  dateTo?: string;
  showDuplicates?: 'all' | 'original' | 'duplicate';
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'title' | 'synced_at';
  sortOrder?: 'asc' | 'desc';
  stage?: 'inbox' | 'editor';
}

// 草稿响应类型（包含关联数据）
export interface DraftWithRelations {
  id: bigint;
  karakeep_id: string;
  title: string;
  url: string;
  description: string | null;
  note: string | null;
  favicon_url: string | null;
  image_url: string | null;
  karakeep_created_at: Date | null;
  karakeep_updated_at: Date | null;
  status: string;
  priority: number | null;
  category_suggestion: string | null;
  tags_suggestion: string | null;
  duplicate_of_draft_id: bigint | null;
  content_id: bigint | null;
  synced_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  summary: string | null;
  tagging_status: string | null;
  summarization_status: string | null;
  slug: string | null;
  content: string | null;
  source: string | null;
  word_count: number | null;
  // 关联数据
  linked_content?: any;
  duplicate_of?: any;
  duplicates?: any[];
}

// 分页响应类型
export interface DraftListResponse {
  data: DraftWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 同步统计类型
export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  duplicatesDetected: number;
  categoriesSuggested: number;
}

/**
 * 域名到分类的映射规则
 * 可以根据需要扩展
 */
const DOMAIN_CATEGORY_MAP: Record<string, string> = {
  // 开发工具和平台
  'github.com': '开发工具',
  'gitlab.com': '开发工具',
  'bitbucket.org': '开发工具',
  
  // 技术问答
  'stackoverflow.com': '技术问答',
  'stackexchange.com': '技术问答',
  'segmentfault.com': '技术问答',
  
  // 技术博客和媒体
  'medium.com': '技术博客',
  'dev.to': '技术博客',
  'hashnode.com': '技术博客',
  'substack.com': '技术博客',
  'juejin.cn': '技术博客',
  'cnblogs.com': '技术博客',
  'csdn.net': '技术博客',
  
  // 视频教程
  'youtube.com': '视频教程',
  'youtu.be': '视频教程',
  'bilibili.com': '视频教程',
  
  // 文档和学习资源
  'docs.microsoft.com': '官方文档',
  'developer.mozilla.org': '官方文档',
  'nodejs.org': '官方文档',
  'react.dev': '官方文档',
  
  // 新闻和资讯
  'hackernews.com': '技术资讯',
  'news.ycombinator.com': '技术资讯',
  'techcrunch.com': '技术资讯',
  '36kr.com': '技术资讯',
  'infoq.cn': '技术资讯',
  
  // 设计资源
  'dribbble.com': '设计资源',
  'behance.net': '设计资源',
  'figma.com': '设计资源',
};

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 生成 slug（URL 友好的标识符）
 */
function generateSlug(url: string, title: string): string {
  try {
    const urlObj = new URL(url);
    // 使用域名 + 路径的一部分
    const domain = urlObj.hostname.replace(/^www\./, '').replace(/\./g, '-');
    const path = urlObj.pathname.split('/').filter(Boolean).slice(0, 2).join('-');
    const timestamp = Date.now().toString(36);
    return `${domain}-${path || 'index'}-${timestamp}`.toLowerCase().slice(0, 200);
  } catch {
    // 如果 URL 无效，使用标题
    return title.toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }
}

/**
 * 提取来源网站名称
 */
function extractSource(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    // 简单映射常见网站
    const sourceMap: Record<string, string> = {
      'github.com': 'GitHub',
      'medium.com': 'Medium',
      'dev.to': 'Dev.to',
      'stackoverflow.com': 'Stack Overflow',
      'youtube.com': 'YouTube',
      'bilibili.com': '哔哩哔哩',
      'juejin.cn': '掘金',
      'zhihu.com': '知乎',
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return 'Unknown';
  }
}

/**
 * 生成周刊格式的内容
 * 格式：
 * ### [标题](URL)
 * 
 * ![img](图片URL)  // 如果有图片
 * 
 * 正文内容（summary 或 description）
 */
function generateWeeklyContent(
  bookmark: KarakeepBookmark,
  summary: string | null,
  description: string | null,
  note: string | null
): string {
  const parts: string[] = [];
  
  // 第一行：### [标题](URL)
  const title = bookmark.content?.title || bookmark.title || 'Untitled';
  const url = bookmark.content?.url || '';
  parts.push(`### [${title}](${url})`);
  
  // 空行
  parts.push('');
  
  // 如果有图片，添加图片
  // 优先级：1. content.imageUrl (文章主图) 2. screenshotAssetId (Karakeep截图)
  const imageUrl = bookmark.content?.imageUrl || bookmark.content?.screenshotAssetId;
  if (imageUrl) {
    parts.push(`![img](${imageUrl})`);
    parts.push('');
  }
  
  // 正文内容：优先使用 AI 总结，其次是描述，最后是笔记
  const mainContent = summary || description || note || '';
  if (mainContent) {
    parts.push(mainContent);
  }
  
  return parts.join('\n');
}

/**
 * 规范化 URL（用于去重）
 * 去除 query 参数和 fragment
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * 根据域名建议分类
 */
function suggestCategory(url: string, title: string): string | null {
  const domain = extractDomain(url);
  
  // 直接匹配
  if (DOMAIN_CATEGORY_MAP[domain]) {
    return DOMAIN_CATEGORY_MAP[domain];
  }
  
  // 二级域名匹配
  for (const [key, value] of Object.entries(DOMAIN_CATEGORY_MAP)) {
    if (domain.endsWith(key)) {
      return value;
    }
  }
  
  // 基于标题的简单分类（可以扩展）
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('tutorial') || lowerTitle.includes('教程')) {
    return '教程';
  }
  if (lowerTitle.includes('news') || lowerTitle.includes('新闻')) {
    return '资讯';
  }
  if (lowerTitle.includes('tool') || lowerTitle.includes('工具')) {
    return '工具';
  }
  
  return null;
}

/**
 * 草稿服务类
 */
export class DraftService {
  /**
   * 获取草稿列表（分页、筛选、排序）
   */
  static async getDraftList(query: DraftQuery): Promise<DraftListResponse> {
    const {
      page = 1,
      pageSize = 20,
      status,
      priority,
      keyword,
      showDuplicates = 'all',
      sortBy = 'created_at',
      sortOrder = 'desc',
      stage,
    } = query;

    // 如果是 editor 阶段：返回 contents 表中 status='draft' 的草稿，映射为 DraftListResponse
    if (stage === 'editor') {
      // 关键词条件
      const whereContents: Prisma.contentsWhereInput = {
        status: 'draft',
      };
      if (keyword) {
        whereContents.OR = [
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { source_url: { contains: keyword } },
        ];
      }

      // 计算总数
      const total = await prisma.contents.count({ where: whereContents });

      // 排序映射（contents 不存在 priority/synced_at）
      const orderByContents: Prisma.contentsOrderByWithRelationInput =
        sortBy === 'title'
          ? { title: sortOrder }
          : sortBy === 'updated_at'
          ? { updated_at: sortOrder }
          : { created_at: sortOrder };

      const rows = await prisma.contents.findMany({
        where: whereContents,
        orderBy: orderByContents,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          categories: true,
          content_tags: {
            include: { tag: true },
          },
        },
      });

      // 映射为 DraftWithRelations 基本字段，以满足前端表格展示
      const mapped = rows.map((c) => ({
        id: c.id as unknown as bigint,
        karakeep_id: '',
        title: c.title,
        url: c.source_url || '',
        description: c.description,
        note: null,
        favicon_url: null,
        image_url: null,
        karakeep_created_at: null,
        karakeep_updated_at: null,
        status: 'adopted', // 在 editor 阶段展示为已采用的草稿来源
        priority: null,
        category_suggestion: c.categories?.name || null,
        tags_suggestion: JSON.stringify(
          (c as any).content_tags?.map((ct: any) => ({ id: ct.tag_id, name: ct.tag?.name, attachedBy: 'manual' })) || []
        ),
        duplicate_of_draft_id: null,
        content_id: c.id as unknown as bigint,
        synced_at: c.updated_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
        summary: null,
        tagging_status: null,
        summarization_status: null,
        slug: c.slug,
        content: c.content,
        source: c.source,
        word_count: c.word_count || 0,
        linked_content: {
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
        },
      }));

      return {
        data: mapped as any,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }

    // 如果是 inbox 阶段：仅返回草稿池
    if (stage === 'inbox') {
      // 构建 where 条件
      const where: Prisma.draftsWhereInput = {};

      // 状态筛选
      if (status) {
        where.status = status;
      }

      // 优先级筛选
      if (priority !== undefined) {
        where.priority = priority;
      }

      // 关键词搜索（标题、描述、URL）
      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { url: { contains: keyword } },
        ];
      }

      // 去重筛选
      if (showDuplicates === 'original') {
        where.duplicate_of_draft_id = null;
      } else if (showDuplicates === 'duplicate') {
        where.duplicate_of_draft_id = { not: null };
      }

      // 计算总数
      const total = await prisma.drafts.count({ where });

      // 排序
      const orderBy: Prisma.draftsOrderByWithRelationInput = {
        [sortBy]: sortOrder,
      };

      // 查询数据
      const drafts = await prisma.drafts.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          linked_content: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
          duplicate_of: {
            select: {
              id: true,
              title: true,
              url: true,
            },
          },
        },
      });

      return {
        data: drafts as any,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }

    // 其余情况（stage 未提供或为 all）：合并 inbox（drafts）与 editor（contents）
    // 1) 构建两个查询条件
    const inboxWhere: Prisma.draftsWhereInput = {};
    if (status) inboxWhere.status = status;
    if (priority !== undefined) inboxWhere.priority = priority;
    if (keyword) {
      inboxWhere.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { url: { contains: keyword } },
      ];
    }
    if (showDuplicates === 'original') {
      inboxWhere.duplicate_of_draft_id = null;
    } else if (showDuplicates === 'duplicate') {
      inboxWhere.duplicate_of_draft_id = { not: null };
    }

    const contentsWhere: Prisma.contentsWhereInput = { status: 'draft' };
    if (keyword) {
      contentsWhere.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { source_url: { contains: keyword } },
      ];
    }

    // 2) 分别统计总数
    const [inboxTotal, editorTotal] = await Promise.all([
      prisma.drafts.count({ where: inboxWhere }),
      prisma.contents.count({ where: contentsWhere }),
    ]);

    const total = inboxTotal + editorTotal;

    // 3) 读取足够的数据用于合并排序（到当前页的上限）
    const fetchLimit = page * pageSize;

    const [inboxRows, editorRows] = await Promise.all([
      prisma.drafts.findMany({
        where: inboxWhere,
        orderBy: { [sortBy]: sortOrder },
        skip: 0,
        take: fetchLimit,
        include: {
          linked_content: {
            select: { id: true, title: true, slug: true, status: true },
          },
          duplicate_of: {
            select: { id: true, title: true, url: true },
          },
        },
      }),
      prisma.contents.findMany({
        where: contentsWhere,
        orderBy:
          sortBy === 'title'
            ? { title: sortOrder }
            : sortBy === 'updated_at'
            ? { updated_at: sortOrder }
            : { created_at: sortOrder },
        skip: 0,
        take: fetchLimit,
        include: { 
          categories: true,
          content_tags: { include: { tag: true } },
        },
      }),
    ]);

    // 4) 将 contents 映射为 DraftWithRelations 结构
    const mappedEditors = editorRows.map((c) => ({
      id: c.id as unknown as bigint,
      karakeep_id: '',
      title: c.title,
      url: c.source_url || '',
      description: c.description,
      note: null,
      favicon_url: null,
      image_url: null,
      karakeep_created_at: null,
      karakeep_updated_at: null,
      status: 'adopted',
      priority: null,
      category_suggestion: (c as any).categories?.name || null,
      tags_suggestion: JSON.stringify(
        (c as any).content_tags?.map((ct: any) => ({ id: ct.tag_id, name: ct.tag?.name, attachedBy: 'manual' })) || []
      ),
      duplicate_of_draft_id: null,
      content_id: c.id as unknown as bigint,
      synced_at: c.updated_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
      summary: null,
      tagging_status: null,
      summarization_status: null,
      slug: c.slug,
      content: c.content,
      source: c.source,
      word_count: (c as any).word_count || 0,
      linked_content: {
        id: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
      },
    })) as any[];

    // 5) 合并并根据筛选器二次过滤（对 editor 结果应用 status/priority 约束）
    let combined = [...(inboxRows as any[]), ...mappedEditors];
    if (status) combined = combined.filter((item) => item.status === status);
    if (priority !== undefined) combined = combined.filter((item) => item.priority === priority);

    // 6) 排序（JS 层统一排序，null 值最后）
    const getKey = (item: any) => {
      const val = item[sortBy];
      if (val == null) return null;
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') {
        // 日期字符串
        const date = new Date(val as string);
        if (!isNaN(date.getTime())) return date.getTime();
        return val.toLowerCase();
      }
      return val;
    };

    combined.sort((a, b) => {
      const av = getKey(a);
      const bv = getKey(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // null 排在后面
      if (bv == null) return -1;
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 7) 分页切片
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = combined.slice(start, end);

    return {
      data: pageItems as any,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取草稿详情
   */
  static async getDraftById(id: bigint | number): Promise<DraftWithRelations | null> {
    const draft = await prisma.drafts.findUnique({
      where: { id: BigInt(id) },
      include: {
        linked_content: true,
        duplicate_of: true,
        duplicates: true,
      },
    });

    return draft as any;
  }

  /**
   * 创建草稿
   */
  static async createDraft(data: Prisma.draftsCreateInput): Promise<DraftWithRelations> {
    const draft = await prisma.drafts.create({
      data,
      include: {
        linked_content: true,
        duplicate_of: true,
      },
    });

    return draft as any;
  }

  /**
   * 更新草稿
   */
  static async updateDraft(
    id: bigint | number,
    data: Prisma.draftsUpdateInput
  ): Promise<DraftWithRelations> {
    const draft = await prisma.drafts.update({
      where: { id: BigInt(id) },
      data,
      include: {
        linked_content: true,
        duplicate_of: true,
      },
    });

    return draft as any;
  }

  /**
   * 删除草稿
   */
  static async deleteDraft(id: bigint | number): Promise<void> {
    await prisma.drafts.delete({
      where: { id: BigInt(id) },
    });
  }

  /**
   * 批量更新草稿状态
   */
  static async batchUpdateStatus(
    ids: (bigint | number)[],
    status: 'pending' | 'adopted' | 'rejected'
  ): Promise<number> {
    const result = await prisma.drafts.updateMany({
      where: {
        id: { in: ids.map(id => BigInt(id)) },
      },
      data: { status },
    });

    return result.count;
  }

  /**
   * 检测重复的草稿
   * 基于规范化的 URL
   */
  static async detectDuplicates(url: string): Promise<DraftWithRelations[]> {
    const normalizedUrl = normalizeUrl(url);
    
    // 查找相同的 URL
    const duplicates = await prisma.drafts.findMany({
      where: {
        url: { contains: normalizedUrl.split('://')[1]?.split('/')[0] || '' },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // 进一步过滤（规范化后完全相同）
    return duplicates.filter(draft => 
      normalizeUrl(draft.url) === normalizedUrl
    ) as any;
  }

  /**
   * 标记重复项
   */
  static async markDuplicates(originalId: bigint, duplicateIds: bigint[]): Promise<void> {
    await prisma.drafts.updateMany({
      where: {
        id: { in: duplicateIds },
      },
      data: {
        duplicate_of_draft_id: originalId,
      },
    });
  }

  /**
   * 从 Karakeep 同步书签
   * 只同步本地数据库中不存在的新书签（未入库的内容）
   */
  static async syncFromKarakeep(): Promise<SyncStats> {
    const stats: SyncStats = {
      total: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      duplicatesDetected: 0,
      categoriesSuggested: 0,
    };

    try {
      // 1. 从 Karakeep 获取所有书签（只获取未归档的）
      const bookmarks = await fetchKarakeepBookmarks({
        archived: false, // 只获取未归档的书签
        limit: 100, // 每页 100 条
      });
      
      console.log(`从 Karakeep 获取了 ${bookmarks.length} 条书签`);

      // 2. 获取本地已有的 karakeep_id 列表
      const existingKarakeepIds = await prisma.drafts.findMany({
        select: { karakeep_id: true },
      }).then(drafts => new Set(drafts.map(d => d.karakeep_id)));

      console.log(`本地数据库已有 ${existingKarakeepIds.size} 条草稿`);

      // 3. 过滤出本地不存在的书签（真正未入库的）
      const newBookmarks = bookmarks.filter(bookmark => !existingKarakeepIds.has(bookmark.id));
      
      console.log(`发现 ${newBookmarks.length} 条新书签需要同步`);
      stats.total = newBookmarks.length;

      if (newBookmarks.length === 0) {
        console.log('没有新书签需要同步');
        return stats;
      }

      // 4. 只处理新书签（创建新草稿）
      for (const bookmark of newBookmarks) {
        try {
          await this.processSingleBookmark(bookmark, stats);
        } catch (error) {
          console.error(`处理书签失败 (${bookmark.id}):`, error);
          stats.errors++;
        }
      }

      // 5. 执行全局去重检测
      await this.performGlobalDuplicateDetection();

      console.log('同步完成:', stats);
      return stats;
      
    } catch (error) {
      console.error('同步失败:', error);
      throw error;
    }
  }

  /**
   * 处理单条书签
   * @private
   */
  private static async processSingleBookmark(
    bookmark: KarakeepBookmark,
    stats: SyncStats
  ): Promise<void> {
    // 从 bookmark 中提取数据（根据 Karakeep API 实际结构）
    const karakeep_id = bookmark.id;
    const url = bookmark.content?.url || '';
    const title = bookmark.content?.title || bookmark.title || url;
    const description = bookmark.content?.description || null;
    const summary = bookmark.summary || null;
    const note = bookmark.note || null;

    // 验证必需字段
    if (!karakeep_id) {
      console.error('书签缺少 ID，跳过:', bookmark);
      stats.errors++;
      return;
    }
    if (!url) {
      console.error('书签缺少 URL，跳过，书签数据:', JSON.stringify(bookmark, null, 2));
      stats.errors++;
      return;
    }

    // 过滤：只同步 AI 处理完成的书签
    const taggingStatus = bookmark.taggingStatus || '';
    const summarizationStatus = bookmark.summarizationStatus || '';
    
    if (taggingStatus !== 'success' || summarizationStatus !== 'success') {
      console.log(`书签 ${karakeep_id} AI 处理未完成，跳过（tagging: ${taggingStatus}, summarization: ${summarizationStatus}）`);
      stats.errors++;
      return;
    }

    // 查找是否已存在
    const existing = await prisma.drafts.findUnique({
      where: { karakeep_id },
    });

    // 生成 slug（从 URL 或标题）
    const slug = generateSlug(url, title);
    
    // 提取来源网站名
    const source = extractSource(url);
    
    // 生成周刊格式的内容
    const content = generateWeeklyContent(bookmark, summary, description, note);
    
    // 计算字数
    const word_count = content ? content.length : 0;

    // 准备数据
    const draftData: any = {
      karakeep_id,
      title,
      url,
      description,
      summary,
      note,
      slug,
      content,
      source,
      word_count,
      favicon_url: bookmark.content?.favicon || null,
      image_url: bookmark.content?.imageUrl || bookmark.content?.screenshotAssetId || null,
      karakeep_created_at: bookmark.createdAt ? new Date(bookmark.createdAt) : null,
      karakeep_updated_at: bookmark.modifiedAt ? new Date(bookmark.modifiedAt) : null,
      tagging_status: taggingStatus,
      summarization_status: summarizationStatus,
      tags_suggestion: bookmark.tags ? JSON.stringify(bookmark.tags) : null,
      synced_at: new Date(),
    };

    if (existing) {
      // 更新现有记录（以 Karakeep 数据为准）
      // 但保留本地扩展字段（status, priority, category_suggestion）
      
      // 检查是否有实质性更新
      const hasChanges = 
        existing.title !== draftData.title ||
        existing.summary !== draftData.summary ||
        existing.description !== draftData.description ||
        existing.note !== draftData.note ||
        existing.tagging_status !== draftData.tagging_status ||
        existing.summarization_status !== draftData.summarization_status;
      
      if (hasChanges || existing.status === 'pending') {
        // 只更新 Karakeep 相关字段，保留本地字段
        await prisma.drafts.update({
          where: { karakeep_id },
          data: {
            // Karakeep 原始数据
            title: draftData.title,
            url: draftData.url,
            description: draftData.description,
            summary: draftData.summary,
            note: draftData.note,
            favicon_url: draftData.favicon_url,
            image_url: draftData.image_url,
            
            // Karakeep 元数据
            karakeep_created_at: draftData.karakeep_created_at,
            karakeep_updated_at: draftData.karakeep_updated_at,
            tagging_status: draftData.tagging_status,
            summarization_status: draftData.summarization_status,
            tags_suggestion: draftData.tags_suggestion,
            
            // 内容字段（可能需要重新生成）
            slug: draftData.slug,
            content: draftData.content,
            source: draftData.source,
            word_count: draftData.word_count,
            
            // 同步时间
            synced_at: draftData.synced_at,
            
            // 保留字段：status, priority, category_suggestion, content_id, duplicate_of_draft_id
            // 这些字段不会被更新，保持原值
          },
        });
        stats.updated++;
        
        console.log(`更新草稿 ${karakeep_id}: ${existing.title} -> ${draftData.title}`);
      } else {
        stats.unchanged++;
      }
    } else {
      // 新增记录
      // 建议分类
      const category_suggestion = suggestCategory(url, title);
      if (category_suggestion) {
        draftData.category_suggestion = category_suggestion;
        stats.categoriesSuggested++;
      }

      await prisma.drafts.create({
        data: draftData,
      });
      stats.created++;
      
      console.log(`新增草稿: ${draftData.title}`);
    }
  }

  /**
   * 执行全局去重检测
   * @private
   */
  private static async performGlobalDuplicateDetection(): Promise<void> {
    // 获取所有草稿
    const allDrafts = await prisma.drafts.findMany({
      orderBy: { created_at: 'asc' },
    });

    // 按规范化 URL 分组
    const urlGroups = new Map<string, typeof allDrafts>();
    
    for (const draft of allDrafts) {
      const normalizedUrl = normalizeUrl(draft.url);
      const group = urlGroups.get(normalizedUrl) || [];
      group.push(draft);
      urlGroups.set(normalizedUrl, group);
    }

    // 标记重复项
    for (const group of urlGroups.values()) {
      if (group.length > 1) {
        // 第一个作为原始，其他标记为重复
        const [original, ...duplicates] = group;
        const duplicateIds = duplicates.map(d => d.id);
        
        await this.markDuplicates(original.id, duplicateIds);
      }
    }
  }

  /**
   * 单独同步指定的草稿
   * 根据草稿 ID 从 Karakeep 重新获取最新数据
   */
  static async syncSingleDraft(draftId: bigint | number, options?: {
    addToList?: string; // Karakeep List ID
  }): Promise<{ success: boolean; message: string }> {
    try {
      // 获取草稿
      const draft = await this.getDraftById(BigInt(draftId));
      if (!draft) {
        return { success: false, message: '草稿不存在' };
      }

      if (!draft.karakeep_id) {
        return { success: false, message: '草稿没有关联的 Karakeep ID' };
      }

      // 从 Karakeep 获取最新数据
      const bookmark = await karakeepApi.getBookmark(draft.karakeep_id);

      // 使用现有的处理逻辑
      const stats: SyncStats = {
        total: 1,
        created: 0,
        updated: 0,
        unchanged: 0,
        errors: 0,
        duplicatesDetected: 0,
        categoriesSuggested: 0,
      };

      await this.processSingleBookmark(bookmark, stats);

      // 如果指定了列表，添加到列表
      if (options?.addToList && draft.karakeep_id) {
        try {
          await addBookmarkToKarakeepList(options.addToList, draft.karakeep_id);
          console.log(`已将书签添加到 Karakeep 列表: ${options.addToList}`);
        } catch (error) {
          console.error('添加到 Karakeep 列表失败:', error);
        }
      }

      return {
        success: true,
        message: stats.updated > 0 ? '同步成功（已更新）' : '同步成功（无变化）',
      };
    } catch (error) {
      console.error('同步单个草稿失败:', error);
      return { success: false, message: '同步失败' };
    }
  }

  /**
   * 批量同步指定的草稿
   */
  static async syncBatchDrafts(draftIds: (bigint | number)[], options?: {
    addToList?: string; // Karakeep List ID
  }): Promise<{
    total: number;
    success: number;
    failed: number;
    updated: number;
    unchanged: number;
  }> {
    const results = {
      total: draftIds.length,
      success: 0,
      failed: 0,
      updated: 0,
      unchanged: 0,
    };

    for (const draftId of draftIds) {
      const result = await this.syncSingleDraft(draftId, options);
      if (result.success) {
        results.success++;
        if (result.message.includes('已更新')) {
          results.updated++;
        } else {
          results.unchanged++;
        }
      } else {
        results.failed++;
      }
    }

    return results;
  }
}

// 导出便捷方法
export const getDraftList = DraftService.getDraftList.bind(DraftService);
export const getDraftById = DraftService.getDraftById.bind(DraftService);
export const createDraft = DraftService.createDraft.bind(DraftService);
export const updateDraft = DraftService.updateDraft.bind(DraftService);
export const deleteDraft = DraftService.deleteDraft.bind(DraftService);
export const syncFromKarakeep = DraftService.syncFromKarakeep.bind(DraftService);
export const syncSingleDraft = DraftService.syncSingleDraft.bind(DraftService);
export const syncBatchDrafts = DraftService.syncBatchDrafts.bind(DraftService);

