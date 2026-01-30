import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

const ScoreSchema = z.object({
  overall: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  accuracy: z.number().min(0).max(10),
  conciseness: z.number().min(0).max(10),
  reasons: z.array(z.string().min(1)).min(1).max(8),
});

export type InboxScore = z.infer<typeof ScoreSchema>;

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

/**
 * 对 inbox item 的摘要进行 AI 评分
 *
 * 特殊规则:
 * - 无摘要或 Karakeep 爬取失败 (summarization_status !== 'success') → 评分 = 0
 * - AI 返回 0-10 分，存储时乘以 10 转为 0-100
 *
 * @returns InboxScore 或 null（如果无法评分）
 */
export async function scoreInboxItem(inboxId: bigint): Promise<InboxScore | null> {
  const item = await prisma.inbox_items.findUnique({
    where: { id: inboxId },
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      summarization_status: true,
      data_source: {
        select: { type: true },
      },
    },
  });

  if (!item) {
    throw new Error('收件箱条目不存在');
  }

  // Karakeep 爬取失败，直接返回 0 分
  const isKarakeep = item.data_source?.type === 'karakeep';
  if (isKarakeep && item.summarization_status && item.summarization_status !== 'success') {
    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: { ai_score: 0 },
    });
    return null;
  }

  // 无摘要，直接返回 0 分
  if (!item.summary || !item.summary.trim()) {
    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: { ai_score: 0 },
    });
    return null;
  }

  // 使用 summary_score prompt 进行评分
  const template = (await AiPromptService.getByScene('summary_score')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: item.title || '无标题',
    summary: truncate(item.summary, 2000),
    content: truncate(item.content ?? '', 8000),
  });

  const result = await serverGenerateJSON<unknown>({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 800,
    temperature: 0.2,
  });

  const parsed = ScoreSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('AI 返回不符合预期的评分结构');
  }

  const score = parsed.data;

  // 存储评分（0-10 转为 0-100）
  await prisma.inbox_items.update({
    where: { id: inboxId },
    data: { ai_score: score.overall * 10 },
  });

  return score;
}

export type BatchScoreResult = {
  scored: number;
  failed: number;
  skipped: number;
  errors: string[];
};

/**
 * 批量评分未评分的 inbox items
 *
 * @param limit 最大处理数量，默认 50
 * @param delayMs 每次评分后的延迟（毫秒），默认 500
 */
export async function batchScoreInboxItems(
  limit: number = 50,
  delayMs: number = 500
): Promise<BatchScoreResult> {
  const items = await prisma.inbox_items.findMany({
    where: {
      ai_score: null,
      status: 'pending',
    },
    select: { id: true, title: true },
    orderBy: { created_at: 'asc' },
    take: limit,
  });

  const result: BatchScoreResult = {
    scored: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const score = await scoreInboxItem(item.id);
      if (score) {
        result.scored += 1;
      } else {
        result.skipped += 1;
      }

      // 延迟以避免 API 限流
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`[${item.id}] ${item.title}: ${message}`);

      // 出错时也延迟
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return result;
}
