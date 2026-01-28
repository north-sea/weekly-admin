import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

const ScoreSchema = z.object({
  overall: z.number().min(0).max(10),
  relevance: z.number().min(0).max(10),
  quality: z.number().min(0).max(10),
  practicality: z.number().min(0).max(10),
  reasons: z.array(z.string().min(1)).min(1).max(8),
});

export type ContentScore = z.infer<typeof ScoreSchema>;

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

export async function scoreContentOriginal(contentId: number): Promise<ContentScore> {
  const content = await prisma.contents.findUnique({
    where: { id: BigInt(contentId) },
    select: {
      id: true,
      title: true,
      description: true,
      summary: true,
      content: true,
      source_url: true,
      updated_at: true,
      ai_metadata: true,
    },
  });

  if (!content) {
    throw new Error('内容不存在');
  }

  const template = (await AiPromptService.getByScene('content_score')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: content.title,
    source_url: content.source_url,
    description: content.description,
    summary: content.summary,
    content: truncate(content.content ?? '', 12000),
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

  const previousMetadata = content.ai_metadata;
  const mergedMetadata =
    previousMetadata && typeof previousMetadata === 'object' && !Array.isArray(previousMetadata)
      ? {
          ...(previousMetadata as Record<string, unknown>),
          scoring: {
            ...(((previousMetadata as any).scoring ?? {}) as Record<string, unknown>),
            original: {
              ...score,
              scored_at: new Date().toISOString(),
            },
          },
        }
      : {
          scoring: {
            original: {
              ...score,
              scored_at: new Date().toISOString(),
            },
          },
        };

  await prisma.contents.update({
    where: { id: content.id },
    data: {
      original_score: score.overall,
      ai_metadata: mergedMetadata as any,
    },
  });

  return score;
}
