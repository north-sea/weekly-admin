/**
 * 草稿 API 路由
 * GET /api/drafts - 获取草稿列表
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import type { Prisma } from '@prisma/client';

type DraftQuery = {
  page: number;
  pageSize: number;
  status?: string;
  priority?: number;
  keyword?: string;
  source?: string;
  showDuplicates?: string;
  sortBy?: string;
  sortOrder?: string;
  stage?: string;
};

function mapInboxStatus(status?: string | null) {
  if (status === 'promoted') return 'adopted';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function mapInboxItemToDraft(item: any) {
  const tags = item.tags_suggestion;
  const tagsSuggestion =
    typeof tags === 'string' ? tags : tags ? JSON.stringify(tags) : null;

  return {
    id: String(item.id),
    karakeep_id: item.data_source?.type === 'karakeep' ? item.source_item_id || '' : '',
    title: item.title || '',
    url: item.url,
    description: item.description ?? null,
    note: item.note ?? null,
    favicon_url: item.favicon_url ?? null,
    image_url: item.image_url ?? null,
    karakeep_created_at: item.source_published_at ?? item.created_at ?? null,
    karakeep_updated_at: item.updated_at ?? null,
    status: mapInboxStatus(item.status),
    priority: item.priority ?? null,
    category_suggestion: item.category_suggestion ?? null,
    tags_suggestion: tagsSuggestion,
    duplicate_of_draft_id: item.duplicate_of_id != null ? String(item.duplicate_of_id) : null,
    content_id: item.content_id != null ? String(item.content_id) : null,
    synced_at: item.synced_at ?? null,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    summary: item.summary ?? null,
    content: item.content ?? null,
    source: item.source_name ?? null,
    domain: null,
    duplicate_of: item.duplicate_of
      ? {
          id: String(item.duplicate_of.id),
          title: item.duplicate_of.title,
          url: item.duplicate_of.url,
        }
      : null,
  };
}

function mapContentToDraft(item: any) {
  const tagsSuggestion = JSON.stringify(
    item.content_tags?.map((ct: any) => ({ id: ct.tag_id, name: ct.tag?.name, attachedBy: 'manual' })) || []
  );

  return {
    id: String(item.id),
    karakeep_id: '',
    title: item.title || '',
    url: item.source_url || '',
    description: item.description ?? null,
    note: null,
    favicon_url: null,
    image_url: item.image_url ?? null,
    karakeep_created_at: null,
    karakeep_updated_at: null,
    status: 'adopted',
    priority: null,
    category_suggestion: item.categories?.name || null,
    tags_suggestion: tagsSuggestion,
    duplicate_of_draft_id: null,
    content_id: item.id != null ? String(item.id) : null,
    synced_at: item.updated_at ?? null,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    summary: item.summary ?? null,
    content: item.content ?? null,
    source: item.source ?? null,
    domain: null,
    duplicate_of: null,
    linked_content: {
      id: item.id,
      title: item.title,
      slug: item.slug,
      status: item.status,
    },
  };
}

/**
 * GET /api/drafts
 * 获取草稿列表（分页、筛选、搜索）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const rawStage = searchParams.get('stage');
    const stage = rawStage === null || rawStage === '' || rawStage === 'all' ? undefined : (rawStage as any);

    const query: DraftQuery = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      status: searchParams.get('status') as any,
      priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!) : undefined,
      keyword: searchParams.get('keyword') || undefined,
      source: searchParams.get('source') || undefined,
      showDuplicates: (searchParams.get('showDuplicates') || 'all') as any,
      sortBy: (searchParams.get('sortBy') || 'created_at') as any,
      sortOrder: (searchParams.get('sortOrder') || 'desc') as any,
      stage,
    };

    if (stage === 'editor') {
      const whereContents: any = { status: 'draft' };
      if (query.keyword) {
        whereContents.OR = [
          { title: { contains: query.keyword } },
          { description: { contains: query.keyword } },
          { source_url: { contains: query.keyword } },
        ];
      }
      if (query.source) {
        whereContents.source_url = { contains: query.source };
      }

      const total = await prisma.contents.count({ where: whereContents });
      const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
      const orderBy: Prisma.contentsOrderByWithRelationInput =
        query.sortBy === 'title'
          ? { title: sortOrder }
          : query.sortBy === 'updated_at'
          ? { updated_at: sortOrder }
          : { created_at: sortOrder };

      const rows = await prisma.contents.findMany({
        where: whereContents,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          categories: true,
          content_tags: { include: { tag: true } },
        },
      });

      return createNextSuccessResponse({
        data: rows.map(mapContentToDraft),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      });
    }

    const where: any = {};
    if (query.status) {
      where.status = query.status === 'adopted' ? 'promoted' : query.status;
    }
    if (query.priority !== undefined) where.priority = query.priority;
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { url: { contains: query.keyword } },
        { description: { contains: query.keyword } },
        { note: { contains: query.keyword } },
      ];
    }
    if (query.source) {
      where.url = { contains: query.source };
    }
    if (query.showDuplicates === 'original') where.duplicate_of_id = null;
    if (query.showDuplicates === 'duplicate') where.duplicate_of_id = { not: null };

    const sortBy =
      query.sortBy === 'karakeep_created_at' ? 'source_published_at' : query.sortBy ?? 'created_at';
    const orderBy: any = { [sortBy]: query.sortOrder ?? 'desc' };

    const total = await prisma.inbox_items.count({ where });
    const rows = await prisma.inbox_items.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        data_source: true,
        duplicate_of: true,
      },
    });

    const mapped = rows.map(mapInboxItemToDraft);

    return createNextSuccessResponse({
      data: mapped,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    return createNextErrorResponse('GET_DRAFTS_ERROR', '获取草稿列表失败', 500);
  }
}
