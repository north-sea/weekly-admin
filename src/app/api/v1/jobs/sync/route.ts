import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getRequiredIdempotencyKey, runQueuedAutomationRoute } from '@/lib/automation/http';

const BodySchema = z.object({
  sourceId: z.number().int().positive().optional(),
  type: z.enum(['rss', 'karakeep', 'webhook', 'manual']).optional(),
  max_items: z.number().int().min(1).max(500).optional(),
  similarity_check: z.boolean().optional(),
  auto_preprocess: z.boolean().optional(),
  incremental: z.boolean().optional(),
  only_due: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runQueuedAutomationRoute(request, {
      scope: 'sync:run',
      jobName: 'sync.run',
      idempotencyKey,
      requestPayload: body,
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
