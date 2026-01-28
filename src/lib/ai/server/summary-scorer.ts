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

export type SummaryScore = z.infer<typeof ScoreSchema>;

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

export async function scoreContentSummary(contentId: number): Promise<SummaryScore> {
  const content = await prisma.contents.findUnique({
    where: { id: BigInt(contentId) },
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      ai_metadata: true,
    },
  });

  if (!content) {
    throw new Error('内容不存在');
  }

  if (!content.summary || !content.summary.trim()) {
    throw new Error('该内容没有摘要，无法评分');
  }

  const template = (await AiPromptService.getByScene('summary_score')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: content.title,
    summary: truncate(content.summary, 2000),
    content: truncate(content.content ?? '', 8000),
  });

  const result = await serverGenerateJSON<unknown>({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 800,
    temperature: 0.2,
  });

  const parsed = ScoreSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('AI 返回不符合预期的摘要评分结构');
  }

  const score = parsed.data;

  const previousMetadata = content.ai_metadata;
  const mergedMetadata =
    previousMetadata && typeof previousMetadata === 'object' && !Array.isArray(previousMetadata)
      ? {
          ...(previousMetadata as Record<string, unknown>),
          scoring: {
            ...(((previousMetadata as any).scoring ?? {}) as Record<string, unknown>),
            summary: {
              ...score,
              scored_at: new Date().toISOString(),
            },
          },
        }
      : {
          scoring: {
            summary: {
              ...score,
              scored_at: new Date().toISOString(),
            },
          },
        };

  await prisma.contents.update({
    where: { id: content.id },
    data: {
      summary_score: score.overall,
      ai_metadata: mergedMetadata as any,
    },
  });

  return score;
}
