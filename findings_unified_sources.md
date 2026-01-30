# Findings: 统一数据源管理系统重构

## 现有代码结构分析

### 1. 数据库模型 (prisma/schema.prisma)

#### drafts 表 (行 228-265)
```prisma
model drafts {
  id                    BigInt         @id @default(autoincrement())
  karakeep_id           String         @unique @db.VarChar(100)
  title                 String         @db.VarChar(500)
  url                   String         @db.VarChar(1000)
  description           String?        @db.Text
  note                  String?        @db.Text
  favicon_url           String?        @db.VarChar(500)
  image_url             String?        @db.VarChar(500)
  karakeep_created_at   DateTime?
  karakeep_updated_at   DateTime?
  status                drafts_status? @default(pending)  // pending/adopted/rejected
  priority              Int?           @default(0)
  category_suggestion   String?        @db.VarChar(100)
  tags_suggestion       String?        @db.Text           // JSON 字符串
  duplicate_of_draft_id BigInt?
  content_id            BigInt?
  synced_at             DateTime?
  content               String?        @db.LongText
  slug                  String?        @db.VarChar(500)
  source                String?        @db.VarChar(200)
  summarization_status  String?        @db.VarChar(50)
  summary               String?        @db.Text
  tagging_status        String?        @db.VarChar(50)
  word_count            Int?           @default(0)
}
```

#### rss_sources 表 (行 267-286)
```prisma
model rss_sources {
  id              Int               @id @default(autoincrement())
  name            String            @db.VarChar(200)
  feed_url        String            @unique @db.VarChar(768)
  type            rss_sources_type? @default(normal)  // normal/aggregator
  enabled         Boolean?          @default(true)
  content_type_id Int?              @default(4)
  category_id     Int?
  config          Json?
  last_fetched_at DateTime?
  fetch_count     Int?              @default(0)
  error_count     Int?              @default(0)
  last_error      String?           @db.Text
}
```

#### contents 表 status 枚举 (行 358-363)
```prisma
enum contents_status {
  draft
  published
  archived
  hidden
}
```

### 2. 服务层

#### DraftService (src/lib/services/draft.ts)
- `getDraftList(query)` - 支持 inbox/editor/all 三种阶段
- `syncFromKarakeep()` - 从 Karakeep 同步
- `syncSingleDraft(draftId)` - 单独同步
- `detectDuplicates(url)` - URL 去重
- `markDuplicates(originalId, duplicateIds)` - 标记重复

#### RSS Ingest (src/lib/rss/ingest.ts)
- `ingestRssSource(sourceId, userId, options)` - RSS 抓取入库
- 直接写入 `contents` 表 (status=draft)
- 支持去重检测 (drafts + contents)
- 支持聚合器处理

### 3. 关键差异

| 特性 | Karakeep (drafts) | RSS (contents) |
|------|-------------------|----------------|
| 入库表 | drafts | contents |
| 初始状态 | pending | draft |
| AI 评分 | 无 | 无 |
| 标签来源 | Karakeep AI | 无 |
| 去重检测 | 有 | 有 |

---

## 新数据模型设计

### 1. 新增枚举

```prisma
enum DataSourceType {
  rss
  karakeep
  webhook
  manual
}

enum InboxStatus {
  pending      // 待处理
  promoted     // 已晋升到内容库
  rejected     // 已拒绝
  duplicate    // 重复
}
```

### 2. 修改 contents_status 枚举

```prisma
enum contents_status {
  draft
  ready        // 新增：编辑完成，可用于周刊
  published
  archived
  hidden
}
```

### 3. 新建 data_sources 表

```prisma
model data_sources {
  id                      Int             @id @default(autoincrement())
  name                    String          @db.VarChar(200)
  type                    DataSourceType

  // 通用配置
  config                  Json            @default("{}")
  enabled                 Boolean         @default(true)

  // 自动晋升配置
  auto_promote_threshold  Float?          // null = 不自动晋升

  // 默认分类
  default_category_id     Int?
  default_content_type_id Int?

  // 同步统计
  last_synced_at          DateTime?
  sync_count              Int             @default(0)
  error_count             Int             @default(0)
  last_error              String?         @db.Text

  // 时间戳
  created_at              DateTime        @default(now())
  updated_at              DateTime        @updatedAt

  // 关系
  default_category        categories?     @relation(fields: [default_category_id], references: [id])
  inbox_items             inbox_items[]

  @@map("data_sources")
}
```

**config JSON 结构示例**：

```typescript
// RSS 类型
interface RssSourceConfig {
  feed_url: string;
  source_type: 'normal' | 'aggregator';
  deduplication?: {
    check_similarity?: boolean;
    similarity_threshold?: number;
    check_days?: number;
  };
  aggregator?: {
    extract_links?: boolean;
    link_selector?: string;
    min_links?: number;
  };
}

// Karakeep 类型
interface KarakeepSourceConfig {
  list_id?: string;           // 指定列表 ID
  sync_archived?: boolean;    // 是否同步已归档
  require_ai_complete?: boolean; // 是否要求 AI 处理完成
}
```

### 4. 重命名 drafts 为 inbox_items

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
  source_published_at   DateTime?     // 源发布时间
  synced_at             DateTime?
  created_at            DateTime      @default(now())
  updated_at            DateTime      @updatedAt

  // 关系
  data_source           data_sources  @relation(fields: [source_id], references: [id])
  linked_content        contents?     @relation(fields: [content_id], references: [id])
  duplicate_of          inbox_items?  @relation("DuplicateItems", fields: [duplicate_of_id], references: [id])
  duplicates            inbox_items[] @relation("DuplicateItems")

  @@unique([source_id, source_item_id])
  @@index([status])
  @@index([ai_score])
  @@index([url(length: 255)])
  @@index([source_id])
  @@map("inbox_items")
}
```

---

## 数据迁移策略

### 1. rss_sources → data_sources

```sql
INSERT INTO data_sources (name, type, config, enabled, default_category_id, default_content_type_id, last_synced_at, sync_count, error_count, last_error, created_at, updated_at)
SELECT
  name,
  'rss' as type,
  JSON_OBJECT(
    'feed_url', feed_url,
    'source_type', COALESCE(type, 'normal'),
    'deduplication', JSON_EXTRACT(config, '$.deduplication'),
    'aggregator', JSON_EXTRACT(config, '$.aggregator')
  ) as config,
  COALESCE(enabled, true),
  category_id,
  content_type_id,
  last_fetched_at,
  COALESCE(fetch_count, 0),
  COALESCE(error_count, 0),
  last_error,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM rss_sources;
```

### 2. 创建 Karakeep 数据源

```sql
INSERT INTO data_sources (name, type, config, enabled, created_at, updated_at)
VALUES ('Karakeep', 'karakeep', '{"require_ai_complete": true}', true, NOW(), NOW());
```

### 3. drafts → inbox_items

```sql
INSERT INTO inbox_items (
  source_id, source_item_id, title, url, description, note, summary, content,
  image_url, favicon_url, slug, source_name, ai_score, category_suggestion,
  tags_suggestion, summarization_status, tagging_status, status, priority,
  content_id, duplicate_of_id, synced_at, created_at, updated_at
)
SELECT
  (SELECT id FROM data_sources WHERE type = 'karakeep' LIMIT 1) as source_id,
  karakeep_id as source_item_id,
  title, url, description, note, summary, content,
  image_url, favicon_url, slug, source,
  NULL as ai_score,
  category_suggestion,
  tags_suggestion,
  summarization_status, tagging_status,
  CASE status
    WHEN 'pending' THEN 'pending'
    WHEN 'adopted' THEN 'promoted'
    WHEN 'rejected' THEN 'rejected'
  END as status,
  COALESCE(priority, 0),
  content_id,
  duplicate_of_draft_id,
  synced_at,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM drafts;
```

---

## 服务层设计

### DataSourceService

```typescript
// src/lib/services/data-source.ts
export class DataSourceService {
  // CRUD
  static async list(): Promise<DataSource[]>
  static async get(id: number): Promise<DataSource | null>
  static async create(input: CreateDataSourceInput): Promise<DataSource>
  static async update(id: number, input: UpdateDataSourceInput): Promise<DataSource>
  static async delete(id: number): Promise<void>

  // 同步
  static async sync(id: number): Promise<SyncResult>
  static async syncAll(): Promise<SyncResult[]>

  // 统计
  static async getStats(id: number): Promise<DataSourceStats>
}
```

### InboxService

```typescript
// src/lib/services/inbox.ts
export class InboxService {
  // 查询
  static async list(query: InboxQuery): Promise<InboxListResponse>
  static async get(id: bigint): Promise<InboxItem | null>
  static async getStats(): Promise<InboxStats>

  // 操作
  static async update(id: bigint, data: UpdateInboxInput): Promise<InboxItem>
  static async promote(id: bigint): Promise<Content>
  static async batchPromote(ids: bigint[]): Promise<PromoteResult>
  static async reject(id: bigint): Promise<void>
  static async markDuplicate(id: bigint, originalId: bigint): Promise<void>

  // 自动处理
  static async autoPromote(): Promise<AutoPromoteResult>
}
```

### SyncOrchestrator

```typescript
// src/lib/services/sync-orchestrator.ts
export class SyncOrchestrator {
  // 统一同步入口
  static async syncSource(sourceId: number): Promise<SyncResult>

  // 各类型同步器
  private static async syncKarakeep(source: DataSource): Promise<SyncResult>
  private static async syncRss(source: DataSource): Promise<SyncResult>

  // 后处理
  private static async processInboxItem(item: InboxItem): Promise<void>
  private static async scoreItem(item: InboxItem): Promise<number>
  private static async suggestCategory(item: InboxItem): Promise<string | null>
  private static async suggestTags(item: InboxItem): Promise<string[]>
}
```

---

## API 路由设计

### 数据源 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/sources | 获取数据源列表 |
| POST | /api/sources | 创建数据源 |
| GET | /api/sources/[id] | 获取单个数据源 |
| PUT | /api/sources/[id] | 更新数据源 |
| DELETE | /api/sources/[id] | 删除数据源 |
| POST | /api/sources/[id]/sync | 触发同步 |
| POST | /api/sources/sync-all | 同步所有数据源 |

### 收件箱 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/inbox | 获取收件箱列表 |
| GET | /api/inbox/stats | 获取统计数据 |
| GET | /api/inbox/[id] | 获取单个项目 |
| PUT | /api/inbox/[id] | 更新项目 |
| DELETE | /api/inbox/[id] | 删除项目 |
| POST | /api/inbox/[id]/promote | 晋升到内容库 |
| POST | /api/inbox/batch | 批量操作 |
| POST | /api/inbox/auto-promote | 自动晋升 |

---

## 前端页面设计

### 数据源管理页面 (/sources)

```
┌─────────────────────────────────────────────────────────────┐
│ 数据源管理                                    [+ 添加数据源] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 名称        │ 类型     │ 状态   │ 上次同步   │ 操作    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Karakeep    │ karakeep │ ✓ 启用 │ 5分钟前    │ [同步]  │ │
│ │ 阮一峰周刊  │ rss      │ ✓ 启用 │ 1小时前    │ [同步]  │ │
│ │ Hacker News │ rss      │ ✗ 禁用 │ 3天前      │ [同步]  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 收件箱页面 (/content/inbox)

```
┌─────────────────────────────────────────────────────────────┐
│ 收件箱                                                       │
├─────────────────────────────────────────────────────────────┤
│ 统计: 待处理 42 │ 今日新增 12 │ 高分待采纳 8                 │
├─────────────────────────────────────────────────────────────┤
│ 筛选: [全部来源 ▼] [全部状态 ▼] [评分 ▼] [搜索...]          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [□] 标题                    │ 来源     │ 评分 │ 操作    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ [□] React 19 新特性解析     │ Karakeep │ 8.5  │ [采纳]  │ │
│ │ [□] TypeScript 5.4 发布     │ RSS      │ 7.2  │ [采纳]  │ │
│ │ [□] 前端性能优化指南        │ Karakeep │ 6.8  │ [查看]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [批量采纳] [批量拒绝] [自动采纳高分]                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 文件变更清单

> 注：此清单包含“规划中的文件”。截至 2026-01-28，已实际完成的改动包含：
> - `prisma/schema.prisma`、`scripts/migrate-db.ts`、`scripts/migrate-to-unified-sources.ts`
> - 服务/校验：`src/lib/services/data-source.ts`、`src/lib/services/inbox.ts`、`src/lib/services/sync-orchestrator.ts`、`src/lib/validations/data-source.ts`、`src/lib/validations/inbox.ts`
> - API：`/api/sources/*`、`/api/inbox/*` 及旧 `/api/rss/*`、`/api/drafts/*` 的兼容适配
> - Hooks：`src/hooks/queries/useDataSourceQueries.ts`、`src/hooks/queries/useInboxQueries.ts`
> - 页面：`/sources`、`/inbox`，并更新侧边栏导航入口

### 新建文件

| 文件路径 | 描述 |
|----------|------|
| `scripts/migrate-to-unified-sources.ts` | 数据迁移脚本 |
| `src/lib/services/data-source.ts` | 数据源服务 |
| `src/lib/services/inbox.ts` | 收件箱服务 |
| `src/lib/services/sync-orchestrator.ts` | 同步编排服务 |
| `src/lib/validations/data-source.ts` | 验证 Schema |
| `src/app/api/sources/route.ts` | 数据源列表 API |
| `src/app/api/sources/[id]/route.ts` | 数据源详情 API |
| `src/app/api/sources/[id]/sync/route.ts` | 数据源同步 API |
| `src/app/api/sources/sync-all/route.ts` | 全部同步 API |
| `src/app/api/inbox/route.ts` | 收件箱列表 API |
| `src/app/api/inbox/stats/route.ts` | 收件箱统计 API |
| `src/app/api/inbox/[id]/route.ts` | 收件箱详情 API |
| `src/app/api/inbox/[id]/promote/route.ts` | 晋升 API |
| `src/app/api/inbox/batch/route.ts` | 批量操作 API |
| `src/app/api/inbox/auto-promote/route.ts` | 自动晋升 API |
| `src/app/(dashboard)/sources/page.tsx` | 数据源管理页面 |
| `src/hooks/queries/useDataSourceQueries.ts` | 数据源 Hooks |
| `src/hooks/queries/useInboxQueries.ts` | 收件箱 Hooks |

### 修改文件

| 文件路径 | 变更描述 |
|----------|----------|
| `prisma/schema.prisma` | 添加新枚举和模型 |
| `src/app/(dashboard)/content/drafts/page.tsx` | 重构为收件箱页面 |
| `src/components/layout/ProLayoutWrapper.tsx` | 更新导航菜单 |
| `src/types/api.ts` | 添加新类型定义 |

### 废弃文件 (Phase 5 删除)

| 文件路径 | 原因 |
|----------|------|
| `src/lib/services/draft.ts` | 功能迁移到 inbox.ts |
| `src/lib/rss/source-service.ts` | 功能迁移到 data-source.ts |
| `src/app/api/drafts/*` | 迁移到 /api/inbox/* |
| `src/app/api/rss/sources/*` | 迁移到 /api/sources/* |
| `src/app/(dashboard)/rss/page.tsx` | 迁移到 /sources |

---

## Phase 5 清理前检查（待删除冗余）

### 仍在代码中引用的旧表/枚举
- `prisma.drafts`：`src/lib/rss/deduplicator.ts`、`src/lib/rss/ingest.ts`、`src/lib/services/sync-orchestrator.ts`、`src/lib/services/draft.ts`
- `prisma.rss_sources`：`src/lib/rss/ingest.ts`
- 枚举 `drafts_status`、`rss_sources_type` 仍在 `prisma/schema.prisma`
- `scripts/migrate-db.ts` 仍创建 `rss_sources` 表及索引
- `contents` 仍含 `drafts` 关系字段（`prisma/schema.prisma`）

### 旧去重工具的调用路径
- `src/lib/rss/deduplicator.ts` 被 `sync-orchestrator`、`rss/ingest`、`rss/aggregator`、`/api/rss/preview-aggregator`、`/api/rss/check-duplicate` 复用
  - `check-duplicate` 与 `preview-aggregator` 已额外查询 `inbox_items`

### 需要同步清理的前端/查询层
- 旧 drafts hooks 与组件仍存在：`src/hooks/queries/useDraftQueries.ts`、`src/components/drafts/*`
- 旧入口已重定向，但 `HeaderActions` / `quick-actions` 仍引用 `/content/drafts`
- `/api/drafts` 仍依赖 `DraftService`（`src/lib/services/draft.ts`）
