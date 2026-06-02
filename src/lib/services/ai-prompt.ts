import 'server-only';

import { prisma } from '@/lib/db';

export type AiPromptScene =
  | 'content_score'
  | 'inbox_scoring'
  | 'summary_generate'
  | 'summary_optimize'
  | 'summary_score'
  | 'weekly_organize'
  | 'weekly_desc'
  | 'weekly_cover'
  | 'tag_recommend'
  | 'category_recommend';

export type AiPromptDefinition = {
  scene: AiPromptScene;
  name: string;
  prompt: string;
  variables: string[];
};

export const DEFAULT_AI_PROMPTS: Record<AiPromptScene, AiPromptDefinition> = {
  content_score: {
    scene: 'content_score',
    name: '内容评分',
    variables: ['title', 'source_url', 'description', 'summary', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请对下面的"原文内容"进行 0-10 分打分，并给出简短理由（中文）。',
      '',
      '评分维度：',
      '- relevance：与技术从业者/开发者相关性',
      '- quality：信息密度、可信度、结构清晰度',
      '- practicality：可实践性、可操作性、可迁移性',
      '- overall：综合评分（0-10，可带 0.5）',
      '',
      '输出 JSON 字段：overall, relevance, quality, practicality, reasons（数组，1-8 条）。',
      '',
      '标题：{{title}}',
      '{{#source_url}}来源：{{source_url}}{{/source_url}}',
      '{{#description}}描述：{{description}}{{/description}}',
      '{{#summary}}摘要：{{summary}}{{/summary}}',
      '',
      '原文内容：',
      '{{content}}',
    ].join('\n'),
  },
  inbox_scoring: {
    scene: 'inbox_scoring',
    name: 'Inbox 评分',
    variables: ['title', 'summary', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请对下面的收件箱条目进行多维度评分。',
      '',
      '评分维度（每项 0-10 分）：',
      '- topic：主题相关性（与技术/开发者社区的相关程度）',
      '- content：内容质量（信息密度、准确性、深度）',
      '- depth：深度（是否有独到见解、深入分析）',
      '- practical：实用性（可操作性、可迁移性）',
      '- innovation：创新性（新颖观点、前沿技术）',
      '- expression：表达质量（结构清晰、易读性）',
      '',
      '同时给出 overall 综合分（0-10）和 reasons（1-8 条简短中文理由）。',
      '',
      '输出严格 JSON：',
      '{ "dimensions": { "topic": N, "content": N, "depth": N, "practical": N, "innovation": N, "expression": N }, "overall": N, "reasons": ["..."] }',
      '',
      '标题：{{title}}',
      '摘要：{{summary}}',
      '',
      '正文：',
      '{{content}}',
    ].join('\n'),
  },
  summary_generate: {
    scene: 'summary_generate',
    name: '摘要生成',
    variables: ['title', 'source_url', 'description', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请为下面内容生成中文摘要。',
      '',
      '要求：',
      '- 100-200 字',
      '- 客观、信息密度高',
      '- 不要使用 Markdown',
      '- 只输出摘要文本，不要加标题或引号',
      '',
      '标题：{{title}}',
      '{{#source_url}}来源：{{source_url}}{{/source_url}}',
      '{{#description}}描述：{{description}}{{/description}}',
      '',
      '原文：',
      '{{content}}',
    ].join('\n'),
  },
  summary_optimize: {
    scene: 'summary_optimize',
    name: '摘要优化',
    variables: ['title', 'summary', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请优化下面的中文摘要。',
      '',
      '要求：',
      '- 仍保持 100-200 字',
      '- 更清晰、更准确、更精炼',
      '- 不要使用 Markdown',
      '- 只输出优化后的摘要文本，不要加标题或引号',
      '',
      '标题：{{title}}',
      '',
      '当前摘要：',
      '{{summary}}',
      '',
      '原文（供参考）：',
      '{{content}}',
    ].join('\n'),
  },
  summary_score: {
    scene: 'summary_score',
    name: '摘要评分',
    variables: ['title', 'summary', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请对下面“摘要”质量进行 0-10 分打分，并给出简短理由（中文）。',
      '',
      '评分维度：',
      '- clarity：表达是否清晰、是否易读',
      '- accuracy：是否忠实于原文要点、是否有臆断',
      '- conciseness：是否精炼、是否有废话',
      '- overall：综合评分（0-10，可带 0.5）',
      '',
      '输出 JSON 字段：overall, clarity, accuracy, conciseness, reasons（数组，1-8 条）。',
      '',
      '标题：{{title}}',
      '',
      '摘要：',
      '{{summary}}',
      '',
      '（供参考）原文内容：',
      '{{content}}',
    ].join('\n'),
  },
  weekly_organize: {
    scene: 'weekly_organize',
    name: '周刊组织',
    variables: ['title', 'start_date', 'end_date', 'max_items', 'candidates'],
    prompt: [
      '你是技术周刊编辑。请从候选内容中挑选并组织本期周刊的条目。',
      '',
      '周刊标题：{{title}}',
      '时间范围：{{start_date}} ~ {{end_date}}',
      '目标数量：{{max_items}}',
      '',
      '要求：',
      '- 选择最值得推荐的条目（优先参考 original_score/summary_score，但也可基于标题/摘要判断）',
      '- 为每条选择一个 section（例如：工具/文章/教程/开源/资源/观点）',
      '- 可标记 1-2 条 featured=true',
      '- reason 用 1 句话解释为何入选（可选）',
      '',
      '候选列表（JSON 数组）：',
      '{{candidates}}',
    ].join('\n'),
  },
  weekly_desc: {
    scene: 'weekly_desc',
    name: '周刊简介',
    variables: ['title', 'date_range', 'contents_summary'],
    prompt: [
      '你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。',
      '',
      '标题：{{title}}',
      '时间：{{date_range}}',
      '收录：{{contents_summary}}',
    ].join('\n'),
  },
  weekly_cover: {
    scene: 'weekly_cover',
    name: '周刊封面',
    variables: ['title', 'contents_summary'],
    prompt:
      'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.',
  },
  tag_recommend: {
    scene: 'tag_recommend',
    name: '标签推荐',
    variables: ['title', 'summary', 'content', 'existing_tags'],
    prompt: [
      '你是一个内容标签推荐助手。根据以下内容，推荐最合适的标签。',
      '',
      '## 内容信息',
      '标题：{{title}}',
      '{{#summary}}',
      '摘要：{{summary}}',
      '{{/summary}}',
      '{{#content}}',
      '正文：{{content}}',
      '{{/content}}',
      '',
      '## 现有标签库',
      '{{existing_tags}}',
      '',
      '## 要求',
      '1. 优先从现有标签库中选择匹配的标签',
      '2. 如果现有标签不足以描述内容，可以建议新标签',
      '3. 推荐 3-8 个最相关的标签',
      '4. 每个标签给出置信度（0-1）和推荐理由',
      '5. 标签应该具体、有意义，避免过于宽泛',
      '',
      '## 输出格式',
      '返回 JSON 格式：',
      '{',
      '  "recommendations": [',
      '    {',
      '      "tag_name": "标签名称",',
      '      "confidence": 0.95,',
      '      "reason": "推荐理由"',
      '    }',
      '  ]',
      '}',
    ].join('\n'),
  },
  category_recommend: {
    scene: 'category_recommend',
    name: '分类推荐',
    variables: ['title', 'summary', 'content', 'existing_categories'],
    prompt: [
      '你是一个内容分类推荐助手。根据以下内容，推荐最合适的分类。',
      '',
      '## 内容信息',
      '标题：{{title}}',
      '{{#summary}}',
      '摘要：{{summary}}',
      '{{/summary}}',
      '{{#content}}',
      '正文：{{content}}',
      '{{/content}}',
      '',
      '## 现有分类',
      '{{existing_categories}}',
      '',
      '## 要求',
      '1. 从现有分类中选择最匹配的分类',
      '2. 只推荐 1-3 个最相关的分类',
      '3. 每个分类给出置信度（0-1）和推荐理由',
      '4. 优先推荐叶子节点分类',
      '',
      '## 输出格式',
      '返回 JSON 格式：',
      '{',
      '  "recommendations": [',
      '    {',
      '      "category_name": "分类名称",',
      '      "confidence": 0.95,',
      '      "reason": "推荐理由"',
      '    }',
      '  ]',
      '}',
    ].join('\n'),
  },
};

export type AiPromptWithMeta = AiPromptDefinition & {
  id?: number;
  created_at?: Date;
  updated_at?: Date;
  is_default: boolean;
};

const DEFAULT_SCENES = Object.keys(DEFAULT_AI_PROMPTS) as AiPromptScene[];

const coerceVariables = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
};

export class AiPromptService {
  static getDefault(scene: AiPromptScene): AiPromptDefinition {
    return DEFAULT_AI_PROMPTS[scene];
  }

  static async listMerged(): Promise<AiPromptWithMeta[]> {
    let stored: any[] = [];
    try {
      stored = await prisma.ai_prompts.findMany();
    } catch {
      stored = [];
    }
    const byScene = new Map<string, any>(stored.map((p) => [p.scene, p]));

    return DEFAULT_SCENES.map((scene) => {
      const record = byScene.get(scene);
      const def = DEFAULT_AI_PROMPTS[scene];

      if (!record) {
        return {
          ...def,
          is_default: true,
        };
      }

      return {
        scene,
        name: record.name || def.name,
        prompt: record.prompt || def.prompt,
        variables: coerceVariables(record.variables, def.variables),
        id: record.id,
        created_at: record.created_at ?? undefined,
        updated_at: record.updated_at ?? undefined,
        is_default: record.prompt === def.prompt,
      };
    });
  }

  static async getByScene(scene: AiPromptScene): Promise<AiPromptWithMeta> {
    let record: any | null = null;
    try {
      record = await prisma.ai_prompts.findUnique({ where: { scene } });
    } catch {
      record = null;
    }
    const def = DEFAULT_AI_PROMPTS[scene];

    if (!record) {
      return { ...def, is_default: true };
    }

    return {
      scene,
      name: record.name || def.name,
      prompt: record.prompt || def.prompt,
      variables: coerceVariables(record.variables, def.variables),
      id: record.id,
      created_at: record.created_at ?? undefined,
      updated_at: record.updated_at ?? undefined,
      is_default: record.prompt === def.prompt,
    };
  }

  static async upsert(scene: AiPromptScene, prompt: string): Promise<AiPromptWithMeta> {
    const def = DEFAULT_AI_PROMPTS[scene];
    const normalized = prompt.trim();
    if (!normalized) throw new Error('Prompt 不能为空');

    const record = await prisma.ai_prompts.upsert({
      where: { scene },
      create: {
        scene,
        name: def.name,
        prompt: normalized,
        variables: def.variables as any,
      },
      update: {
        prompt: normalized,
        name: def.name,
        variables: def.variables as any,
      },
    });

    return {
      scene,
      name: record.name,
      prompt: record.prompt,
      variables: coerceVariables(record.variables, def.variables),
      id: record.id,
      created_at: record.created_at ?? undefined,
      updated_at: record.updated_at ?? undefined,
      is_default: record.prompt === def.prompt,
    };
  }

  static async reset(scene: AiPromptScene): Promise<AiPromptWithMeta> {
    const def = DEFAULT_AI_PROMPTS[scene];

    const record = await prisma.ai_prompts.upsert({
      where: { scene },
      create: {
        scene,
        name: def.name,
        prompt: def.prompt,
        variables: def.variables as any,
      },
      update: {
        name: def.name,
        prompt: def.prompt,
        variables: def.variables as any,
      },
    });

    return {
      ...def,
      id: record.id,
      created_at: record.created_at ?? undefined,
      updated_at: record.updated_at ?? undefined,
      is_default: true,
    };
  }

  static async ensureDefaults(): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const scene of DEFAULT_SCENES) {
        const def = DEFAULT_AI_PROMPTS[scene];
        await tx.ai_prompts.upsert({
          where: { scene },
          create: {
            scene,
            name: def.name,
            prompt: def.prompt,
            variables: def.variables as any,
          },
          update: {},
        });
      }
    });
  }
}
