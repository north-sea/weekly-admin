/**
 * 草稿 API 路由
 * GET /api/drafts - 获取草稿列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftList, DraftQuery } from '@/lib/services/draft';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

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
    const query: DraftQuery = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      status: searchParams.get('status') as any,
      priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!) : undefined,
      keyword: searchParams.get('keyword') || undefined,
      showDuplicates: (searchParams.get('showDuplicates') || 'all') as any,
      sortBy: (searchParams.get('sortBy') || 'created_at') as any,
      sortOrder: (searchParams.get('sortOrder') || 'desc') as any,
      stage: (searchParams.get('stage') || undefined) as any,
    };

    const result = await getDraftList(query);

    // 转换 BigInt 为字符串
    const serializedData = result.data.map(draft => ({
      ...draft,
      id: draft.id.toString(),
      duplicate_of_draft_id: draft.duplicate_of_draft_id?.toString() || null,
      content_id: draft.content_id?.toString() || null,
      linked_content: draft.linked_content ? {
        ...draft.linked_content,
        id: draft.linked_content.id.toString(),
      } : null,
      duplicate_of: draft.duplicate_of ? {
        ...draft.duplicate_of,
        id: draft.duplicate_of.id.toString(),
      } : null,
    }));

    return createNextSuccessResponse({
      ...result,
      data: serializedData,
    });
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    return createNextErrorResponse('GET_DRAFTS_ERROR', '获取草稿列表失败', 500);
  }
}

