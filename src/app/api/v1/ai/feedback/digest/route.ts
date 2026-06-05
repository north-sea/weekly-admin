import { NextRequest } from 'next/server';
import { z } from 'zod';

import { automationErrorToResponse, getReadOnlyIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';
import { prisma } from '@/lib/db';

const QuerySchema = z.object({
  from: z.string().refine(isValidDateParam, 'from must be a valid date').optional(),
  to: z.string().refine(isValidDateParam, 'to must be a valid date').optional(),
  format: z.enum(['json', 'markdown']).optional(),
}).refine((value) => {
  if (!value.from || !value.to) return true;
  return new Date(value.from).getTime() <= new Date(value.to).getTime();
}, {
  message: 'from must be earlier than or equal to to',
  path: ['to'],
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = QuerySchema.parse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      format: url.searchParams.get('format') ?? undefined,
    });

    return runAutomationRoute(request, {
      scope: 'ops:read',
      workflow: 'ai',
      step: 'feedback_digest',
      idempotencyKey: getReadOnlyIdempotencyKey(request),
      requestPayload: query,
      handler: async () => {
        const result = await getFeedbackDigest(query);
        return {
          status: result.actions.length === 0 ? 'empty' : 'succeeded',
          result,
        };
      },
    });
  } catch (error: unknown) {
    return automationErrorToResponse(error);
  }
}

type FeedbackDigestQuery = z.infer<typeof QuerySchema>;

type InboxFeedbackAction = {
  id: number;
  created_at: string | null;
  user_id: number;
  operation_type: string;
  inbox_item_id: string | null;
  action: string;
  content_id: string | null;
  ai_score_at_action: number | null;
  reason: string | null;
  source: string | null;
  timestamp: string | null;
};

function isValidDateParam(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function parseDateParam(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

async function getFeedbackDigest(query: FeedbackDigestQuery) {
  const fromDate = parseDateParam(query.from);
  const toDate = parseDateParam(query.to);

  const logs = await prisma.operation_logs.findMany({
    where: {
      resource_type: 'inbox_item',
      ...(fromDate || toDate
        ? {
            created_at: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      user_id: true,
      operation_type: true,
      resource_id: true,
      operation_details: true,
      created_at: true,
    },
  });

  const actions = logs.map((log) => toFeedbackAction(log));
  const counts = actions.reduce<Record<string, number>>((acc, action) => {
    acc[action.action] = (acc[action.action] ?? 0) + 1;
    return acc;
  }, {});

  return {
    range: {
      from: query.from ?? null,
      to: query.to ?? null,
    },
    format: query.format ?? 'json',
    actions,
    counts,
    ...(query.format === 'markdown' ? { markdown: renderMarkdownDigest(actions, counts) } : {}),
  };
}

function toFeedbackAction(log: {
  id: number;
  user_id: number;
  operation_type: string;
  resource_id: string | null;
  operation_details: string | null;
  created_at: Date | null;
}): InboxFeedbackAction {
  const details = parseOperationDetails(log.operation_details);

  return {
    id: log.id,
    created_at: log.created_at ? log.created_at.toISOString() : null,
    user_id: log.user_id,
    operation_type: log.operation_type,
    inbox_item_id: log.resource_id,
    action: getString(details.action) ?? 'unknown',
    content_id: getString(details.content_id),
    ai_score_at_action: getNumber(details.ai_score_at_action),
    reason: getString(details.reason),
    source: getString(details.source),
    timestamp: getString(details.timestamp),
  };
}

function parseOperationDetails(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function renderMarkdownDigest(actions: InboxFeedbackAction[], counts: Record<string, number>): string {
  const countLines = Object.entries(counts)
    .map(([action, count]) => `- ${action}: ${count}`)
    .join('\n') || '- none: 0';
  const actionLines = actions
    .map((action) => `- ${action.created_at ?? 'unknown'} ${action.action} inbox=${action.inbox_item_id ?? 'unknown'}`)
    .join('\n') || '- no actions';

  return `# AI Feedback Digest\n\n## Counts\n${countLines}\n\n## Actions\n${actionLines}`;
}
