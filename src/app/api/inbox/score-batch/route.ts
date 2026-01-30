import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { batchScoreInboxItems } from '@/lib/ai/server/inbox-scorer';
import { z } from 'zod';

const BatchScoreSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  delay: z.number().int().min(0).max(5000).optional(),
});

// POST /api/inbox/score-batch - 批量评分未评分的 inbox items
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json().catch(() => ({}));
    const { limit = 50, delay = 500 } = BatchScoreSchema.parse(body);

    const result = await batchScoreInboxItems(limit, delay);
    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('批量评分失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('BATCH_SCORE_ERROR', '批量评分失败', 500);
  }
}
