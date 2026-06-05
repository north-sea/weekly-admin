import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { InboxScoringService } from '@/lib/services/inbox-scoring';
import { OperationLogger } from '@/lib/middleware/operation-logger';

const BodySchema = z.object({
  inbox_id: z.string().min(1),
  force: z.boolean().optional(),
});

// Keep this as a human-admin JWT endpoint for manual single-item rescoring.
// Automation callers must use /api/v1/jobs/score with the score:run scope.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400, parsed.error.message);
    }

    const { inbox_id, force = false } = parsed.data;

    let inboxId: bigint;
    try {
      inboxId = BigInt(inbox_id);
    } catch {
      return createNextErrorResponse('VALIDATION_ERROR', 'inbox_id 必须为数字字符串', 400);
    }

    const result = await InboxScoringService.runOne(inboxId, { force, source: 'api' });

    try {
      await OperationLogger.logInboxAction({
        userId: authResult.user.id,
        action: 'manual_rescore',
        inboxItemId: inboxId,
        contentId: result.content_id,
        aiScoreAtAction: result.score ?? null,
        reason: force ? 'manual rescore (force)' : 'manual rescore',
        source: 'api',
      });
    } catch (error) {
      console.error('[api/v1/ai/score] 写入操作日志失败:', error);
    }

    return createNextSuccessResponse({
      scored: result.scored,
      score: result.score,
      promoted: result.promoted,
      content_id: result.content_id ? result.content_id.toString() : undefined,
      error: result.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '评分失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}
