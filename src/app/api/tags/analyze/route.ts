import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateTagSimilarity } from '@/lib/utils/string-similarity';

export interface SimilarTagGroup {
  tags: Array<{
    id: number;
    name: string;
    count: number;
    aliases: string[];
  }>;
  similarity: number;
  suggestedPrimary: number; // 建议保留的主标签 ID
  reason: string;
}

export interface TagAnalysisResult {
  totalTags: number;
  unusedTags: Array<{ id: number; name: string }>;
  similarGroups: SimilarTagGroup[];
  lowUsageTags: Array<{ id: number; name: string; count: number }>;
}

// 辅助函数：安全解析 aliases
function parseAliases(aliases: unknown): string[] {
  if (Array.isArray(aliases)) {
    return aliases.filter((a): a is string => typeof a === 'string');
  }
  if (typeof aliases === 'string') {
    try {
      const parsed = JSON.parse(aliases);
      if (Array.isArray(parsed)) {
        return parsed.filter((a): a is string => typeof a === 'string');
      }
    } catch {
      // 不是有效 JSON，返回空数组
    }
  }
  return [];
}

// GET /api/tags/analyze - 分析标签健康度
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取所有标签
    const tags = await prisma.tags.findMany({
      select: {
        id: true,
        name: true,
        count: true,
        aliases: true,
      },
      orderBy: { name: 'asc' },
    });

    const totalTags = tags.length;

    // 未使用的标签（count = 0 或 null）
    const unusedTags = tags
      .filter((t) => !t.count || t.count === 0)
      .map((t) => ({ id: t.id, name: t.name }));

    // 低使用率标签（count <= 2）
    const lowUsageTags = tags
      .filter((t) => t.count && t.count > 0 && t.count <= 2)
      .map((t) => ({ id: t.id, name: t.name, count: t.count! }))
      .sort((a, b) => a.count - b.count);

    // 查找相似标签组
    const similarGroups: SimilarTagGroup[] = [];
    const processedIds = new Set<number>();

    for (const tag of tags) {
      if (processedIds.has(tag.id)) continue;

      // 查找与当前标签相似的其他标签
      const similarTags = tags.filter((other) => {
        if (other.id === tag.id || processedIds.has(other.id)) return false;
        const result = calculateTagSimilarity(tag.name, other.name, parseAliases(other.aliases));
        return result.similarity >= 0.7; // 70% 相似度阈值
      });

      if (similarTags.length > 0) {
        const group = [tag, ...similarTags];

        // 标记为已处理
        group.forEach((t) => processedIds.add(t.id));

        // 计算组内平均相似度
        let totalSimilarity = 0;
        let comparisons = 0;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const result = calculateTagSimilarity(
              group[i].name,
              group[j].name,
              parseAliases(group[j].aliases)
            );
            totalSimilarity += result.similarity;
            comparisons++;
          }
        }
        const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

        // 选择建议保留的主标签（使用次数最多的）
        const sortedByCount = [...group].sort(
          (a, b) => (b.count || 0) - (a.count || 0)
        );
        const suggestedPrimary = sortedByCount[0];

        // 生成合并理由
        const otherNames = group
          .filter((t) => t.id !== suggestedPrimary.id)
          .map((t) => t.name)
          .join('、');
        const reason = `"${otherNames}" 与 "${suggestedPrimary.name}" 相似，建议合并`;

        similarGroups.push({
          tags: group.map((t) => ({
            id: t.id,
            name: t.name,
            count: t.count || 0,
            aliases: parseAliases(t.aliases),
          })),
          similarity: avgSimilarity,
          suggestedPrimary: suggestedPrimary.id,
          reason,
        });
      }
    }

    // 按相似度排序
    similarGroups.sort((a, b) => b.similarity - a.similarity);

    const result: TagAnalysisResult = {
      totalTags,
      unusedTags,
      similarGroups,
      lowUsageTags,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('标签分析失败:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '标签分析失败' }, { status: 500 });
  }
}
