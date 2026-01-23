import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssDuplicateCheckSchema } from '@/lib/validations/rss';
import { checkDuplicateUrl } from '@/lib/rss/deduplicator';

// POST /api/rss/check-duplicate
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = RssDuplicateCheckSchema.parse(body);
    const result = await checkDuplicateUrl(validated.url);

    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('RSS 去重检查失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('RSS_CHECK_DUPLICATE_ERROR', 'RSS 去重检查失败', 500);
  }
}

