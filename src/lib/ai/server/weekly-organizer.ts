import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';

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

  const existingItems = await prisma.weekly_content_items.findMany({
    where: { weekly_issue_id: issue.id },
    select: { content_id: true },
  });
  const existingSet = new Set(existingItems.map((i) => i.content_id.toString()));

  const candidates = await prisma.contents.findMany({
    where: {
      content_type_id: 3,
      status: 'draft',
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
    orderBy: [{ updated_at: 'desc' }],
    take: 60,
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
    .slice(0, 30);

  if (scored.length === 0) {
    throw new Error('没有可用的候选内容（请先创建/同步内容，或清空周刊关联）');
  }

  const prompt = [
    '你是技术周刊编辑。请从候选内容中挑选并组织本期周刊的条目。',
    '',
    `周刊标题：${issue.title}`,
    `时间范围：${issue.start_date.toISOString().slice(0, 10)} ~ ${issue.end_date.toISOString().slice(0, 10)}`,
    `目标数量：${parsed.maxItems}`,
    '',
    '要求：',
    '- 选择最值得推荐的条目（优先参考 original_score/summary_score，但也可基于标题/摘要判断）',
    '- 为每条选择一个 section（例如：工具/文章/教程/开源/资源/观点）',
    '- 可标记 1-2 条 featured=true',
    '- reason 用 1 句话解释为何入选（可选）',
    '',
    '候选列表（JSON 数组）：',
    JSON.stringify(scored),
  ].join('\n');

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
  return {
    intro: parsedResult.data.intro,
    items: parsedResult.data.items.map((item) => {
      const candidate = byId.get(item.content_id);
      return {
        ...item,
        title: candidate?.title,
        source_url: candidate?.source_url ?? null,
        original_score: candidate?.original_score ?? null,
        summary_score: candidate?.summary_score ?? null,
      };
    }),
  };
}
