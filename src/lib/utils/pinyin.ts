/**
 * 拼音搜索工具
 * 支持中文拼音首字母和全拼搜索
 */

import { pinyin, match } from 'pinyin-pro';

/**
 * 获取字符串的拼音（全拼，无声调）
 */
export function getPinyin(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).join('');
}

/**
 * 获取字符串的拼音首字母
 */
export function getPinyinInitials(text: string): string {
  return pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
}

/**
 * 检查搜索词是否匹配目标文本
 * 支持：
 * - 原文匹配
 * - 拼音全拼匹配
 * - 拼音首字母匹配
 * - 混合匹配（如 "js框架" 匹配 "JavaScript框架"）
 */
export function matchPinyin(text: string, query: string): boolean {
  if (!text || !query) return false;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // 1. 原文包含匹配
  if (textLower.includes(queryLower)) {
    return true;
  }

  // 2. 使用 pinyin-pro 的 match 函数进行智能匹配
  const matchResult = match(text, query, { continuous: true });
  if (matchResult && matchResult.length > 0) {
    return true;
  }

  // 3. 拼音全拼匹配
  const textPinyin = getPinyin(text).toLowerCase();
  if (textPinyin.includes(queryLower)) {
    return true;
  }

  // 4. 拼音首字母匹配
  const textInitials = getPinyinInitials(text).toLowerCase();
  if (textInitials.includes(queryLower)) {
    return true;
  }

  return false;
}

/**
 * 计算搜索匹配的优先级分数
 * 分数越高，匹配越精确
 */
export function getMatchScore(text: string, query: string): number {
  if (!text || !query) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // 完全匹配
  if (textLower === queryLower) {
    return 100;
  }

  // 前缀匹配
  if (textLower.startsWith(queryLower)) {
    return 90;
  }

  // 原文包含
  if (textLower.includes(queryLower)) {
    return 80;
  }

  // 拼音首字母完全匹配
  const textInitials = getPinyinInitials(text).toLowerCase();
  if (textInitials === queryLower) {
    return 70;
  }

  // 拼音首字母前缀匹配
  if (textInitials.startsWith(queryLower)) {
    return 65;
  }

  // 拼音首字母包含
  if (textInitials.includes(queryLower)) {
    return 60;
  }

  // 拼音全拼完全匹配
  const textPinyin = getPinyin(text).toLowerCase();
  if (textPinyin === queryLower) {
    return 55;
  }

  // 拼音全拼前缀匹配
  if (textPinyin.startsWith(queryLower)) {
    return 50;
  }

  // 拼音全拼包含
  if (textPinyin.includes(queryLower)) {
    return 40;
  }

  // pinyin-pro match 匹配
  const matchResult = match(text, query, { continuous: true });
  if (matchResult && matchResult.length > 0) {
    return 30;
  }

  return 0;
}

export interface SearchableItem {
  name: string;
  aliases?: string[];
}

/**
 * 在列表中搜索匹配项
 * 返回按匹配分数排序的结果
 */
export function searchWithPinyin<T extends SearchableItem>(
  items: T[],
  query: string
): T[] {
  if (!query || query.trim() === '') {
    return items;
  }

  const queryTrimmed = query.trim();

  const scored = items
    .map((item) => {
      // 计算名称匹配分数
      let score = getMatchScore(item.name, queryTrimmed);

      // 如果有别名，也检查别名匹配
      if (item.aliases && item.aliases.length > 0) {
        for (const alias of item.aliases) {
          const aliasScore = getMatchScore(alias, queryTrimmed);
          // 别名匹配分数略低于主名称
          score = Math.max(score, aliasScore * 0.9);
        }
      }

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}

/**
 * 高亮匹配的文本部分
 * 返回带有高亮标记的文本片段数组
 */
export function highlightMatch(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  if (!text || !query) {
    return [{ text, highlight: false }];
  }

  // 使用 pinyin-pro 的 match 获取匹配位置
  const matchResult = match(text, query, { continuous: true });

  if (!matchResult || matchResult.length === 0) {
    // 尝试原文匹配
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const index = textLower.indexOf(queryLower);

    if (index === -1) {
      return [{ text, highlight: false }];
    }

    const result: Array<{ text: string; highlight: boolean }> = [];
    if (index > 0) {
      result.push({ text: text.slice(0, index), highlight: false });
    }
    result.push({ text: text.slice(index, index + query.length), highlight: true });
    if (index + query.length < text.length) {
      result.push({ text: text.slice(index + query.length), highlight: false });
    }
    return result;
  }

  // 根据 match 结果构建高亮片段
  const result: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  for (const idx of matchResult) {
    if (idx > lastIndex) {
      result.push({ text: text.slice(lastIndex, idx), highlight: false });
    }
    result.push({ text: text[idx], highlight: true });
    lastIndex = idx + 1;
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), highlight: false });
  }

  // 合并连续的高亮/非高亮片段
  const merged: Array<{ text: string; highlight: boolean }> = [];
  for (const segment of result) {
    const last = merged[merged.length - 1];
    if (last && last.highlight === segment.highlight) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}
