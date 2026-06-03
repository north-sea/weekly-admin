import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const contentTypes = [
  { name: '文章', slug: 'article', description: '技术文章、博客和教程' },
  { name: '工具', slug: 'tool', description: '开发工具、在线服务和效率工具' },
  { name: '资源', slug: 'resource', description: '资料、书籍、课程和参考资源' },
  { name: '项目', slug: 'project', description: '开源项目、产品和案例' },
];

const categories = [
  { name: '技术', slug: 'tech', description: '技术动态、工程实践和架构设计', sort_order: 10 },
  { name: '工具', slug: 'tools', description: '开发工具、效率工具和在线服务', sort_order: 20 },
  { name: '资源', slug: 'resources', description: '教程、书籍、资料和学习资源', sort_order: 30 },
  { name: '前端', slug: 'frontend', description: '前端框架、浏览器和 UI 工程', sort_order: 40 },
  { name: '后端', slug: 'backend', description: '服务端、数据库、API 和基础设施', sort_order: 50 },
  { name: 'AI', slug: 'ai', description: 'AI 工具、模型、应用和工程实践', sort_order: 60 },
];

const tagGroups = [
  { name: '技术栈', slug: 'tech-stack', description: '语言、框架和平台', color: '#2563eb', sort_order: 10 },
  { name: '内容类型', slug: 'content-type', description: '文章、教程、工具、资源等内容形态', color: '#16a34a', sort_order: 20 },
  { name: '主题', slug: 'topic', description: '工程、产品、AI、设计等主题', color: '#9333ea', sort_order: 30 },
];

const tags = [
  { name: 'JavaScript', slug: 'javascript', groupSlug: 'tech-stack', aliases: ['js', 'ecmascript'] },
  { name: 'TypeScript', slug: 'typescript', groupSlug: 'tech-stack', aliases: ['ts'] },
  { name: 'React', slug: 'react', groupSlug: 'tech-stack', aliases: ['reactjs', 'react.js'] },
  { name: 'Next.js', slug: 'nextjs', groupSlug: 'tech-stack', aliases: ['next', 'next.js'] },
  { name: 'Node.js', slug: 'nodejs', groupSlug: 'tech-stack', aliases: ['node', 'node.js'] },
  { name: 'AI', slug: 'ai', groupSlug: 'topic', aliases: ['artificial-intelligence'] },
  { name: 'LLM', slug: 'llm', groupSlug: 'topic', aliases: ['large-language-model'] },
  { name: '工具', slug: 'tools', groupSlug: 'content-type', aliases: ['tool'] },
  { name: '教程', slug: 'tutorial', groupSlug: 'content-type', aliases: ['guide'] },
  { name: '开源', slug: 'opensource', groupSlug: 'topic', aliases: ['open-source'] },
];

const aiSettings = [
  ['auto_score_on_sync', { enabled: true }],
  ['inbox_promotion_threshold', { value: 70 }],
  ['inbox_scoring_enabled', { value: true }],
  ['inbox_scoring_batch_size', { value: 50 }],
  ['inbox_scoring_processing_timeout_minutes', { value: 10 }],
] as const;

const defaultAiPrompts = [
  {
    scene: 'inbox_scoring',
    name: '内容六维评分',
    variables: {
      dimensions: ['topic', 'content', 'depth', 'practical', 'innovation', 'expression'],
      weights: { topic: 15, content: 25, depth: 20, practical: 20, innovation: 10, expression: 10 },
      output_scale: 10,
    },
    prompt: [
      '你是技术周刊编辑助手。请根据候选内容进行六维评分，并输出 JSON。',
      '',
      '评分维度：',
      '- topic：选题质量、重要性、时效性、受众相关性',
      '- content：信息准确性、论证充分性、结构完整性',
      '- depth：技术细节、原理解释和深度',
      '- practical：可实践性、可操作性、可迁移性',
      '- innovation：观点或技术的新颖程度',
      '- expression：表达质量、逻辑清晰度和可读性',
      '',
      '每个维度 0-10 分，可带 0.5。输出字段：dimensions, reasons, summary。',
      '',
      '标题：{{title}}',
      '{{#source_url}}来源：{{source_url}}{{/source_url}}',
      '{{#description}}描述：{{description}}{{/description}}',
      '{{#content}}内容：{{content}}{{/content}}',
    ].join('\n'),
  },
  {
    scene: 'content_score',
    name: '内容评分',
    variables: ['title', 'source_url', 'description', 'summary', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请对下面的原文内容进行 0-10 分打分，并给出简短理由。',
      '输出 JSON 字段：overall, relevance, quality, practicality, reasons。',
      '标题：{{title}}',
      '{{#source_url}}来源：{{source_url}}{{/source_url}}',
      '{{#description}}描述：{{description}}{{/description}}',
      '{{#summary}}摘要：{{summary}}{{/summary}}',
      '原文内容：{{content}}',
    ].join('\n'),
  },
  {
    scene: 'summary_generate',
    name: '摘要生成',
    variables: ['title', 'source_url', 'description', 'content'],
    prompt: [
      '你是技术周刊编辑助手。请为下面内容生成 100-200 字中文摘要。',
      '要求客观、信息密度高、不要使用 Markdown，只输出摘要文本。',
      '标题：{{title}}',
      '{{#source_url}}来源：{{source_url}}{{/source_url}}',
      '{{#description}}描述：{{description}}{{/description}}',
      '原文：{{content}}',
    ].join('\n'),
  },
];

async function seedUsers() {
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const editorPasswordHash = await bcrypt.hash('editor123', 12);

  await prisma.users.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: adminPasswordHash,
      email: 'admin@example.com',
      display_name: '系统管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  await prisma.users.upsert({
    where: { username: 'editor' },
    update: {},
    create: {
      username: 'editor',
      password_hash: editorPasswordHash,
      email: 'editor@example.com',
      display_name: '内容编辑',
      role: 'EDITOR',
      status: 'ACTIVE',
    },
  });
}

async function seedContentTypes() {
  for (const item of contentTypes) {
    await prisma.content_types.upsert({
      where: { slug: item.slug },
      update: { name: item.name, description: item.description },
      create: item,
    });
  }
}

async function seedCategories() {
  for (const item of categories) {
    const existing = await prisma.categories.findFirst({ where: { slug: item.slug } });

    if (existing) {
      await prisma.categories.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          description: item.description,
          sort_order: item.sort_order,
        },
      });
      continue;
    }

    await prisma.categories.create({ data: item });
  }
}

async function seedTagGroups() {
  for (const item of tagGroups) {
    await prisma.tag_groups.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        color: item.color,
        sort_order: item.sort_order,
      },
      create: item,
    });
  }
}

async function seedTags() {
  const groups = await prisma.tag_groups.findMany();
  const groupBySlug = new Map(groups.map((group) => [group.slug, group.id]));

  for (const item of tags) {
    const group_id = groupBySlug.get(item.groupSlug);
    const aliases = JSON.stringify(item.aliases);
    const existing = await prisma.tags.findFirst({
      where: {
        OR: [{ slug: item.slug }, { name: item.name }],
      },
    });

    if (existing) {
      await prisma.tags.update({
        where: { id: existing.id },
        data: {
          group_id,
          aliases,
        },
      });
      continue;
    }

    await prisma.tags.create({
      data: {
        name: item.name,
        slug: item.slug,
        group_id,
        aliases,
      },
    });
  }
}

async function seedAiSettings() {
  for (const [key, value] of aiSettings) {
    await prisma.ai_settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

async function seedAiPrompts() {
  for (const item of defaultAiPrompts) {
    await prisma.ai_prompts.upsert({
      where: { scene: item.scene },
      update: {
        name: item.name,
        prompt: item.prompt,
        variables: item.variables,
      },
      create: item,
    });
  }
}

async function main() {
  await seedUsers();
  await seedContentTypes();
  await seedCategories();
  await seedTagGroups();
  await seedTags();
  await seedAiSettings();
  await seedAiPrompts();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Prisma seed completed');
  })
  .catch(async (error) => {
    console.error('Prisma seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
