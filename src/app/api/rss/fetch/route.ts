import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssFetchSchema } from '@/lib/validations/rss';
import { ingestRssSource } from '@/lib/rss/ingest';

// POST /api/rss/fetch - 手动触发抓取（按 source_id）
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = RssFetchSchema.parse(body);

    const result = await ingestRssSource(validated.source_id, authResult.user.id, {
      max_items: validated.max_items,
      include_images: validated.include_images,
      image_fetch_limit: validated.image_fetch_limit,
      similarity_check: validated.similarity_check,
    });

    return createNextSuccessResponse(result);
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

