#!/usr/bin/env tsx
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

type DraftRow = {
  id: bigint | number | string;
  karakeep_id: string;
  title: string;
  url: string;
  description: string | null;
  note: string | null;
  favicon_url: string | null;
  image_url: string | null;
  karakeep_created_at: Date | string | null;
  karakeep_updated_at: Date | string | null;
  status: 'pending' | 'adopted' | 'rejected' | null;
  priority: number | null;
  category_suggestion: string | null;
  tags_suggestion: string | null;
  duplicate_of_draft_id: bigint | number | string | null;
  content_id: bigint | number | string | null;
  synced_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  content: string | null;
  slug: string | null;
  source: string | null;
  summarization_status: string | null;
  summary: string | null;
  tagging_status: string | null;
};

type RssSourceRow = {
  id: number;
  name: string;
  feed_url: string;
  type: 'normal' | 'aggregator' | null;
  enabled: boolean | null;
  content_type_id: number | null;
  category_id: number | null;
  config: unknown | null;
  last_fetched_at: Date | string | null;
  fetch_count: number | null;
  error_count: number | null;
  last_error: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

const prisma = new PrismaClient();

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string' && value.trim()) return BigInt(value);
  return null;
}

function safeJsonParse(value: string | null): unknown | null {
  if (!value || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapInboxStatus(draftStatus: DraftRow['status'], duplicateOfDraftId: DraftRow['duplicate_of_draft_id']): string {
  if (duplicateOfDraftId !== null && duplicateOfDraftId !== undefined) return 'duplicate';
  if (draftStatus === 'adopted') return 'promoted';
  if (draftStatus === 'rejected') return 'rejected';
  return 'pending';
}

async function ensureUnifiedTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS data_sources (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        type ENUM('rss', 'karakeep', 'webhook', 'manual') NOT NULL,
        config JSON NULL,
        enabled BOOLEAN DEFAULT true,
        auto_promote_threshold FLOAT NULL,
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
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = (await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `) as Array<{ count: number }>;
  return Number(rows?.[0]?.count ?? 0) > 0;
}

async function getOrCreateKarakeepSourceId(dryRun: boolean): Promise<number> {
  const existing = (await prisma.$queryRaw`
    SELECT id FROM data_sources WHERE type = 'karakeep' LIMIT 1
  `) as Array<{ id: number }>;

  if (existing?.[0]?.id) return Number(existing[0].id);

  if (dryRun) return -1;

  await prisma.$executeRaw`
    INSERT INTO data_sources (name, type, config, enabled, created_at, updated_at)
    VALUES ('Karakeep', 'karakeep', ${JSON.stringify({})}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const created = (await prisma.$queryRaw`
    SELECT id FROM data_sources WHERE type = 'karakeep' ORDER BY id DESC LIMIT 1
  `) as Array<{ id: number }>;

  if (!created?.[0]?.id) {
    throw new Error('Failed to create karakeep data source');
  }
  return Number(created[0].id);
}

async function migrateRssSources(dryRun: boolean) {
  const rssSources = (await prisma.$queryRaw`
    SELECT * FROM rss_sources
  `) as RssSourceRow[];

  const canCheckExisting = await tableExists('data_sources');

  let created = 0;
  let updated = 0;

  for (const source of rssSources) {
    const configBase =
      source.config && typeof source.config === 'object'
        ? (source.config as Record<string, unknown>)
        : (typeof source.config === 'string' ? (safeJsonParse(source.config) as Record<string, unknown> | null) : null) ?? {};
    const config = {
      ...configBase,
      feed_url: source.feed_url,
      source_type: source.type ?? 'normal',
      legacy_rss_source_id: source.id,
    };

    const existing = canCheckExisting
      ? ((await prisma.$queryRaw`
          SELECT id
          FROM data_sources
          WHERE type = 'rss'
            AND JSON_UNQUOTE(JSON_EXTRACT(config, '$.feed_url')) = ${source.feed_url}
          LIMIT 1
        `) as Array<{ id: number }>)
      : [];

    if (existing?.[0]?.id) {
      updated += 1;
      if (!dryRun) {
        await prisma.$executeRaw`
          UPDATE data_sources
          SET
            name = ${source.name},
            enabled = ${source.enabled ?? true},
            config = ${JSON.stringify(config)},
            default_category_id = ${source.category_id},
            default_content_type_id = ${source.content_type_id},
            last_synced_at = ${source.last_fetched_at ? new Date(source.last_fetched_at) : null},
            sync_count = ${source.fetch_count ?? 0},
            error_count = ${source.error_count ?? 0},
            last_error = ${source.last_error},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existing[0].id}
        `;
      }
      continue;
    }

    created += 1;
    if (!dryRun) {
      await prisma.$executeRaw`
        INSERT INTO data_sources
          (name, type, config, enabled, default_category_id, default_content_type_id, last_synced_at, sync_count, error_count, last_error, created_at, updated_at)
        VALUES
          (
            ${source.name},
            'rss',
            ${JSON.stringify(config)},
            ${source.enabled ?? true},
            ${source.category_id},
            ${source.content_type_id},
            ${source.last_fetched_at ? new Date(source.last_fetched_at) : null},
            ${source.fetch_count ?? 0},
            ${source.error_count ?? 0},
            ${source.last_error},
            ${source.created_at ? new Date(source.created_at) : new Date()},
            ${source.updated_at ? new Date(source.updated_at) : new Date()}
          )
      `;
    }
  }

  console.log(`✅ RSS sources migrated: created=${created}, updated=${updated}, total=${rssSources.length}`);
}

async function migrateDraftsToInboxItems(karakeepSourceId: number, dryRun: boolean) {
  const drafts = (await prisma.$queryRaw`
    SELECT
      id,
      karakeep_id,
      title,
      url,
      description,
      note,
      favicon_url,
      image_url,
      karakeep_created_at,
      karakeep_updated_at,
      status,
      priority,
      category_suggestion,
      tags_suggestion,
      duplicate_of_draft_id,
      content_id,
      synced_at,
      created_at,
      updated_at,
      content,
      slug,
      source,
      summarization_status,
      summary,
      tagging_status
    FROM drafts
  `) as DraftRow[];

  let upserts = 0;

  for (const draft of drafts) {
    const id = toBigInt(draft.id);
    if (id === null) continue;

    const tagsSuggestion = safeJsonParse(draft.tags_suggestion);
    const tagsSuggestionJson = tagsSuggestion === null ? null : JSON.stringify(tagsSuggestion);

    const status = mapInboxStatus(draft.status, draft.duplicate_of_draft_id);

    upserts += 1;
    if (dryRun) continue;

    await prisma.$executeRaw`
      INSERT INTO inbox_items
        (
          id,
          source_id,
          source_item_id,
          title,
          url,
          description,
          note,
          summary,
          content,
          image_url,
          favicon_url,
          slug,
          source_name,
          category_suggestion,
          tags_suggestion,
          summarization_status,
          tagging_status,
          status,
          priority,
          auto_promoted,
          content_id,
          duplicate_of_id,
          source_published_at,
          synced_at,
          created_at,
          updated_at
        )
      VALUES
        (
          ${id},
          ${karakeepSourceId},
          ${draft.karakeep_id},
          ${draft.title},
          ${draft.url},
          ${draft.description},
          ${draft.note},
          ${draft.summary},
          ${draft.content},
          ${draft.image_url},
          ${draft.favicon_url},
          ${draft.slug},
          ${draft.source},
          ${draft.category_suggestion},
          ${tagsSuggestionJson},
          ${draft.summarization_status},
          ${draft.tagging_status},
          ${status},
          ${draft.priority ?? 0},
          false,
          ${draft.content_id ? toBigInt(draft.content_id) : null},
          ${draft.duplicate_of_draft_id ? toBigInt(draft.duplicate_of_draft_id) : null},
          ${draft.karakeep_created_at ? new Date(draft.karakeep_created_at) : null},
          ${draft.synced_at ? new Date(draft.synced_at) : null},
          ${draft.created_at ? new Date(draft.created_at) : new Date()},
          ${draft.updated_at ? new Date(draft.updated_at) : new Date()}
        )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        source_item_id = VALUES(source_item_id),
        title = VALUES(title),
        url = VALUES(url),
        description = VALUES(description),
        note = VALUES(note),
        summary = VALUES(summary),
        content = VALUES(content),
        image_url = VALUES(image_url),
        favicon_url = VALUES(favicon_url),
        slug = VALUES(slug),
        source_name = VALUES(source_name),
        category_suggestion = VALUES(category_suggestion),
        tags_suggestion = VALUES(tags_suggestion),
        summarization_status = VALUES(summarization_status),
        tagging_status = VALUES(tagging_status),
        status = VALUES(status),
        priority = VALUES(priority),
        auto_promoted = VALUES(auto_promoted),
        content_id = VALUES(content_id),
        duplicate_of_id = VALUES(duplicate_of_id),
        source_published_at = VALUES(source_published_at),
        synced_at = VALUES(synced_at),
        updated_at = VALUES(updated_at)
    `;
  }

  console.log(`✅ Drafts migrated to inbox_items: upserts=${upserts}, total=${drafts.length}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const dryRun = !apply || args.has('--dry-run');

  console.log('========================================');
  console.log('统一数据源管理系统 - 数据迁移');
  console.log(`Mode: ${apply && !dryRun ? 'APPLY' : 'DRY-RUN'}`);
  console.log('========================================\n');

  try {
    if (apply && !dryRun) {
      await ensureUnifiedTables();
    } else {
      console.log('ℹ️ Dry-run: 不会创建表/写入数据（如需执行写入，请加 --apply）\n');
    }

    await migrateRssSources(dryRun);

    if (apply && !dryRun) {
      const karakeepSourceId = await getOrCreateKarakeepSourceId(false);
      await migrateDraftsToInboxItems(karakeepSourceId, false);
    } else {
      const draftsCountRows = (await prisma.$queryRaw`
        SELECT COUNT(*) AS count FROM drafts
      `) as Array<{ count: number }>;
      console.log(`✅ Drafts scan: total=${Number(draftsCountRows?.[0]?.count ?? 0)} (dry-run, no write)`);
    }

    if (apply && !dryRun) {
      const counts = (await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*) FROM rss_sources) AS rss_sources_count,
          (SELECT COUNT(*) FROM data_sources WHERE type = 'rss') AS data_sources_rss_count,
          (SELECT COUNT(*) FROM drafts) AS drafts_count,
          (SELECT COUNT(*) FROM inbox_items) AS inbox_items_count
      `) as Array<{
        rss_sources_count: number;
        data_sources_rss_count: number;
        drafts_count: number;
        inbox_items_count: number;
      }>;

      if (counts?.[0]) {
        console.log('\n📊 Counts');
        console.log('-', counts[0]);
      }
    }

    console.log('\n🎉 迁移脚本执行完成');
    if (!apply || dryRun) console.log('下一步：确认已备份数据库后，使用 `--apply` 执行实际迁移');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
