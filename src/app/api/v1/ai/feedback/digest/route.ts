import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const QuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['json', 'markdown']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      format: url.searchParams.get('format') ?? undefined,
    });

    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400, parsed.error.message);
    }

    const { from, to } = parsed.data;

    return createNextSuccessResponse({
      range: { from: from ?? null, to: to ?? null },
      actions: [],
      counts: {},
      note: 'F1 baseline; F2 will populate',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'digest 失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
