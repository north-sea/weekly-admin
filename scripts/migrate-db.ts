import 'dotenv/config';

/**
 * @deprecated This legacy schema migration script is retained for historical
 * reference only. New schema changes must use Prisma Migrate:
 * `pnpm prisma migrate dev` in development and `pnpm db:migrate` for deploy.
 * Default data initialization now belongs in `pnpm prisma db seed`.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const encryptApiKey = (plaintext: string) => {
  const rawKey = (process.env.AI_ENCRYPTION_KEY ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(rawKey)) {
    throw new Error('AI_ENCRYPTION_KEY 未配置或格式不正确（需要 64 位 hex）');
  }

  const key = Buffer.from(rawKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
};

async function migrateDatabase() {
  try {
    console.log('🔄 开始 MySQL 数据库迁移...');

    // 创建用户表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          display_name VARCHAR(100),
          role ENUM('ADMIN', 'EDITOR') DEFAULT 'EDITOR',
          status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
          last_login_at TIMESTAMP NULL,
          login_attempts INT DEFAULT 0,
          locked_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ 用户表创建完成');

    // 创建操作日志表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS operation_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          operation_type ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id INT,
          operation_details TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_operation_type (operation_type),
          INDEX idx_resource_type (resource_type)
      )
    `;
    console.log('✅ 操作日志表创建完成');

    // 创建内容版本表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS content_versions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          content_id BIGINT NOT NULL,
          version_number INT NOT NULL,
          title VARCHAR(500),
          content LONGTEXT,
          description TEXT,
          source VARCHAR(200),
          source_url VARCHAR(1000),
          changes_summary TEXT,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_content_version (content_id, version_number),
          INDEX idx_content_id (content_id),
          INDEX idx_created_by (created_by)
      )
    `;
    console.log('✅ 内容版本表创建完成');

    // 标签分组表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS tag_groups (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(50) NOT NULL UNIQUE,
          slug VARCHAR(50) NOT NULL UNIQUE,
          description TEXT NULL,
          color VARCHAR(20) NULL,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ tag_groups 表创建完成');

    // tags 表补齐 group_id 与 aliases 字段
    const tagGroupIdColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM tags LIKE 'group_id'
    `;
    if (Array.isArray(tagGroupIdColumn) && tagGroupIdColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE tags ADD COLUMN group_id INT NULL
      `;
      console.log('✅ tags 表添加 group_id 字段');
    }

    const tagAliasesColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM tags LIKE 'aliases'
    `;
    if (Array.isArray(tagAliasesColumn) && tagAliasesColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE tags ADD COLUMN aliases TEXT NULL
      `;
      console.log('✅ tags 表添加 aliases 字段');
    }

    // tags.group_id 索引
    const tagGroupIdIndex = await prisma.$queryRaw`
      SHOW INDEX FROM tags WHERE Key_name = 'idx_tags_group_id'
    `;
    if (Array.isArray(tagGroupIdIndex) && tagGroupIdIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_tags_group_id ON tags(group_id)
      `;
      console.log('✅ tags 表创建 group_id 索引');
    }

    // tags.group_id 外键
    const tagGroupFk = await prisma.$queryRaw`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tags'
        AND COLUMN_NAME = 'group_id'
        AND REFERENCED_TABLE_NAME = 'tag_groups'
        AND REFERENCED_COLUMN_NAME = 'id'
      LIMIT 1
    `;
    if (Array.isArray(tagGroupFk) && tagGroupFk.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE tags
        ADD CONSTRAINT fk_tags_group_id
        FOREIGN KEY (group_id) REFERENCES tag_groups(id)
        ON DELETE SET NULL
      `;
      console.log('✅ tags 表添加 group_id 外键');
    }

    // categories.archived 字段
    const categoriesArchivedColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM categories LIKE 'archived'
    `;
    if (Array.isArray(categoriesArchivedColumn) && categoriesArchivedColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE categories ADD COLUMN archived BOOLEAN DEFAULT false
      `;
      console.log('✅ categories 表添加 archived 字段');
    }

    // 检查 contents 表是否有 user_id 字段
    const contentsColumns = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'user_id'
    `;
    
    if (Array.isArray(contentsColumns) && contentsColumns.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN user_id INT
      `;
      console.log('✅ contents 表添加 user_id 字段');
    }

    // contents.content 允许为空（结构化数据模式）
    const contentsContentColumn = (await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'content'
    `) as Array<{ Null?: string; Type?: string }>;
    if (Array.isArray(contentsContentColumn) && contentsContentColumn.length > 0) {
      const isNullable = String(contentsContentColumn[0].Null ?? '').toUpperCase() === 'YES';
      if (!isNullable) {
        await prisma.$executeRaw`
          ALTER TABLE contents MODIFY COLUMN content LONGTEXT NULL
        `;
        console.log('✅ contents 表 content 字段允许为空');
      }
    }

    // AI 字段（contents）
    const originalScoreColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'original_score'
    `;
    if (Array.isArray(originalScoreColumn) && originalScoreColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN original_score FLOAT NULL
      `;
      console.log('✅ contents 表添加 original_score 字段');
    }

    const summaryScoreColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'summary_score'
    `;
    if (Array.isArray(summaryScoreColumn) && summaryScoreColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN summary_score FLOAT NULL
      `;
      console.log('✅ contents 表添加 summary_score 字段');
    }

    const aiMetadataColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'ai_metadata'
    `;
    if (Array.isArray(aiMetadataColumn) && aiMetadataColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN ai_metadata JSON NULL
      `;
      console.log('✅ contents 表添加 ai_metadata 字段');
    }

    const imageSourceColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_source'
    `;
    if (Array.isArray(imageSourceColumn) && imageSourceColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_source VARCHAR(50) NULL
      `;
      console.log('✅ contents 表添加 image_source 字段');
    }

    const imageWidthColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_width'
    `;
    if (Array.isArray(imageWidthColumn) && imageWidthColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_width INT NULL
      `;
      console.log('✅ contents 表添加 image_width 字段');
    }

    const imageHeightColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_height'
    `;
    if (Array.isArray(imageHeightColumn) && imageHeightColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_height INT NULL
      `;
      console.log('✅ contents 表添加 image_height 字段');
    }

    // AI 字段索引（可选，但推荐）
    const originalScoreIndex = await prisma.$queryRaw`
      SHOW INDEX FROM contents WHERE Key_name = 'idx_original_score'
    `;
    if (Array.isArray(originalScoreIndex) && originalScoreIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_original_score ON contents(original_score)
      `;
      console.log('✅ contents 表创建 idx_original_score 索引');
    }

    const summaryScoreIndex = await prisma.$queryRaw`
      SHOW INDEX FROM contents WHERE Key_name = 'idx_summary_score'
    `;
    if (Array.isArray(summaryScoreIndex) && summaryScoreIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_summary_score ON contents(summary_score)
      `;
      console.log('✅ contents 表创建 idx_summary_score 索引');
    }

    // contents.status 枚举扩展（支持 ready）
    const contentsStatusColumn = (await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'status'
    `) as Array<{ Type?: string }>;

    const contentsStatusType = String(contentsStatusColumn?.[0]?.Type ?? '');
    if (contentsStatusType.startsWith('enum(') && !contentsStatusType.includes("'ready'")) {
      await prisma.$executeRaw`
        ALTER TABLE contents
        MODIFY COLUMN status ENUM('draft','ready','published','archived','hidden') DEFAULT 'draft'
      `;
      console.log('✅ contents 表 status 枚举添加 ready');
    }

    // 统一数据源表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS data_sources (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(200) NOT NULL,
          type ENUM('rss', 'karakeep', 'webhook', 'manual') NOT NULL,
          config JSON NULL,
          enabled BOOLEAN DEFAULT true,
          auto_promote_threshold FLOAT NULL,
          auto_score_override BOOLEAN NULL,
          default_category_id INT NULL,
          default_content_type_id INT NULL,
          last_synced_at TIMESTAMP NULL,
          sync_count INT DEFAULT 0,
          error_count INT DEFAULT 0,
          last_error TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_data_sources_type (type),
          INDEX idx_data_sources_enabled (enabled),
          INDEX idx_data_sources_default_category_id (default_category_id),
          INDEX idx_data_sources_last_synced_at (last_synced_at)
      )
    `;
    console.log('✅ data_sources 表创建完成');

    // data_sources.auto_score_override 字段
    const dataSourcesAutoScoreOverrideColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM data_sources LIKE 'auto_score_override'
    `;
    if (Array.isArray(dataSourcesAutoScoreOverrideColumn) && dataSourcesAutoScoreOverrideColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE data_sources ADD COLUMN auto_score_override BOOLEAN NULL
      `;
      console.log('✅ data_sources 表添加 auto_score_override 字段');
    }

    // 统一收件箱表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS inbox_items (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          source_id INT NOT NULL,
          source_item_id VARCHAR(255) NULL,
          title TEXT NULL,
          url VARCHAR(2048) NOT NULL,
          description TEXT NULL,
          note TEXT NULL,
          summary TEXT NULL,
          content LONGTEXT NULL,
          image_url VARCHAR(2048) NULL,
          favicon_url VARCHAR(500) NULL,
          slug VARCHAR(255) NULL,
          source_name VARCHAR(255) NULL,
          ai_score FLOAT NULL,
          category_suggestion VARCHAR(100) NULL,
          tags_suggestion JSON NULL,
          summarization_status VARCHAR(20) NULL,
          tagging_status VARCHAR(20) NULL,
          status ENUM('pending', 'promoted', 'rejected', 'duplicate') DEFAULT 'pending',
          priority INT DEFAULT 0,
          auto_promoted BOOLEAN DEFAULT false,
          content_id BIGINT NULL,
          duplicate_of_id BIGINT NULL,
          source_published_at TIMESTAMP NULL,
          collected_at TIMESTAMP NULL,
          synced_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_inbox_source_item (source_id, source_item_id),
          INDEX idx_inbox_items_status (status),
          INDEX idx_inbox_items_ai_score (ai_score),
          INDEX idx_inbox_items_source_id (source_id),
          INDEX idx_inbox_items_content_id (content_id),
          INDEX idx_inbox_items_duplicate_of_id (duplicate_of_id),
          INDEX idx_inbox_items_synced_at (synced_at),
          INDEX idx_inbox_items_priority (priority)
      )
    `;
    console.log('✅ inbox_items 表创建完成');

    // inbox_items.collected_at 字段
    const inboxCollectedAtColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM inbox_items LIKE 'collected_at'
    `;
    if (Array.isArray(inboxCollectedAtColumn) && inboxCollectedAtColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE inbox_items ADD COLUMN collected_at TIMESTAMP NULL
      `;
      console.log('✅ inbox_items 表添加 collected_at 字段');
    }

    // inbox_items.source_name 字段长度
    const inboxSourceNameColumn = (await prisma.$queryRaw`
      SHOW COLUMNS FROM inbox_items LIKE 'source_name'
    `) as Array<{ Type?: string }>;
    const inboxSourceNameType = String(inboxSourceNameColumn?.[0]?.Type ?? '');
    const inboxSourceNameLength = Number(inboxSourceNameType.match(/varchar\((\d+)\)/i)?.[1] ?? 0);
    if (inboxSourceNameLength > 0 && inboxSourceNameLength < 255) {
      await prisma.$executeRaw`
        ALTER TABLE inbox_items MODIFY COLUMN source_name VARCHAR(255) NULL
      `;
      console.log('✅ inbox_items 表扩展 source_name 长度');
    }

    // inbox_items.collected_at 回填
    await prisma.$executeRaw`
      UPDATE inbox_items
      SET collected_at = COALESCE(collected_at, created_at)
      WHERE collected_at IS NULL
    `;
    console.log('✅ inbox_items 表回填 collected_at 字段');

    // Karakeep 来源回填 collected_at 为收藏时间（source_published_at）
    await prisma.$executeRaw`
      UPDATE inbox_items i
      JOIN data_sources s ON i.source_id = s.id
      SET i.collected_at = i.source_published_at
      WHERE s.type = 'karakeep'
        AND i.source_published_at IS NOT NULL
        AND (i.collected_at IS NULL OR i.collected_at <> i.source_published_at)
    `;
    console.log('✅ inbox_items 表回填 Karakeep collected_at');

    // AI 设置表（key-value）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ai_settings (
          \`key\` VARCHAR(100) PRIMARY KEY,
          value JSON NOT NULL,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ ai_settings 表创建完成');

    // 初始化默认 AI 设置（仅当不存在时写入）
    await prisma.$executeRaw`
      INSERT IGNORE INTO ai_settings (\`key\`, value)
      VALUES ('auto_score_on_sync', '{"enabled": true}')
    `;
    console.log('✅ ai_settings 默认配置初始化完成');

    // AI 配置表（支持多组配置）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ai_configs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL UNIQUE,
          provider ENUM('openai', 'anthropic') DEFAULT 'openai',
          base_url VARCHAR(500) NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          text_model VARCHAR(100) NOT NULL,
          image_model VARCHAR(100) NULL,
          is_default BOOLEAN DEFAULT false,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ai_configs_enabled (enabled),
          INDEX idx_ai_configs_is_default (is_default)
      )
    `;
    console.log('✅ AI 配置表创建完成');

    // 初始化默认 AI 配置（基于当前环境变量；仅当表为空时写入）
    const aiConfigsCountRows = (await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM ai_configs
    `) as Array<{ count: number }>;
    const aiConfigsCount = Number(aiConfigsCountRows?.[0]?.count ?? 0);

    if (aiConfigsCount === 0) {
      const provider = ((process.env.AI_PROVIDER ?? 'openai').toLowerCase() === 'anthropic' ? 'anthropic' : 'openai') as
        | 'openai'
        | 'anthropic';

      const apiKey =
        provider === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY
          : process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;

      if (apiKey && apiKey.trim()) {
        const baseUrl =
          provider === 'anthropic'
            ? normalizeBaseUrl(process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com')
            : normalizeBaseUrl(process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com');

        const textModel =
          provider === 'anthropic'
            ? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest'
            : process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

        const imageModel =
          provider === 'openai' ? process.env.AI_IMAGE_MODEL ?? process.env.AI_TEXT_MODEL ?? 'gpt-image-1' : null;

        const encrypted = encryptApiKey(apiKey.trim());

        await prisma.$executeRaw`
          INSERT IGNORE INTO ai_configs
            (name, provider, base_url, api_key_encrypted, text_model, image_model, is_default, enabled)
          VALUES
            ('默认配置（ENV）', ${provider}, ${baseUrl}, ${encrypted}, ${textModel}, ${imageModel}, true, true)
        `;
        console.log('✅ 默认 AI 配置初始化完成');
      } else {
        console.log('ℹ️ 未检测到可用的 API Key，跳过默认 AI 配置初始化');
      }
    }

    // AI Prompt 表（场景化 Prompt 模板）
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ai_prompts (
          id INT PRIMARY KEY AUTO_INCREMENT,
          scene VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          prompt TEXT NOT NULL,
          variables JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ AI Prompt 表创建完成');

    // 初始化默认 Prompt（仅首次插入，不覆盖已有自定义）
    const defaultAiPrompts: Array<{
      scene: string;
      name: string;
      prompt: string;
      variables: string[];
    }> = [
      {
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
      {
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
      {
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
      {
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
      {
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
      {
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
      {
        scene: 'weekly_cover',
        name: '周刊封面',
        variables: ['title', 'contents_summary'],
        prompt:
          'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.',
      },
    ];

    for (const item of defaultAiPrompts) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO ai_prompts (scene, name, prompt, variables)
        VALUES (${item.scene}, ${item.name}, ${item.prompt}, ${JSON.stringify(item.variables)})
      `;
    }
    console.log('✅ 默认 AI Prompt 初始化完成');

    // 检查 weekly_issues 表是否有 created_by 字段
    const weeklyIssuesColumns = await prisma.$queryRaw`
      SHOW COLUMNS FROM weekly_issues LIKE 'created_by'
    `;

    if (Array.isArray(weeklyIssuesColumns) && weeklyIssuesColumns.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE weekly_issues ADD COLUMN created_by INT DEFAULT 1
      `;
      console.log('✅ weekly_issues 表添加 created_by 字段');
    }

    // 检查 weekly_issues 表是否有 Quail 相关字段
    const quailPostIdColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM weekly_issues LIKE 'quail_post_id'
    `;

    if (Array.isArray(quailPostIdColumn) && quailPostIdColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE weekly_issues
        ADD COLUMN quail_post_id VARCHAR(100) NULL,
        ADD COLUMN quail_post_slug VARCHAR(200) NULL,
        ADD COLUMN quail_published_at TIMESTAMP NULL,
        ADD COLUMN quail_delivered_at TIMESTAMP NULL,
        ADD COLUMN quail_publish_error TEXT NULL
      `;
      console.log('✅ weekly_issues 表添加 Quail 相关字段');
    }

    // 创建默认用户
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const editorPasswordHash = await bcrypt.hash('editor123', 12);

    await prisma.$executeRaw`
      INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
      VALUES ('admin', ${adminPasswordHash}, 'admin@example.com', '系统管理员', 'ADMIN', 'ACTIVE')
    `;

    await prisma.$executeRaw`
      INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
      VALUES ('editor', ${editorPasswordHash}, 'editor@example.com', '内容编辑', 'EDITOR', 'ACTIVE')
    `;

    console.log('✅ 默认用户创建完成');
    console.log('🎉 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateDatabase();
