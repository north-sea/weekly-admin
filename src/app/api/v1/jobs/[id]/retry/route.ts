import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateAutomationRequest } from '@/lib/automation/auth';
import { automationErrorToResponse, getRequiredIdempotencyKey } from '@/lib/automation/http';
import { createAutomationSuccessResponse } from '@/lib/automation/contracts';
import { retryAutomationRun } from '@/lib/jobs/retry';

const ParamsSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await authenticateAutomationRequest(request);
    const { id } = ParamsSchema.parse(await params);
    const idempotencyKey = getRequiredIdempotencyKey(request);
    const job = await retryAutomationRun({
      runId: id,
      caller,
      idempotencyKey,
    });

    return createAutomationSuccessResponse(job, {
      runId: job.runId,
      status: job.status,
      idempotentReplay: job.idempotentReplay,
      caller: job.caller,
    }, job.idempotentReplay ? 200 : 202);
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
