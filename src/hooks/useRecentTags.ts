'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'weekly-admin-recent-tags';
const MAX_RECENT_TAGS = 20;

export interface RecentTag {
  id: number;
  name: string;
  usedAt: number; // timestamp
}

/**
 * 管理最近使用的标签
 * 数据存储在 localStorage 中
 */
export function useRecentTags() {
  const [recentTags, setRecentTags] = useState<RecentTag[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentTag[];
        // 按使用时间降序排序
        const sorted = parsed.sort((a, b) => b.usedAt - a.usedAt);
        setRecentTags(sorted);
      }
    } catch {
      // 忽略解析错误
    }
    setIsLoaded(true);
  }, []);

  // 保存到 localStorage
  const saveToStorage = useCallback((tags: RecentTag[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    } catch {
      // 忽略存储错误
    }
  }, []);

  // 添加或更新最近使用的标签
  const addRecentTag = useCallback(
    (tag: { id: number; name: string }) => {
      setRecentTags((prev) => {
        // 移除已存在的相同标签
        const filtered = prev.filter((t) => t.id !== tag.id);

        // 添加到开头
        const newTag: RecentTag = {
          id: tag.id,
          name: tag.name,
          usedAt: Date.now(),
        };

        const updated = [newTag, ...filtered].slice(0, MAX_RECENT_TAGS);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // 批量添加标签
  const addRecentTags = useCallback(
    (tags: Array<{ id: number; name: string }>) => {
      if (tags.length === 0) return;

      setRecentTags((prev) => {
        const now = Date.now();
        const tagIds = new Set(tags.map((t) => t.id));

        // 移除已存在的标签
        const filtered = prev.filter((t) => !tagIds.has(t.id));

        // 添加新标签
        const newTags: RecentTag[] = tags.map((tag, index) => ({
          id: tag.id,
          name: tag.name,
          usedAt: now - index, // 保持顺序
        }));

        const updated = [...newTags, ...filtered].slice(0, MAX_RECENT_TAGS);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // 移除标签
  const removeRecentTag = useCallback(
    (tagId: number) => {
      setRecentTags((prev) => {
        const updated = prev.filter((t) => t.id !== tagId);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // 清空所有
  const clearRecentTags = useCallback(() => {
    setRecentTags([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略错误
    }
  }, []);

  // 获取最近 N 个标签
  const getRecentTags = useCallback(
    (limit: number = 10) => {
      return recentTags.slice(0, limit);
    },
    [recentTags]
  );

  return {
    recentTags,
    isLoaded,
    addRecentTag,
    addRecentTags,
    removeRecentTag,
    clearRecentTags,
    getRecentTags,
  };
}
