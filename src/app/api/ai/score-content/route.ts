import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { scoreContentOriginal } from '@/lib/ai/server/content-scorer';

const BodySchema = z.object({
  contentId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const score = await scoreContentOriginal(parsed.data.contentId);
    return createNextSuccessResponse(score);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '评分失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

