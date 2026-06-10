import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getRequiredIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';
import {
  createAdminWeeklySuggestionPreviewResult,
  normalizeWeeklySuggestionArtifact,
  toWeeklySuggestionPreviewResult,
} from '@/lib/automation/hermes-artifacts';
import { validateWeeklySuggestionItems } from '@/lib/automation/weekly-suggestions';
import { organizeWeekly } from '@/lib/ai/server/weekly-organizer';

const GenerateBodySchema = z.object({
  mode: z.enum(['generate']).optional(),
  weeklyIssueId: z.number().int().positive(),
  maxItems: z.number().int().positive().max(30).default(12),
});

const RegisterBodySchema = z.object({
  mode: z.literal('register'),
}).passthrough();

function getRegisterArtifactInput(body: z.infer<typeof RegisterBodySchema>) {
  if ('artifact' in body) return body.artifact;

  const { mode: _mode, ...artifact } = body;
  return artifact;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const mode = typeof rawBody === 'object' && rawBody !== null && 'mode' in rawBody
      ? (rawBody as { mode?: unknown }).mode
      : undefined;
    const body = mode === 'register'
      ? RegisterBodySchema.parse(rawBody)
      : GenerateBodySchema.parse(rawBody);
    const idempotencyKey = getRequiredIdempotencyKey(request);
    const targetId = body.mode === 'register'
      ? normalizeWeeklySuggestionArtifact(getRegisterArtifactInput(body)).weeklyIssueId
      : body.weeklyIssueId;

    return runAutomationRoute(request, {
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggest',
      targetType: 'weekly_issue',
      targetId,
      idempotencyKey,
      requestPayload: body,
      handler: async () => {
        if (body.mode === 'register') {
          const artifact = normalizeWeeklySuggestionArtifact(getRegisterArtifactInput(body));
          if (artifact.status === 'preview') {
            await validateWeeklySuggestionItems({
              weeklyIssueId: artifact.weeklyIssueId,
              items: artifact.items,
            });
          }

          return {
            status: artifact.status === 'empty' ? 'empty' as const : 'succeeded' as const,
            result: toWeeklySuggestionPreviewResult(artifact),
          };
        }

        const suggestion = await organizeWeekly({
          weeklyIssueId: body.weeklyIssueId,
          maxItems: body.maxItems,
        });

        return {
          status: 'succeeded',
          result: createAdminWeeklySuggestionPreviewResult({
            weeklyIssueId: body.weeklyIssueId,
            suggestion,
          }),
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
