import 'server-only';

import { prisma } from '@/lib/db';
import { serverGenerateText } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

const normalizeSummary = (value: string) =>
  value
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/```[\s\S]*?```/g, '')
    .trim();

export async function generateSummary(contentId: number): Promise<string> {
  const content = await prisma.contents.findUnique({
    where: { id: BigInt(contentId) },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      summary: true,
      ai_metadata: true,
      source_url: true,
    },
  });

  if (!content) throw new Error('内容不存在');

  const template = (await AiPromptService.getByScene('summary_generate')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: content.title,
    source_url: content.source_url,
    description: content.description,
    content: truncate(content.content ?? '', 12000),
  });

  const text = await serverGenerateText({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 600,
    temperature: 0.3,
  });

  const summary = normalizeSummary(text);
  if (!summary) throw new Error('未生成有效摘要');

  const previousMetadata = content.ai_metadata;
  const mergedMetadata =
    previousMetadata && typeof previousMetadata === 'object' && !Array.isArray(previousMetadata)
      ? {
          ...(previousMetadata as Record<string, unknown>),
          summary_generation: {
            ...(((previousMetadata as any).summary_generation ?? {}) as Record<string, unknown>),
            generated_at: new Date().toISOString(),
          },
        }
      : {
          summary_generation: {
            generated_at: new Date().toISOString(),
          },
        };

  await prisma.contents.update({
    where: { id: content.id },
    data: {
      summary,
      ai_metadata: mergedMetadata as any,
    },
  });

  return summary;
}

export async function optimizeSummary(contentId: number): Promise<string> {
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

  if (!content) throw new Error('内容不存在');
  if (!content.summary || !content.summary.trim()) throw new Error('该内容没有摘要，无法优化');

  const template = (await AiPromptService.getByScene('summary_optimize')).prompt;
  const prompt = renderPromptTemplate(template, {
    title: content.title,
    summary: truncate(content.summary, 2000),
    content: truncate(content.content ?? '', 8000),
  });

  const text = await serverGenerateText({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 600,
    temperature: 0.2,
  });

  const summary = normalizeSummary(text);
  if (!summary) throw new Error('未生成有效摘要');

  const previousMetadata = content.ai_metadata;
  const mergedMetadata =
    previousMetadata && typeof previousMetadata === 'object' && !Array.isArray(previousMetadata)
      ? {
          ...(previousMetadata as Record<string, unknown>),
          summary_generation: {
            ...(((previousMetadata as any).summary_generation ?? {}) as Record<string, unknown>),
            optimized_at: new Date().toISOString(),
          },
        }
      : {
          summary_generation: {
            optimized_at: new Date().toISOString(),
          },
        };

  await prisma.contents.update({
    where: { id: content.id },
    data: {
      summary,
      ai_metadata: mergedMetadata as any,
    },
  });

  return summary;
}
