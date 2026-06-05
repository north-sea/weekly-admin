import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getRequiredIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';
import { organizeWeekly } from '@/lib/ai/server/weekly-organizer';

const BodySchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  maxItems: z.number().int().positive().max(30).default(12),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runAutomationRoute(request, {
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggest',
      targetType: 'weekly_issue',
      targetId: body.weeklyIssueId,
      idempotencyKey,
      requestPayload: body,
      handler: async () => {
        const suggestion = await organizeWeekly({
          weeklyIssueId: body.weeklyIssueId,
          maxItems: body.maxItems,
        });

        return {
          status: 'succeeded',
          result: {
            status: 'preview',
            weeklyIssueId: body.weeklyIssueId,
            suggestion,
          },
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
