# Phase 1: 数据库模型设计与迁移

## 概述

本阶段完成数据库模型的设计和数据迁移，是整个重构的基础。

## 前置条件

- [x] 已阅读现有 schema: `prisma/schema.prisma`
- [ ] 已备份数据库

## 任务清单

### 1.1 更新 Prisma Schema

**文件**: `prisma/schema.prisma`

**步骤**:

#### Step 1.1.1: 添加新枚举

在文件末尾（现有枚举之后）添加:

```prisma
enum DataSourceType {
  rss
  karakeep
  webhook
  manual
}

enum InboxStatus {
  pending
  promoted
  rejected
  duplicate
}
```

#### Step 1.1.2: 修改 contents_status 枚举

找到 `enum contents_status` (约第 358 行)，修改为:

```prisma
enum contents_status {
  draft
  ready      // 新增：编辑完成，可用于周刊
  published
  archived
  hidden
}
```

#### Step 1.1.3: 创建 data_sources 模型

在 `rss_sources` 模型之后添加:

```prisma
model data_sources {
  id                      Int             @id @default(autoincrement())
  name                    String          @db.VarChar(200)
  type                    DataSourceType

  // 通用配置 (JSON 存储各类型特有配置)
  config                  Json            @default("{}")
  enabled                 Boolean         @default(true)

  // 自动晋升配置
  auto_promote_threshold  Float?          // null = 不自动晋升

  // 默认分类
  default_category_id     Int?
  default_content_type_id Int?

  // 同步统计
  last_synced_at          DateTime?       @db.Timestamp(0)
  sync_count              Int             @default(0)
  error_count             Int             @default(0)
  last_error              String?         @db.Text

  // 时间戳
  created_at              DateTime        @default(now()) @db.Timestamp(0)
  updated_at              DateTime        @updatedAt      @db.Timestamp(0)

  // 关系
  default_category        categories?     @relation(fields: [default_category_id], references: [id])
  inbox_items             inbox_items[]

  @@index([type])
  @@index([enabled])
  @@map("data_sources")
}
```

#### Step 1.1.4: 创建 inbox_items 模型

在 `data_sources` 模型之后添加:

```prisma
model inbox_items {
  id                    BigInt        @id @default(autoincrement())

  // 数据源关联
  source_id             Int
  source_item_id        String?       @db.VarChar(255)  // karakeep_id, rss guid 等

  // 基本信息
  title                 String?       @db.Text
  url                   String        @db.VarChar(2048)
  description           String?       @db.Text
  note                  String?       @db.Text
  summary               String?       @db.Text
  content               String?       @db.LongText

  // 图片
  image_url             String?       @db.VarChar(2048)
  favicon_url           String?       @db.VarChar(500)

  // 元数据
  slug                  String?       @db.VarChar(255)
  source_name           String?       @db.VarChar(100)  // 来源网站名

  // AI 处理
  ai_score              Float?
  category_suggestion   String?       @db.VarChar(100)
  tags_suggestion       Json?         @default("[]")
  summarization_status  String?       @db.VarChar(20)
  tagging_status        String?       @db.VarChar(20)

  // 状态
  status                InboxStatus   @default(pending)
  priority              Int           @default(0)
  auto_promoted         Boolean       @default(false)

  // 关联
  content_id            BigInt?       // 晋升后关联的内容 ID
  duplicate_of_id       BigInt?       // 重复项指向

  // 时间戳
  source_published_at   DateTime?     @db.Timestamp(0)  // 源发布时间
  synced_at             DateTime?     @db.Timestamp(0)
  created_at            DateTime      @default(now()) @db.Timestamp(0)
  updated_at            DateTime      @updatedAt      @db.Timestamp(0)

  // 关系
  data_source           data_sources  @relation(fields: [source_id], references: [id])
  linked_content        contents?     @relation(fields: [content_id], references: [id])
  duplicate_of          inbox_items?  @relation("DuplicateItems", fields: [duplicate_of_id], references: [id])
  duplicates            inbox_items[] @relation("DuplicateItems")

  @@unique([source_id, source_item_id])
  @@index([status])
  @@index([ai_score])
  @@index([source_id])
  @@index([content_id])
  @@index([duplicate_of_id])
  @@map("inbox_items")
}
```

#### Step 1.1.5: 更新 categories 模型

找到 `model categories` (约第 11 行)，在关系部分添加:

```prisma
model categories {
  // ... 现有字段保持不变
  contents      contents[]
  data_sources  data_sources[]  // 新增
}
```

#### Step 1.1.6: 更新 contents 模型

找到 `model contents` (约第 97 行)，在关系部分添加:

```prisma
model contents {
  // ... 现有字段保持不变
  content_tags         content_tags[]
  categories           categories?              @relation(fields: [category_id], references: [id])
  drafts               drafts[]
  weekly_content_items weekly_content_items[]
  inbox_items          inbox_items[]            // 新增
  // ... 其他保持不变
}
```

#### Step 1.1.7: 验证 Schema

```bash
pnpm db:generate
```

**预期结果**: 无错误，Prisma Client 生成成功

---

### 1.2 创建数据迁移脚本

**文件**: `scripts/migrate-to-unified-sources.ts`

**完整代码**:

```typescript
/**
 * 数据迁移脚本: 统一数据源管理
 *
 * 功能:
 * 1. 创建新表 (data_sources, inbox_items)
 * 2. 迁移 rss_sources → data_sources
 * 3. 创建 Karakeep 数据源记录
 * 4. 迁移 drafts → inbox_items
 * 5. 验证数据完整性
 *
 * 使用方法:
 * npx tsx scripts/migrate-to-unified-sources.ts [--dry-run] [--skip-validation]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  rssSourcesMigrated: number;
  karakeepSourceCreated: boolean;
  draftsMigrated: number;
  errors: string[];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipValidation = args.includes('--skip-validation');

  console.log('=== 统一数据源迁移脚本 ===');
  console.log(`模式: ${dryRun ? '预演 (不执行实际变更)' : '正式执行'}`);
  console.log('');

  const stats: MigrationStats = {
    rssSourcesMigrated: 0,
    karakeepSourceCreated: false,
    draftsMigrated: 0,
    errors: [],
  };

  try {
    // Step 1: 检查新表是否存在
    console.log('Step 1: 检查数据库状态...');
    const dataSourcesExists = await checkTableExists('data_sources');
    const inboxItemsExists = await checkTableExists('inbox_items');

    if (!dataSourcesExists || !inboxItemsExists) {
      console.log('  新表不存在，请先执行 Prisma 迁移:');
      console.log('  npx prisma db push');
      process.exit(1);
    }
    console.log('  ✓ 新表已存在');

    // Step 2: 迁移 RSS 源
    console.log('\nStep 2: 迁移 RSS 源...');
    const rssSources = await prisma.rss_sources.findMany();
    console.log(`  发现 ${rssSources.length} 个 RSS 源`);

    for (const source of rssSources) {
      try {
        // 检查是否已迁移
        const existing = await prisma.data_sources.findFirst({
          where: {
            type: 'rss',
            config: {
              path: ['feed_url'],
              equals: source.feed_url,
            },
          },
        });

        if (existing) {
          console.log(`  - 跳过 "${source.name}" (已存在)`);
          continue;
        }

        const config = {
          feed_url: source.feed_url,
          source_type: source.type || 'normal',
          ...(source.config as object || {}),
        };

        if (!dryRun) {
          await prisma.data_sources.create({
            data: {
              name: source.name,
              type: 'rss',
              config,
              enabled: source.enabled ?? true,
              default_category_id: source.category_id,
              default_content_type_id: source.content_type_id,
              last_synced_at: source.last_fetched_at,
              sync_count: source.fetch_count ?? 0,
              error_count: source.error_count ?? 0,
              last_error: source.last_error,
            },
          });
        }

        stats.rssSourcesMigrated++;
        console.log(`  ✓ 迁移 "${source.name}"`);
      } catch (error) {
        const msg = `迁移 RSS 源 "${source.name}" 失败: ${error}`;
        stats.errors.push(msg);
        console.error(`  ✗ ${msg}`);
      }
    }

    // Step 3: 创建 Karakeep 数据源
    console.log('\nStep 3: 创建 Karakeep 数据源...');
    const karakeepExists = await prisma.data_sources.findFirst({
      where: { type: 'karakeep' },
    });

    if (karakeepExists) {
      console.log('  - 跳过 (已存在)');
    } else {
      if (!dryRun) {
        await prisma.data_sources.create({
          data: {
            name: 'Karakeep',
            type: 'karakeep',
            config: {
              require_ai_complete: true,
              sync_archived: false,
            },
            enabled: true,
          },
        });
      }
      stats.karakeepSourceCreated = true;
      console.log('  ✓ 创建 Karakeep 数据源');
    }

    // Step 4: 迁移 drafts
    console.log('\nStep 4: 迁移草稿到收件箱...');
    const karakeepSource = await prisma.data_sources.findFirst({
      where: { type: 'karakeep' },
    });

    if (!karakeepSource) {
      throw new Error('Karakeep 数据源不存在');
    }

    const drafts = await prisma.drafts.findMany();
    console.log(`  发现 ${drafts.length} 条草稿`);

    for (const draft of drafts) {
      try {
        // 检查是否已迁移
        const existing = await prisma.inbox_items.findFirst({
          where: {
            source_id: karakeepSource.id,
            source_item_id: draft.karakeep_id,
          },
        });

        if (existing) {
          console.log(`  - 跳过 "${draft.title?.slice(0, 30)}..." (已存在)`);
          continue;
        }

        // 状态映射
        const statusMap: Record<string, 'pending' | 'promoted' | 'rejected' | 'duplicate'> = {
          pending: 'pending',
          adopted: 'promoted',
          rejected: 'rejected',
        };

        if (!dryRun) {
          await prisma.inbox_items.create({
            data: {
              source_id: karakeepSource.id,
              source_item_id: draft.karakeep_id,
              title: draft.title,
              url: draft.url,
              description: draft.description,
              note: draft.note,
              summary: draft.summary,
              content: draft.content,
              image_url: draft.image_url,
              favicon_url: draft.favicon_url,
              slug: draft.slug,
              source_name: draft.source,
              category_suggestion: draft.category_suggestion,
              tags_suggestion: draft.tags_suggestion ? JSON.parse(draft.tags_suggestion) : [],
              summarization_status: draft.summarization_status,
              tagging_status: draft.tagging_status,
              status: statusMap[draft.status || 'pending'] || 'pending',
              priority: draft.priority ?? 0,
              content_id: draft.content_id,
              duplicate_of_id: draft.duplicate_of_draft_id,
              synced_at: draft.synced_at,
              created_at: draft.created_at ?? new Date(),
              updated_at: draft.updated_at ?? new Date(),
            },
          });
        }

        stats.draftsMigrated++;
        console.log(`  ✓ 迁移 "${draft.title?.slice(0, 30)}..."`);
      } catch (error) {
        const msg = `迁移草稿 "${draft.title}" 失败: ${error}`;
        stats.errors.push(msg);
        console.error(`  ✗ ${msg}`);
      }
    }

    // Step 5: 验证
    if (!skipValidation) {
      console.log('\nStep 5: 验证数据完整性...');

      const dataSourcesCount = await prisma.data_sources.count();
      const inboxItemsCount = await prisma.inbox_items.count();
      const originalRssCount = await prisma.rss_sources.count();
      const originalDraftsCount = await prisma.drafts.count();

      console.log(`  data_sources: ${dataSourcesCount} (原 rss_sources: ${originalRssCount})`);
      console.log(`  inbox_items: ${inboxItemsCount} (原 drafts: ${originalDraftsCount})`);

      if (dataSourcesCount < originalRssCount) {
        console.warn('  ⚠ 警告: data_sources 数量少于原 rss_sources');
      }
      if (inboxItemsCount < originalDraftsCount) {
        console.warn('  ⚠ 警告: inbox_items 数量少于原 drafts');
      }
    }

    // 输出统计
    console.log('\n=== 迁移完成 ===');
    console.log(`RSS 源迁移: ${stats.rssSourcesMigrated}`);
    console.log(`Karakeep 源创建: ${stats.karakeepSourceCreated ? '是' : '否'}`);
    console.log(`草稿迁移: ${stats.draftsMigrated}`);
    console.log(`错误数: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n错误详情:');
      stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (dryRun) {
      console.log('\n[预演模式] 未执行实际变更');
    }

  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
    `;
    return result[0].count > 0n;
  } catch {
    return false;
  }
}

main();
```

---

### 1.3 执行迁移

**步骤**:

```bash
# 1. 备份数据库 (重要!)
mysqldump -u root -p weekly_admin > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 生成 Prisma Client
pnpm db:generate

# 3. 推送 Schema 到数据库 (创建新表)
npx prisma db push

# 4. 预演迁移 (不执行实际变更)
npx tsx scripts/migrate-to-unified-sources.ts --dry-run

# 5. 正式执行迁移
npx tsx scripts/migrate-to-unified-sources.ts

# 6. 验证
npx prisma studio  # 打开 Prisma Studio 检查数据
```

---

## 验收标准

- [ ] `pnpm db:generate` 无错误
- [ ] `pnpm type-check` 无错误
- [ ] `data_sources` 表包含所有原 `rss_sources` 数据
- [ ] `data_sources` 表包含 Karakeep 数据源
- [ ] `inbox_items` 表包含所有原 `drafts` 数据
- [ ] 数据关联正确 (source_id, content_id 等)

---

## 回滚方案

如果迁移失败，执行:

```bash
# 恢复数据库备份
mysql -u root -p weekly_admin < backup_YYYYMMDD_HHMMSS.sql

# 重新生成 Prisma Client
pnpm db:generate
```

---

## 下一步

完成 Phase 1 后，继续执行 Phase 2 (服务层重构)。
