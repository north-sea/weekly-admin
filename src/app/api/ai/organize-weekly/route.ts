import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { organizeWeekly } from '@/lib/ai/server/weekly-organizer';

const BodySchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  maxItems: z.number().int().positive().max(30).optional(),
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

    const result = await organizeWeekly({
      weeklyIssueId: parsed.data.weeklyIssueId,
      maxItems: parsed.data.maxItems ?? 12,
    });

    return createNextSuccessResponse(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '周刊组织失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

