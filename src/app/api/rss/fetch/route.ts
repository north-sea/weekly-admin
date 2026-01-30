import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssFetchSchema } from '@/lib/validations/rss';
import { SyncOrchestrator } from '@/lib/services/sync-orchestrator';
import type { RssFetchResult } from '@/types/rss';

// POST /api/rss/fetch - 手动触发抓取（按 source_id）
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = RssFetchSchema.parse(body);

    const result = await SyncOrchestrator.syncDataSource(validated.source_id, {
      max_items: validated.max_items,
      similarity_check: validated.similarity_check,
    });

    const breakdown = result.duplicate_breakdown ?? {
      from_inbox: 0,
      from_contents: 0,
      from_similarity: 0,
    };

    const response: RssFetchResult = {
      source_id: validated.source_id,
      fetched_at: result.fetched_at,
      total_items: result.total_candidates,
      created: result.upserted,
      created_content_ids: [],
      dedup_report: {
        total: result.total_candidates,
        new: result.upserted,
        duplicates: {
          from_inbox: breakdown.from_inbox,
          from_contents: breakdown.from_contents,
          from_similarity: breakdown.from_similarity,
          from_drafts: breakdown.from_inbox,
        },
        details: [],
      },
      errors: result.errors,
    };

    return createNextSuccessResponse(response);
  } catch (error) {
    console.error('RSS 抓取失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('RSS_FETCH_ERROR', 'RSS 抓取失败', 500);
  }
}
