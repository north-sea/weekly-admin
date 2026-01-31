import 'server-only';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

// 推荐结果 schema
const TagRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      tag_name: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

export type TagRecommendation = {
  tagId: number | null; // null 表示建议创建新标签
  tagName: string;
  confidence: number;
  reason: string;
  isNew: boolean;
};

export type TagRecommendationResult = {
  recommendations: TagRecommendation[];
  existingTagIds: number[];
};

// 默认 prompt 模板（如果数据库中没有配置）
const DEFAULT_TAG_RECOMMEND_PROMPT = `你是一个内容标签推荐助手。根据以下内容，推荐最合适的标签。

## 内容信息
标题：{{title}}
{{#summary}}
摘要：{{summary}}
{{/summary}}
{{#content}}
正文：{{content}}
{{/content}}

## 现有标签库
{{existing_tags}}

## 要求
1. 优先从现有标签库中选择匹配的标签
2. 如果现有标签不足以描述内容，可以建议新标签
3. 推荐 3-8 个最相关的标签
4. 每个标签给出置信度（0-1）和推荐理由
5. 标签应该具体、有意义，避免过于宽泛

## 输出格式
返回 JSON 格式：
{
  "recommendations": [
    {
      "tag_name": "标签名称",
      "confidence": 0.95,
      "reason": "推荐理由"
    }
  ]
}`;

const truncate = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[truncated ${value.length - maxChars} chars]`;
};

/**
 * 获取现有标签列表（用于 prompt）
 */
async function getExistingTagsForPrompt(): Promise<string> {
  // 获取所有标签
  const tags = await prisma.tags.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      group_id: true,
    },
    orderBy: { name: 'asc' },
  });

  // 获取所有标签组
  const groups = await prisma.tag_groups.findMany({
    select: { id: true, name: true },
  });
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  // 按组分类
  const grouped = new Map<string, string[]>();
  for (const tag of tags) {
    const groupName = tag.group_id ? (groupMap.get(tag.group_id) || '未分组') : '未分组';
    if (!grouped.has(groupName)) {
      grouped.set(groupName, []);
    }
    let tagStr = tag.name;
    const aliases = tag.aliases as string[] | null;
    if (aliases && aliases.length > 0) {
      tagStr += ` (别名: ${aliases.join(', ')})`;
    }
    grouped.get(groupName)!.push(tagStr);
  }

  // 格式化输出
  const lines: string[] = [];
  for (const [group, tagNames] of grouped) {
    lines.push(`【${group}】`);
    lines.push(tagNames.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 根据标签名查找匹配的标签 ID
 */
async function findTagByName(name: string): Promise<number | null> {
  const normalizedName = name.toLowerCase().trim();

  // 精确匹配（使用 raw query 或简单比较）
  const allTags = await prisma.tags.findMany({
    select: { id: true, name: true, aliases: true },
  });

  // 精确匹配名称
  for (const tag of allTags) {
    if (tag.name.toLowerCase().trim() === normalizedName) {
      return tag.id;
    }
  }

  // 别名匹配
  for (const tag of allTags) {
    const aliases = tag.aliases as string[] | null;
    if (aliases) {
      for (const alias of aliases) {
        if (alias.toLowerCase().trim() === normalizedName) {
          return tag.id;
        }
      }
    }
  }

  return null;
}

/**
 * 为内容推荐标签
 */
export async function recommendTags(
  title: string,
  summary?: string | null,
  content?: string | null,
  existingTagIds?: number[]
): Promise<TagRecommendationResult> {
  // 获取 prompt 模板
  let template: string;
  try {
    const promptConfig = await AiPromptService.getByScene('tag_recommend');
    template = promptConfig.prompt;
  } catch {
    template = DEFAULT_TAG_RECOMMEND_PROMPT;
  }

  // 获取现有标签列表
  const existingTagsStr = await getExistingTagsForPrompt();

  // 渲染 prompt
  const prompt = renderPromptTemplate(template, {
    title: title || '无标题',
    summary: summary ? truncate(summary, 1000) : null,
    content: content ? truncate(content, 3000) : null,
    existing_tags: existingTagsStr,
  });

  // 调用 AI
  const result = await serverGenerateJSON<unknown>({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1000,
    temperature: 0.3,
  });

  const parsed = TagRecommendationSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error('AI 返回不符合预期的推荐结构');
  }

  // 处理推荐结果
  const recommendations: TagRecommendation[] = [];
  const matchedTagIds: number[] = [];

  for (const rec of parsed.data.recommendations) {
    const tagId = await findTagByName(rec.tag_name);
    const isNew = tagId === null;

    // 跳过已存在于内容中的标签
    if (tagId !== null && existingTagIds?.includes(tagId)) {
      continue;
    }

    if (tagId !== null) {
      matchedTagIds.push(tagId);
    }

    recommendations.push({
      tagId,
      tagName: rec.tag_name,
      confidence: rec.confidence,
      reason: rec.reason,
      isNew,
    });
  }

  // 按置信度排序
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations,
    existingTagIds: matchedTagIds,
  };
}
