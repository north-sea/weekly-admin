/**
 * 字符串相似度计算工具
 */

/**
 * 计算 Levenshtein 编辑距离
 * @param a 字符串 a
 * @param b 字符串 b
 * @returns 编辑距离
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j] + 1 // 删除
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
}

/**
 * 计算基于 Levenshtein 距离的相似度 (0-1)
 * @param a 字符串 a
 * @param b 字符串 b
 * @returns 相似度 (0-1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

/**
 * 标准化字符串用于比较
 * - 转小写
 * - 移除常见分隔符
 * - 移除版本号后缀
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_.\s]+/g, '') // 移除分隔符
    .replace(/\d+(\.\d+)*$/, '') // 移除末尾版本号
    .replace(/js$/, '') // 移除 js 后缀
    .replace(/ts$/, ''); // 移除 ts 后缀
}

/**
 * 检查两个标签名是否可能是同一个标签的变体
 * @param a 标签名 a
 * @param b 标签名 b
 * @returns 是否可能是变体
 */
export function isPossibleVariant(a: string, b: string): boolean {
  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);

  // 标准化后完全相同
  if (normalizedA === normalizedB) return true;

  // 一个是另一个的子串
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return true;
  }

  return false;
}

export type SimilarityMatchType = 'exact' | 'alias' | 'normalized' | 'fuzzy' | 'semantic';

export interface SimilarityResult {
  similarity: number;
  matchType: SimilarityMatchType;
}

/**
 * 计算两个标签的综合相似度
 * @param name 新标签名
 * @param existingName 已有标签名
 * @param existingAliases 已有标签的别名
 * @returns 相似度结果
 */
export function calculateTagSimilarity(
  name: string,
  existingName: string,
  existingAliases: string[] = []
): SimilarityResult {
  const nameLower = name.toLowerCase();
  const existingLower = existingName.toLowerCase();

  // 1. 精确匹配
  if (nameLower === existingLower) {
    return { similarity: 1, matchType: 'exact' };
  }

  // 2. 别名匹配
  for (const alias of existingAliases) {
    if (nameLower === alias.toLowerCase()) {
      return { similarity: 1, matchType: 'alias' };
    }
  }

  // 3. 标准化匹配
  if (isPossibleVariant(name, existingName)) {
    return { similarity: 0.95, matchType: 'normalized' };
  }

  // 4. 模糊匹配 (Levenshtein)
  const similarity = levenshteinSimilarity(name, existingName);

  return { similarity, matchType: 'fuzzy' };
}

/**
 * 在标签列表中查找相似标签
 * @param name 要检查的标签名
 * @param tags 已有标签列表
 * @param threshold 相似度阈值 (默认 0.7)
 * @returns 相似标签列表
 */
export function findSimilarTags<T extends { name: string; aliases?: string[] }>(
  name: string,
  tags: T[],
  threshold: number = 0.7
): Array<{ tag: T; similarity: number; matchType: SimilarityMatchType }> {
  const results: Array<{ tag: T; similarity: number; matchType: SimilarityMatchType }> = [];

  for (const tag of tags) {
    const result = calculateTagSimilarity(name, tag.name, tag.aliases || []);

    if (result.similarity >= threshold) {
      results.push({
        tag,
        similarity: result.similarity,
        matchType: result.matchType,
      });
    }
  }

  // 按相似度降序排序
  return results.sort((a, b) => b.similarity - a.similarity);
}
