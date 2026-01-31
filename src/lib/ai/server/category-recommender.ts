import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

// 推荐结果 schema
const CategoryRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      category_name: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

export type CategoryRecommendation = {
  categoryId: number | null;
  categoryName: string;
  categoryPath: string;
  confidence: number;
  reason: string;
};

export type CategoryRecommendationResult = {
  recommendations: CategoryRecommendation[];
};

// 默认 prompt 模板（如果数据库中没有配置）
const DEFAULT_CATEGORY_RECOMMEND_PROMPT = `你是一个内容分类推荐助手。根据以下内容，推荐最合适的分类。

## 内容信息
标题：{{title}}
{{#summary}}
摘要：{{summary}}
{{/summary}}
{{#content}}
正文：{{content}}
{{/content}}

## 现有分类
{{existing_categories}}

## 要求
1. 从现有分类中选择最匹配的分类
2. 只推荐 1-3 个最相关的分类
3. 每个分类给出置信度（0-1）和推荐理由
4. 优先推荐叶子节点分类

## 输出格式
返回 JSON 格式：
{
  "recommendations": [
    {
      "category_name": "分类名称",
      "confidence": 0.95,
      "reason": "推荐理由"
    }
  ]
}`;

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

interface CategoryWithPath {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
}

/**
 * 构建分类路径
 */
function buildCategoryPaths(
  categories: Array<{ id: number; name: string; parent_id: number | null }>
): CategoryWithPath[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const getPath = (id: number): string => {
    const parts: string[] = [];
    let current: { id: number; name: string; parent_id: number | null } | undefined =
      categoryMap.get(id);

    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? categoryMap.get(current.parent_id) : undefined;
    }

    return parts.join(' / ');
  };

  return categories.map((c) => ({
    ...c,
    path: getPath(c.id),
  }));
}

/**
 * 获取现有分类列表（用于 prompt）
 */
async function getExistingCategoriesForPrompt(): Promise<{
  text: string;
  categories: CategoryWithPath[];
}> {
  const categories = await prisma.categories.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      parent_id: true,
    },
    orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }],
  });

  const categoriesWithPath = buildCategoryPaths(categories);

  // 格式化输出
  const lines = categoriesWithPath.map((c) => `- ${c.path}`);

  return {
    text: lines.join('\n'),
    categories: categoriesWithPath,
  };
}

/**
 * 根据分类名查找匹配的分类
 */
function findCategoryByName(
  name: string,
  categories: CategoryWithPath[]
): CategoryWithPath | null {
  const normalizedName = name.toLowerCase().trim();

  // 精确匹配名称
  for (const cat of categories) {
    if (cat.name.toLowerCase().trim() === normalizedName) {
      return cat;
    }
  }

  // 路径匹配
  for (const cat of categories) {
    if (cat.path.toLowerCase().trim() === normalizedName) {
      return cat;
    }
    // 路径末尾匹配
    if (cat.path.toLowerCase().trim().endsWith(` / ${normalizedName}`)) {
      return cat;
    }
  }

  return null;
}

/**
 * 为内容推荐分类
 */
export async function recommendCategory(
  title: string,
  summary?: string | null,
  content?: string | null
): Promise<CategoryRecommendationResult> {
  // 获取 prompt 模板
  let template: string;
  try {
    const promptConfig = await AiPromptService.getByScene('category_recommend');
    template = promptConfig.prompt;
  } catch {
    template = DEFAULT_CATEGORY_RECOMMEND_PROMPT;
  }

  // 获取现有分类列表
  const { text: existingCategoriesStr, categories } =
    await getExistingCategoriesForPrompt();

  // 渲染 prompt
  const prompt = renderPromptTemplate(template, {
    title: title || '无标题',
    summary: summary ? truncate(summary, 1000) : null,
    content: content ? truncate(content, 3000) : null,
    existing_categories: existingCategoriesStr,
  });

  // 调用 AI
  const result = await serverGenerateJSON<unknown>({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 500,
    temperature: 0.3,
  });

  const parsed = CategoryRecommendationSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('AI 返回不符合预期的推荐结构');
  }

  // 处理推荐结果
  const recommendations: CategoryRecommendation[] = [];

  for (const rec of parsed.data.recommendations) {
    const category = findCategoryByName(rec.category_name, categories);

    recommendations.push({
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? rec.category_name,
      categoryPath: category?.path ?? rec.category_name,
      confidence: rec.confidence,
      reason: rec.reason,
    });
  }

  // 按置信度排序，过滤掉未找到的分类
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations: recommendations.filter((r) => r.categoryId !== null),
  };
}
