import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  AutomationRouteError,
  automationErrorToResponse,
  getRequiredIdempotencyKey,
  runAutomationRoute,
} from '@/lib/automation/http';
import { prisma } from '@/lib/db';
import { quailService } from '@/lib/services/quail';

const BodySchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  forceRepublish: z.boolean().optional().default(false),
  deliver: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runAutomationRoute(request, {
      scope: 'weekly:publish',
      workflow: 'weekly',
      step: 'publish',
      targetType: 'weekly_issue',
      targetId: body.weeklyIssueId,
      idempotencyKey,
      requestPayload: body,
      handler: async () => {
        const issue = await prisma.weekly_issues.findUnique({
          where: { id: body.weeklyIssueId },
          select: {
            id: true,
            issue_number: true,
            title: true,
            status: true,
            quail_post_id: true,
            quail_post_slug: true,
            quail_published_at: true,
            quail_delivered_at: true,
          },
        });
        if (!issue) {
          throw new AutomationRouteError('WEEKLY_ISSUE_NOT_FOUND', 'Weekly issue was not found', 404);
        }

        if (issue.quail_published_at && !body.forceRepublish) {
          throw new AutomationRouteError('WEEKLY_ALREADY_PUBLISHED', 'Weekly issue is already published', 409, {
            weeklyIssueId: issue.id,
            quailPostId: issue.quail_post_id,
            quailPostSlug: issue.quail_post_slug,
            quailPublishedAt: issue.quail_published_at,
          });
        }

        const result = await quailService.publishWeekly(body.weeklyIssueId, {
          forceRepublish: body.forceRepublish,
          deliver: body.deliver,
        });
        if (!result.success) {
          throw new AutomationRouteError('PUBLISH_FAILED', result.error ?? 'Publish failed', 502);
        }

        return {
          status: 'succeeded',
          result: {
            status: 'published',
            weeklyIssueId: issue.id,
            issueNumber: issue.issue_number,
            title: issue.title,
            deliverRequested: body.deliver,
            forceRepublish: body.forceRepublish,
            quailPostId: result.quailPostId,
            quailPostSlug: result.quailPostSlug,
          },
          externalSideEffect: true,
          externalRef: result.quailPostSlug ?? result.quailPostId,
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}
