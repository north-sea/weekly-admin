import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateTagSimilarity } from '@/lib/utils/string-similarity';

// 健康度指标
export interface HealthMetrics {
  totalTags: number;
  unusedCount: number;
  unusedPercentage: number;
  lowUsageCount: number;
  lowUsagePercentage: number;
  similarGroupsCount: number;
  duplicateRisk: number; // 0-100
  overallScore: number; // 0-100
}

// 健康度报告
export interface TagHealthReport {
  metrics: HealthMetrics;
  unusedTags: Array<{ id: number; name: string; createdAt: Date | null }>;
  lowUsageTags: Array<{ id: number; name: string; count: number }>;
  similarGroups: Array<{
    tags: Array<{ id: number; name: string; count: number }>;
    similarity: number;
  }>;
  recommendations: string[];
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
      // 不是有效 JSON
    }
  }
  return [];
}

// GET /api/tags/health-report - 获取标签健康度报告
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
        aliases: true,
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    const counts = await prisma.content_tags.groupBy({
      by: ['tag_id'],
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.tag_id, row._count._all]));
    const tagsWithCount = tags.map((tag) => ({
      ...tag,
      count: countMap.get(tag.id) ?? 0,
    }));

    const totalTags = tagsWithCount.length;

    // 未使用的标签
    const unusedTags = tagsWithCount
      .filter((t) => t.count === 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
      }));

    // 低使用率标签（count <= 2）
    const lowUsageTags = tagsWithCount
      .filter((t) => t.count > 0 && t.count <= 2)
      .map((t) => ({
        id: t.id,
        name: t.name,
        count: t.count,
      }))
      .sort((a, b) => a.count - b.count);

    // 查找相似标签组
    const similarGroups: Array<{
      tags: Array<{ id: number; name: string; count: number }>;
      similarity: number;
    }> = [];
    const processedIds = new Set<number>();

    for (const tag of tagsWithCount) {
      if (processedIds.has(tag.id)) continue;

      const similarTags = tagsWithCount.filter((other) => {
        if (other.id === tag.id || processedIds.has(other.id)) return false;
        const result = calculateTagSimilarity(
          tag.name,
          other.name,
          parseAliases(other.aliases)
        );
        return result.similarity >= 0.7;
      });

      if (similarTags.length > 0) {
        const group = [tag, ...similarTags];
        group.forEach((t) => processedIds.add(t.id));

        // 计算平均相似度
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

        similarGroups.push({
          tags: group.map((t) => ({
            id: t.id,
            name: t.name,
            count: t.count || 0,
          })),
          similarity: comparisons > 0 ? totalSimilarity / comparisons : 0,
        });
      }
    }

    // 计算健康度指标
    const unusedPercentage = totalTags > 0 ? (unusedTags.length / totalTags) * 100 : 0;
    const lowUsagePercentage = totalTags > 0 ? (lowUsageTags.length / totalTags) * 100 : 0;
    const duplicateRisk = totalTags > 0
      ? Math.min(100, (similarGroups.length / totalTags) * 200)
      : 0;

    // 计算总体健康分数 (0-100)
    // 未使用标签占比扣分（最多扣 30 分）
    const unusedPenalty = Math.min(30, unusedPercentage * 3);
    // 低使用率标签占比扣分（最多扣 20 分）
    const lowUsagePenalty = Math.min(20, lowUsagePercentage * 2);
    // 相似标签组扣分（最多扣 30 分）
    const duplicatePenalty = Math.min(30, duplicateRisk * 0.3);
    // 标签总数过少扣分（少于 10 个扣分）
    const sizePenalty = totalTags < 10 ? (10 - totalTags) * 2 : 0;

    const overallScore = Math.max(
      0,
      100 - unusedPenalty - lowUsagePenalty - duplicatePenalty - sizePenalty
    );

    // 生成建议
    const recommendations: string[] = [];

    if (unusedTags.length > 0) {
      recommendations.push(
        `有 ${unusedTags.length} 个未使用的标签，建议清理或合并`
      );
    }

    if (similarGroups.length > 0) {
      recommendations.push(
        `检测到 ${similarGroups.length} 组相似标签，建议合并以减少重复`
      );
    }

    if (lowUsageTags.length > totalTags * 0.3) {
      recommendations.push(
        '超过 30% 的标签使用率较低，建议审查标签体系是否过于细分'
      );
    }

    if (overallScore >= 80) {
      recommendations.push('标签库整体健康状况良好，继续保持！');
    } else if (overallScore >= 60) {
      recommendations.push('标签库健康状况一般，建议进行适当清理');
    } else {
      recommendations.push('标签库需要整理，建议尽快进行清理和合并');
    }

    const metrics: HealthMetrics = {
      totalTags,
      unusedCount: unusedTags.length,
      unusedPercentage: Math.round(unusedPercentage * 10) / 10,
      lowUsageCount: lowUsageTags.length,
      lowUsagePercentage: Math.round(lowUsagePercentage * 10) / 10,
      similarGroupsCount: similarGroups.length,
      duplicateRisk: Math.round(duplicateRisk),
      overallScore: Math.round(overallScore),
    };

    const report: TagHealthReport = {
      metrics,
      unusedTags: unusedTags.slice(0, 20), // 限制返回数量
      lowUsageTags: lowUsageTags.slice(0, 20),
      similarGroups: similarGroups.slice(0, 10),
      recommendations,
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('获取健康度报告失败:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '获取健康度报告失败' }, { status: 500 });
  }
}
