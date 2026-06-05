import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getRequiredIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';
import { InboxScoringService } from '@/lib/services/inbox-scoring';

const BodySchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  delay: z.number().int().min(0).max(5000).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runAutomationRoute(request, {
      scope: 'score:run',
      workflow: 'score',
      step: 'run',
      idempotencyKey,
      requestPayload: body,
      handler: async () => {
        const result = await InboxScoringService.runBatch({
          limit: body.limit,
          delayMs: body.delay,
          source: 'api',
        });
        const status = result.scored === 0 && result.failed === 0 ? 'empty' : result.failed > 0 ? 'partial_success' : 'succeeded';

        return {
          status,
          result: {
            status,
            ...result,
          },
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
