import { z } from 'zod';

import { prisma } from '@/lib/db';
import { AutomationRouteError } from '@/lib/automation/http';

export const SuggestionApplyItemSchema = z.object({
  content_id: z.number().int().positive(),
  section: z.string().min(1).max(100),
  featured: z.boolean().optional().default(false),
  reason: z.string().max(200).optional(),
});

export const SuggestionApplySchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  replaceExisting: z.boolean().optional().default(false),
  items: z.array(SuggestionApplyItemSchema).min(1).max(30),
});

export type SuggestionApplyInput = z.infer<typeof SuggestionApplySchema>;

export async function applyWeeklySuggestion(input: SuggestionApplyInput) {
  const parsed = SuggestionApplySchema.parse(input);
  const contentIds = parsed.items.map((item) => BigInt(item.content_id));
  const uniqueContentIds = new Set(parsed.items.map((item) => item.content_id));

  if (uniqueContentIds.size !== parsed.items.length) {
    throw new AutomationRouteError('DUPLICATE_CONTENT_ID', 'Suggestion contains duplicate content ids', 400);
  }

  const issue = await prisma.weekly_issues.findUnique({
    where: { id: parsed.weeklyIssueId },
    select: { id: true, issue_number: true, title: true, status: true },
  });
  if (!issue) {
    throw new AutomationRouteError('WEEKLY_ISSUE_NOT_FOUND', 'Weekly issue was not found', 404);
  }

  const contents = await prisma.contents.findMany({
    where: {
      id: { in: contentIds },
      content_type_id: 3,
      status: { in: ['draft', 'ready', 'published'] },
    },
    select: {
      id: true,
      title: true,
      weekly_content_items: {
        select: {
          weekly_issue_id: true,
        },
      },
    },
  });

  const foundIds = new Set(contents.map((content) => Number(content.id)));
  const missingIds = parsed.items
    .map((item) => item.content_id)
    .filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new AutomationRouteError('INVALID_CONTENT_ID', 'Suggestion references invalid content ids', 400, { contentIds: missingIds });
  }

  const linkedElsewhere = contents.filter((content) =>
    content.weekly_content_items.some((item) => item.weekly_issue_id !== parsed.weeklyIssueId)
  );
  if (linkedElsewhere.length > 0) {
    throw new AutomationRouteError('CONTENT_ALREADY_LINKED', 'Some content is already linked to another weekly issue', 409, {
      contentIds: linkedElsewhere.map((content) => Number(content.id)),
    });
  }

  const existingInIssue = contents.filter((content) =>
    content.weekly_content_items.some((item) => item.weekly_issue_id === parsed.weeklyIssueId)
  );
  if (existingInIssue.length > 0 && !parsed.replaceExisting) {
    return {
      status: 'skipped' as const,
      weeklyIssueId: parsed.weeklyIssueId,
      issue,
      linkedCount: 0,
      skippedCount: existingInIssue.length,
      linkedContents: [],
      skippedContents: existingInIssue.map((content) => ({
        id: Number(content.id),
        title: content.title,
        reason: '已关联到该周刊',
      })),
    };
  }

  const byId = new Map(contents.map((content) => [Number(content.id), content]));

  await prisma.$transaction(async (tx) => {
    if (parsed.replaceExisting) {
      await tx.weekly_content_items.deleteMany({
        where: { weekly_issue_id: parsed.weeklyIssueId },
      });
    }

    const maxSortOrder = await tx.weekly_content_items.aggregate({
      where: { weekly_issue_id: parsed.weeklyIssueId },
      _max: { sort_order: true },
    });
    const startSortOrder = (maxSortOrder._max.sort_order ?? -1) + 1;

    await tx.weekly_content_items.createMany({
      data: parsed.items.map((item, index) => ({
        weekly_issue_id: parsed.weeklyIssueId,
        content_id: BigInt(item.content_id),
        sort_order: startSortOrder + index,
        section: item.section,
        featured: item.featured,
      })),
      skipDuplicates: true,
    });

    const linkedItems = await tx.weekly_content_items.findMany({
      where: { weekly_issue_id: parsed.weeklyIssueId },
      select: { content_id: true },
    });
    const stats = await tx.contents.aggregate({
      where: { id: { in: linkedItems.map((item) => item.content_id) } },
      _sum: { word_count: true, reading_time: true },
      _count: true,
    });

    await tx.weekly_issues.update({
      where: { id: parsed.weeklyIssueId },
      data: {
        total_items: stats._count,
        total_word_count: stats._sum.word_count ?? 0,
        reading_time: stats._sum.reading_time ?? 0,
      },
    });
  });

  return {
    status: 'applied' as const,
    weeklyIssueId: parsed.weeklyIssueId,
    issue,
    linkedCount: parsed.items.length,
    skippedCount: 0,
    linkedContents: parsed.items.map((item) => ({
      id: item.content_id,
      title: byId.get(item.content_id)?.title ?? `内容 #${item.content_id}`,
      section: item.section,
      featured: item.featured,
      reason: item.reason,
    })),
    skippedContents: [],
  };
}
