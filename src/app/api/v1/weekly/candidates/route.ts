import { NextRequest } from 'next/server';

import { automationErrorToResponse, getReadOnlyIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';
import { getWeeklyCandidates, WeeklyCandidatesQuerySchema } from '@/lib/automation/weekly-candidates';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = WeeklyCandidatesQuerySchema.parse({
      weekOffset: url.searchParams.get('weekOffset') ?? undefined,
      date: url.searchParams.get('date') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    return runAutomationRoute(request, {
      scope: 'weekly:read',
      workflow: 'weekly',
      step: 'candidates',
      idempotencyKey: getReadOnlyIdempotencyKey(request),
      requestPayload: query,
      handler: async () => {
        const result = await getWeeklyCandidates(query);
        return {
          status: result.status,
          result,
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
