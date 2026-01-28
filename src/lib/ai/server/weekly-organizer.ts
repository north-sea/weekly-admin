import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

const OrganizeRequestSchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  maxItems: z.number().int().positive().max(30).default(12),
});

export type OrganizeRequest = z.infer<typeof OrganizeRequestSchema>;

const OrganizeResultSchema = z.object({
  intro: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        content_id: z.number().int().positive(),
        section: z.string().min(1).max(100),
        featured: z.boolean().optional(),
        reason: z.string().min(1).max(200).optional(),
      })
    )
    .min(1)
    .max(30),
});

export type OrganizeResult = z.infer<typeof OrganizeResultSchema>;

export type OrganizeResultEnriched = {
  intro?: string;
  items: Array<
    OrganizeResult['items'][number] & {
      title?: string;
      source_url?: string | null;
      original_score?: number | null;
      summary_score?: number | null;
    }
  >;
};

export async function organizeWeekly(request: OrganizeRequest): Promise<OrganizeResultEnriched> {
  const parsed = OrganizeRequestSchema.parse(request);
  const issue = await prisma.weekly_issues.findUnique({
    where: { id: parsed.weeklyIssueId },
    select: {
      id: true,
      title: true,
      start_date: true,
      end_date: true,
    },
  });

  if (!issue) throw new Error('周刊不存在');

  const rangeStart = new Date(issue.start_date);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEndExclusive = new Date(issue.end_date);
  rangeEndExclusive.setUTCHours(0, 0, 0, 0);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const existingItems = await prisma.weekly_content_items.findMany({
    where: { weekly_issue_id: issue.id },
    select: { content_id: true },
  });
  const existingSet = new Set(existingItems.map((i) => i.content_id.toString()));

  const candidates = await prisma.contents.findMany({
    where: {
      content_type_id: 3,
      status: 'draft',
      created_at: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
      weekly_content_items: { none: {} },
      id: { notIn: existingItems.map((i) => i.content_id) },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      source: true,
      source_url: true,
      category_id: true,
      original_score: true,
      summary_score: true,
      created_at: true,
    },
    orderBy: [{ created_at: 'asc' }],
    take: 200,
  });

  const scored = candidates
    .filter((c) => !existingSet.has(c.id.toString()))
    .map((c) => ({
      id: Number(c.id),
      title: c.title,
      summary: c.summary,
      source: c.source,
      source_url: c.source_url,
      original_score: c.original_score,
      summary_score: c.summary_score,
      created_at: c.created_at?.toISOString(),
      score: (c.original_score ?? 0) + (c.summary_score ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  if (scored.length === 0) {
    throw new Error('没有可用的候选内容（请先创建/同步内容，或清空周刊关联）');
  }

  const template = (await AiPromptService.getByScene('weekly_organize')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: issue.title,
    start_date: issue.start_date.toISOString().slice(0, 10),
    end_date: issue.end_date.toISOString().slice(0, 10),
    max_items: parsed.maxItems,
    candidates: JSON.stringify(scored),
  });

  const result = await serverGenerateJSON<unknown>({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1200,
    temperature: 0.3,
  });

  const parsedResult = OrganizeResultSchema.safeParse(result);
  if (!parsedResult.success) {
    throw new Error('AI 返回不符合预期的周刊组织结构');
  }

  const byId = new Map(scored.map((c) => [c.id, c]));
  const missingIds = parsedResult.data.items
    .map((item) => item.content_id)
    .filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    throw new Error(`AI 返回了不存在的 content_id: ${missingIds.join(', ')}`);
  }

  const items = parsedResult.data.items
    .map((item) => {
      const candidate = byId.get(item.content_id);
      return {
        ...item,
        title: candidate?.title,
        source_url: candidate?.source_url ?? null,
        original_score: candidate?.original_score ?? null,
        summary_score: candidate?.summary_score ?? null,
      };
    })
    .sort((a, b) => {
      const aCreatedAt = byId.get(a.content_id)?.created_at ?? '';
      const bCreatedAt = byId.get(b.content_id)?.created_at ?? '';
      return aCreatedAt.localeCompare(bCreatedAt);
    });

  return {
    intro: parsedResult.data.intro,
    items,
  };
}
