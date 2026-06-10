import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getRequiredIdempotencyKey, runQueuedAutomationRoute } from '@/lib/automation/http';

const BodySchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  delay: z.number().int().min(0).max(5000).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runQueuedAutomationRoute(request, {
      scope: 'score:run',
      jobName: 'score.run',
      idempotencyKey,
      requestPayload: body,
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
