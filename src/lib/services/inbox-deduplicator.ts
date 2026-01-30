import { prisma } from '@/lib/db';

/**
 * 计算两个字符串的 Jaccard 相似度
 * 基于词集合的交集/并集比例
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const tokenize = (s: string): Set<string> => {
    // 中文按字符分词，英文按空格分词
    const tokens = s
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    // 对于中文，额外添加字符级别的 token
    const chars = s.replace(/[^\u4e00-\u9fa5]/g, '').split('');

    return new Set([...tokens, ...chars]);
  };

  const set1 = tokenize(str1);
  const set2 = tokenize(str2);

  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 计算 Levenshtein 距离的相似度
 * 返回 0-1 之间的值，1 表示完全相同
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // 对于长字符串，只比较前 200 个字符以提高性能
  const maxLen = 200;
  const a = s1.slice(0, maxLen);
  const b = s2.slice(0, maxLen);

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * 计算综合相似度分数
 * 结合 Jaccard 和 Levenshtein 两种算法
 */
function calculateSimilarity(title1: string, title2: string): number {
  const jaccard = jaccardSimilarity(title1, title2);
  const levenshtein = levenshteinSimilarity(title1, title2);

  // 加权平均，Jaccard 权重 0.6，Levenshtein 权重 0.4
  return jaccard * 0.6 + levenshtein * 0.4;
}

export type SimilarityResult = {
  itemId: bigint;
  similarItemId: bigint;
  similarityScore: number;
  similarTitle: string;
};

/**
 * 检测单个 inbox item 的相似内容
 *
 * @param inboxId 要检测的 inbox item ID
 * @param threshold 相似度阈值，默认 0.7
 * @returns 相似度结果，如果没有找到相似内容则返回 null
 */
export async function detectSimilarItem(
  inboxId: bigint,
  threshold: number = 0.7
): Promise<SimilarityResult | null> {
  const item = await prisma.inbox_items.findUnique({
    where: { id: inboxId },
    select: {
      id: true,
      title: true,
      created_at: true,
    },
  });

  if (!item || !item.title) {
    return null;
  }

  // 查找最近 30 天内的其他 pending/promoted 状态的条目
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const candidates = await prisma.inbox_items.findMany({
    where: {
      id: { not: inboxId },
      title: { not: null },
      status: { in: ['pending', 'promoted'] },
      created_at: { gte: thirtyDaysAgo },
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { created_at: 'desc' },
    take: 500, // 限制候选数量以提高性能
  });

  let maxSimilarity = 0;
  let mostSimilarItem: { id: bigint; title: string | null } | null = null;

  for (const candidate of candidates) {
    if (!candidate.title) continue;

    const similarity = calculateSimilarity(item.title, candidate.title);

    if (similarity > maxSimilarity && similarity >= threshold) {
      maxSimilarity = similarity;
      mostSimilarItem = candidate;
    }
  }

  if (!mostSimilarItem || !mostSimilarItem.title) {
    return null;
  }

  // 更新数据库
  await prisma.inbox_items.update({
    where: { id: inboxId },
    data: {
      similar_item_id: mostSimilarItem.id,
      similarity_score: maxSimilarity,
    },
  });

  return {
    itemId: inboxId,
    similarItemId: mostSimilarItem.id,
    similarityScore: maxSimilarity,
    similarTitle: mostSimilarItem.title!,
  };
}

export type BatchDeduplicateResult = {
  processed: number;
  similarFound: number;
  errors: string[];
};

/**
 * 批量检测相似内容
 *
 * @param limit 最大处理数量，默认 100
 * @param threshold 相似度阈值，默认 0.7
 */
export async function batchDetectSimilarItems(
  limit: number = 100,
  threshold: number = 0.7
): Promise<BatchDeduplicateResult> {
  // 查找未检测过相似度的 pending 条目
  const items = await prisma.inbox_items.findMany({
    where: {
      status: 'pending',
      similar_item_id: null,
      similarity_score: null,
      title: { not: null },
    },
    select: { id: true, title: true },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  const result: BatchDeduplicateResult = {
    processed: 0,
    similarFound: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const similarResult = await detectSimilarItem(item.id, threshold);
      result.processed += 1;

      if (similarResult) {
        result.similarFound += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`[${item.id}] ${item.title}: ${message}`);
    }
  }

  return result;
}

/**
 * 清除指定条目的相似度标记
 */
export async function clearSimilarityMark(inboxId: bigint): Promise<void> {
  await prisma.inbox_items.update({
    where: { id: inboxId },
    data: {
      similar_item_id: null,
      similarity_score: null,
    },
  });
}
