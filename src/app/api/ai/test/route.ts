import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { serverGenerateText } from '@/lib/ai/server/client';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const BodySchema = z.object({
  prompt: z.string().trim().min(1).optional(),
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

    const text = await serverGenerateText({
      messages: [{ role: 'user', content: parsed.data.prompt ?? 'Ping' }],
      maxTokens: 32,
      temperature: 0,
    });

    return createNextSuccessResponse({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI 测试失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
