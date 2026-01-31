import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  findSimilarTags,
  calculateTagSimilarity,
  SimilarityMatchType,
} from '@/lib/utils/string-similarity';
import { serverGenerateJSON } from '@/lib/ai/server/client';

// 请求参数 schema
const DetectSimilarSchema = z.object({
  name: z.string().min(1).max(100),
  threshold: z.number().min(0).max(1).default(0.7),
  exclude_id: z.number().int().positive().optional(),
  use_ai: z.boolean().default(false),
  limit: z.number().int().positive().max(20).default(10),
});

// AI 语义相似度响应 schema
const AiSimilaritySchema = z.object({
  similar_tags: z.array(
    z.object({
      name: z.string(),
      similarity: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

interface TagForComparison {
  id: number;
  name: string;
  slug: string;
  aliases: string[];
  count: number;
  group_id: number | null;
  group?: {
    id: number;
    name: string;
    color: string | null;
  } | null;
}

interface SimilarTagResult {
  tag: TagForComparison;
  similarity: number;
  matchType: SimilarityMatchType;
  aiReason?: string;
}

/**
 * 使用 AI 进行语义相似度检测
 */
async function detectSemanticSimilarity(
  name: string,
  candidates: TagForComparison[]
): Promise<Map<number, { similarity: number; reason: string }>> {
  if (candidates.length === 0) {
    return new Map();
  }

  const candidateNames = candidates.map((t) => t.name).join(', ');

  const prompt = `你是一个标签相似度分析专家。请分析以下新标签与已有标签的语义相似度。

新标签: "${name}"

已有标签列表: ${candidateNames}

请判断哪些已有标签与新标签在语义上相似（指代相同或相近的概念）。

返回 JSON 格式:
{
  "similar_tags": [
    {
      "name": "已有标签名",
      "similarity": 0.0-1.0 的相似度分数,
      "reason": "相似原因简述"
    }
  ]
}

只返回相似度 >= 0.7 的标签。如果没有相似标签，返回空数组。`;

  try {
    const result = await serverGenerateJSON<unknown>({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0,
    });

    const parsed = AiSimilaritySchema.safeParse(result);
    if (!parsed.success) {
      return new Map();
    }

    const resultMap = new Map<number, { similarity: number; reason: string }>();
    for (const item of parsed.data.similar_tags) {
      const tag = candidates.find(
        (t) => t.name.toLowerCase() === item.name.toLowerCase()
      );
      if (tag) {
        resultMap.set(tag.id, {
          similarity: item.similarity,
          reason: item.reason,
        });
      }
    }

    return resultMap;
  } catch {
    // AI 调用失败时返回空结果，不影响基础检测
    return new Map();
  }
}

/**
 * POST /api/tags/detect-similar
 * 检测与给定名称相似的标签
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = DetectSimilarSchema.parse(body);

    // 获取所有标签用于比较
    const allTags = await prisma.tags.findMany({
      where: params.exclude_id ? { id: { not: params.exclude_id } } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        aliases: true,
        count: true,
        group_id: true,
        group: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // 转换为比较格式
    const tagsForComparison: TagForComparison[] = allTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      aliases: tag.aliases ? JSON.parse(tag.aliases) : [],
      count: tag.count ?? 0,
      group_id: tag.group_id,
      group: tag.group,
    }));

    // 使用 Levenshtein 算法进行基础相似度检测
    const fuzzyResults = findSimilarTags(
      params.name,
      tagsForComparison,
      params.threshold
    );

    // 构建结果
    const results: SimilarTagResult[] = fuzzyResults.map((r) => ({
      tag: r.tag,
      similarity: r.similarity,
      matchType: r.matchType,
    }));

    // 如果启用 AI 检测，对模糊匹配结果进行语义增强
    if (params.use_ai && results.length > 0) {
      // 只对模糊匹配的结果进行 AI 语义分析
      const fuzzyMatches = results.filter((r) => r.matchType === 'fuzzy');
      if (fuzzyMatches.length > 0) {
        const aiResults = await detectSemanticSimilarity(
          params.name,
          fuzzyMatches.map((r) => r.tag)
        );

        // 更新结果中的 AI 信息
        for (const result of results) {
          const aiResult = aiResults.get(result.tag.id);
          if (aiResult) {
            // AI 确认语义相似，提升匹配类型
            result.matchType = 'semantic';
            result.similarity = Math.max(result.similarity, aiResult.similarity);
            result.aiReason = aiResult.reason;
          }
        }
      }
    }

    // 如果没有模糊匹配结果但启用了 AI，尝试对所有标签进行语义检测
    if (params.use_ai && results.length === 0 && tagsForComparison.length > 0) {
      // 限制 AI 检测的标签数量
      const limitedTags = tagsForComparison.slice(0, 50);
      const aiResults = await detectSemanticSimilarity(params.name, limitedTags);

      for (const [tagId, aiResult] of aiResults) {
        const tag = tagsForComparison.find((t) => t.id === tagId);
        if (tag && aiResult.similarity >= params.threshold) {
          results.push({
            tag,
            similarity: aiResult.similarity,
            matchType: 'semantic',
            aiReason: aiResult.reason,
          });
        }
      }
    }

    // 按相似度排序并限制数量
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, params.limit);

    return NextResponse.json({
      query: params.name,
      threshold: params.threshold,
      total: sortedResults.length,
      similar_tags: sortedResults.map((r) => ({
        id: r.tag.id,
        name: r.tag.name,
        slug: r.tag.slug,
        aliases: r.tag.aliases,
        count: r.tag.count,
        group: r.tag.group,
        similarity: Math.round(r.similarity * 100) / 100,
        match_type: r.matchType,
        ai_reason: r.aiReason,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      );
    }

    console.error('检测相似标签失败:', error);
    return NextResponse.json(
      { error: '检测相似标签失败' },
      { status: 500 }
    );
  }
}
