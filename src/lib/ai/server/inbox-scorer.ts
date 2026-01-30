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

// AI 评分明细结构
export type ScoreDetails = {
  ai_quality: number;      // AI 内容质量分 (0-40)
  source_trust: number;    // 来源可信度分 (0-30)
  completeness: number;    // 内容完整度分 (0-20)
  timeliness: number;      // 时效性分 (0-10)
  score_weight: number;    // 数据源加权分
  reasons?: string[];      // AI 评分理由
};

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

/**
 * 计算来源可信度分 (0-30)
 * 基于数据源的历史入选率
 */
async function calculateSourceTrustScore(sourceId: number): Promise<{ score: number; weight: number }> {
  const source = await prisma.data_sources.findUnique({
    where: { id: sourceId },
    select: { sync_count: true, total_synced: true, total_promoted: true, score_weight: true },
  });

  const weight = source?.score_weight ?? 0;

  if (!source) {
    return { score: 15, weight }; // 新源给中等分
  }

  // 优先使用 total_synced/total_promoted，否则使用 sync_count
  const totalSynced = source.total_synced ?? source.sync_count ?? 0;
  const totalPromoted = source.total_promoted ?? 0;

  if (totalSynced === 0) {
    return { score: 15, weight }; // 新源给中等分
  }

  const promotionRate = totalPromoted / totalSynced;

  // 入选率映射到 0-30 分
  // 0% -> 5分, 10% -> 15分, 30%+ -> 30分
  let score: number;
  if (promotionRate >= 0.3) score = 30;
  else if (promotionRate >= 0.2) score = 25;
  else if (promotionRate >= 0.1) score = 20;
  else if (promotionRate >= 0.05) score = 15;
  else score = Math.max(5, Math.round(promotionRate * 200));

  return { score, weight };
}

/**
 * 计算内容完整度分 (0-20)
 * 基于标题、摘要、正文长度
 */
function calculateCompletenessScore(
  title: string | null,
  summary: string | null,
  content: string | null
): number {
  let score = 0;

  // 标题 (0-5分)
  if (title) {
    const titleLen = title.length;
    if (titleLen >= 10 && titleLen <= 100) score += 5;
    else if (titleLen > 0) score += 3;
  }

  // 摘要 (0-8分)
  if (summary) {
    const summaryLen = summary.length;
    if (summaryLen >= 100 && summaryLen <= 500) score += 8;
    else if (summaryLen >= 50) score += 5;
    else if (summaryLen > 0) score += 2;
  }

  // 正文 (0-7分)
  if (content) {
    const contentLen = content.length;
    if (contentLen >= 1000) score += 7;
    else if (contentLen >= 500) score += 5;
    else if (contentLen >= 200) score += 3;
    else if (contentLen > 0) score += 1;
  }

  return score;
}

/**
 * 计算时效性分 (0-10)
 * 基于发布时间距今
 */
function calculateTimelinessScore(publishedAt: Date | null): number {
  if (!publishedAt) return 5; // 无发布时间给中等分

  const now = new Date();
  const diffDays = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

  // 时效性映射
  // 1天内 -> 10分, 3天内 -> 8分, 7天内 -> 6分, 14天内 -> 4分, 30天内 -> 2分, 更久 -> 1分
  if (diffDays <= 1) return 10;
  if (diffDays <= 3) return 8;
  if (diffDays <= 7) return 6;
  if (diffDays <= 14) return 4;
  if (diffDays <= 30) return 2;
  return 1;
}

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
      source_id: true,
      source_published_at: true,
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
    const zeroDetails: ScoreDetails = {
      ai_quality: 0,
      source_trust: 0,
      completeness: 0,
      timeliness: 0,
      score_weight: 0,
      reasons: ['Karakeep 爬取失败'],
    };
    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        ai_score: 0,
        ai_score_details: zeroDetails,
      },
    });
    return null;
  }

  // 无摘要，直接返回 0 分
  if (!item.summary || !item.summary.trim()) {
    const zeroDetails: ScoreDetails = {
      ai_quality: 0,
      source_trust: 0,
      completeness: 0,
      timeliness: 0,
      score_weight: 0,
      reasons: ['无摘要内容'],
    };
    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        ai_score: 0,
        ai_score_details: zeroDetails,
      },
    });
    return null;
  }

  // 计算各维度分数
  const { score: sourceTrust, weight: scoreWeight } = await calculateSourceTrustScore(item.source_id);
  const completeness = calculateCompletenessScore(item.title, item.summary, item.content);
  const timeliness = calculateTimelinessScore(item.source_published_at);

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

  // AI 质量分 (0-10 转为 0-40)
  const aiQuality = Math.round(score.overall * 4);

  // 构建评分明细
  const scoreDetails: ScoreDetails = {
    ai_quality: aiQuality,
    source_trust: sourceTrust,
    completeness: completeness,
    timeliness: timeliness,
    score_weight: scoreWeight,
    reasons: score.reasons,
  };

  // 计算总分 (0-100)，应用数据源加权
  const baseScore = aiQuality + sourceTrust + completeness + timeliness;
  const totalScore = Math.min(100, baseScore + scoreWeight); // 上限 100 分

  // 存储评分和明细
  await prisma.inbox_items.update({
    where: { id: inboxId },
    data: {
      ai_score: totalScore,
      ai_score_details: scoreDetails,
    },
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
