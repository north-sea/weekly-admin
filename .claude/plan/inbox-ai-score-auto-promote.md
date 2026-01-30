# Inbox AI 评分与自动晋升功能计划

## 需求概述

1. **AI 评分**: 复用 `summary_score` prompt，使用 AI 对摘要进行评分 (0-100)
2. **自动晋升**: 评分 >= 阈值时自动晋升到内容库（阈值可配置）
3. **Karakeep 同步**: 晋升后同步 Karakeep 列表状态
4. **评分传递**: 晋升时将 ai_score 传递到 contents.original_score
5. **收集时间**: 内容列表展示收集时间
6. **前端调整**: Inbox 列表默认从旧到新，添加评分筛选，添加"批量评分"按钮
7. **同步频率**: 接口支持传参数，不同源可配置不同同步频率

---

## Phase 1: AI 评分模块

### 1.1 创建 Inbox 评分服务

**文件**: `src/lib/ai/server/inbox-scorer.ts` (新建)

复用 `summary-scorer.ts` 的逻辑，适配 inbox_items 表：

```typescript
import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { renderPromptTemplate } from '@/lib/ai/server/prompt-template';

const ScoreSchema = z.object({
  overall: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  accuracy: z.number().min(0).max(10),
  conciseness: z.number().min(0).max(10),
  reasons: z.array(z.string().min(1)).min(1).max(8),
});

export type InboxScore = z.infer<typeof ScoreSchema>;

/**
 * 对 inbox item 的摘要进行 AI 评分
 *
 * 特殊规则:
 * - 无摘要或 Karakeep 爬取失败 (summarization_status !== 'success') → 评分 = 0
 * - AI 返回 0-10 分
 */
export async function scoreInboxItem(inboxId: bigint): Promise<InboxScore | null>
```

**评分逻辑**:
1. 检查 `summarization_status`，如果不是 `success` 则直接返回 0 分
2. 检查 `summary` 是否存在，无摘要则返回 0 分
3. 使用 `summary_score` prompt 调用 AI 评分
4. AI 返回 0-10 分，存储时 `ai_score = overall ` (0-10)

### 1.2 创建批量评分 API

**文件**: `src/app/api/inbox/score-batch/route.ts` (新建)

```typescript
// POST /api/inbox/score-batch - 批量评分未评分的 inbox items
// 参数: { limit?: number } - 默认 50 条
// 返回: { scored: number, failed: number, errors: string[] }
```

### 1.3 同步时不自动评分

由于 AI 评分需要调用外部 API，同步时不自动评分，改为：
- 同步后用户手动点击"批量评分"按钮
- 或通过外部 cron 定时调用 `/api/inbox/score-batch`

---

## Phase 2: 自动晋升模块

### 2.1 创建自动晋升 API

**文件**: `src/app/api/inbox/auto-promote/route.ts` (新建)

```typescript
// POST /api/inbox/auto-promote - 自动晋升高分 inbox items
// 参数: { source_id?: number, threshold?: number }
// - 如果传 source_id，只处理该数据源的 items，使用该源的 auto_promote_threshold
// - 如果传 threshold，覆盖数据源的阈值
// 返回: { promoted: number, failed: number, errors: string[] }
```

### 2.2 数据源管理页面添加阈值配置

**文件**: `src/app/(dashboard)/sources/page.tsx`

在表格中添加:
- 自动晋升阈值列
- 可编辑的阈值输入框 (0-10 或留空禁用)

### 2.3 数据源同步频率配置

**文件**: `prisma/schema.prisma`

在 data_sources 表添加:
```prisma
sync_interval_minutes Int? @default(60)  // 同步间隔（分钟），null 表示不自动同步
```

**文件**: `src/app/api/sources/sync-all/route.ts`

修改接口支持按频率筛选:
```typescript
// POST /api/sources/sync-all
// 参数: {
//   type?: string,
//   max_items?: number,
//   similarity_check?: boolean,
//   only_due?: boolean  // 新增：只同步到期的数据源
// }
```

逻辑：如果 `only_due=true`，只同步 `last_synced_at + sync_interval_minutes < now()` 的数据源

---

## Phase 3: 晋升时同步 Karakeep

### 3.1 修改 InboxService.promoteInboxItem

**文件**: `src/lib/services/inbox.ts`

从 `/api/drafts/[id]/convert/route.ts` 复用逻辑:
1. 晋升后检查是否为 Karakeep 数据源
2. 添加到 KARAKEEP_WEEKLY_LIST_ID
3. 从 KARAKEEP_DRAFT_LIST_ID 移除
4. 归档书签

### 3.2 传递评分到内容库

**文件**: `src/lib/services/inbox.ts`

在 `promoteInboxItem` 中:
- 将 `inbox_items.ai_score` 传递到 `contents.original_score`

---

## Phase 4: 内容列表展示收集时间

### 4.1 数据库迁移

**文件**: `prisma/schema.prisma`

在 contents 表添加:
```prisma
collected_at DateTime? @db.Timestamp(0)
```

### 4.2 修改晋升逻辑

**文件**: `src/lib/services/inbox.ts`

晋升时设置 `collected_at = inbox_items.synced_at`

### 4.3 修改内容列表页面

**文件**: `src/app/(dashboard)/content/list/page.tsx`

- 将"创建时间"列改为"收集时间"
- 显示 `collected_at`，fallback 到 `created_at`

---

## Phase 5: 前端调整

### 5.1 Inbox 列表默认排序

**文件**: `src/app/(dashboard)/inbox/page.tsx`

修改默认 filters:
```typescript
sortOrder: 'asc',  // 从旧到新
```

### 5.2 添加评分筛选 UI

**文件**: `src/app/(dashboard)/inbox/page.tsx`

添加:
- 评分范围筛选 (最低分 Select)
- 表格中显示评分列

### 5.3 添加"批量评分"按钮

**文件**: `src/app/(dashboard)/inbox/page.tsx`

在页面顶部操作区添加按钮:
- Label: "AI 评分" 或 "评分未处理"
- 点击后调用 `/api/inbox/score-batch`
- 显示评分进度和结果

---

## Phase 6: 存量数据刷新

### 6.1 创建刷新脚本

**文件**: `scripts/backfill-inbox-scores.ts` (新建)

```bash
pnpm tsx scripts/backfill-inbox-scores.ts --dry-run
pnpm tsx scripts/backfill-inbox-scores.ts --limit 100
pnpm tsx scripts/backfill-inbox-scores.ts
```

功能:
1. 遍历所有 `ai_score IS NULL AND status = 'pending'` 的 inbox_items
2. 调用 AI 评分并更新
3. 支持 --dry-run 预览
4. 支持 --limit 限制数量
5. 支持 --delay 控制请求间隔（避免 API 限流）

### 6.2 创建内容收集时间回填脚本

**文件**: `scripts/backfill-content-collected-at.ts` (新建)

功能:
1. 遍历所有 `collected_at IS NULL` 的 contents
2. 通过 inbox_items 关联查找 synced_at
3. 更新 collected_at

---

## Phase 7: 自动同步 (Cron)

### 7.1 外部 Cron 配置

推荐使用系统 crontab 或 Docker cron 定时调用 API。

**示例 crontab**:
```bash
# 每小时同步一次（只同步到期的数据源）
0 * * * * curl -X POST http://localhost:3000/api/sources/sync-all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"only_due": true, "max_items": 50}'

# 每 6 小时批量评分一次
0 */6 * * * curl -X POST http://localhost:3000/api/inbox/score-batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# 每天凌晨自动晋升高分内容
0 2 * * * curl -X POST http://localhost:3000/api/inbox/auto-promote \
  -H "Authorization: Bearer $TOKEN"
```

### 7.2 数据源同步频率配置

在数据源管理页面添加:
- 同步间隔配置 (分钟)
- 常用选项: 30分钟 / 1小时 / 6小时 / 12小时 / 24小时 / 不自动同步

---

## 实施顺序

1. [ ] Phase 1: AI 评分模块 (inbox-scorer.ts + score-batch API)
2. [ ] Phase 5.3: 前端添加"AI 评分"按钮
3. [ ] Phase 6.1: 存量数据刷新脚本
4. [ ] Phase 2: 自动晋升模块 (auto-promote API + 阈值配置 UI)
5. [ ] Phase 3: 晋升时同步 Karakeep
6. [ ] Phase 4: 内容列表展示收集时间
7. [ ] Phase 5.1-5.2: 前端调整 (排序 + 评分筛选)
8. [ ] Phase 7: 同步频率配置 + Cron 示例

---

## 文件变更清单

### 新建文件
- `src/lib/ai/server/inbox-scorer.ts` - Inbox AI 评分服务
- `src/app/api/inbox/score-batch/route.ts` - 批量评分 API
- `src/app/api/inbox/auto-promote/route.ts` - 自动晋升 API
- `scripts/backfill-inbox-scores.ts` - 存量评分脚本
- `scripts/backfill-content-collected-at.ts` - 收集时间回填脚本

### 修改文件
- `prisma/schema.prisma` - 添加 collected_at 字段 + sync_interval_minutes 字段
- `src/lib/services/inbox.ts` - 晋升时同步 Karakeep + 传递评分 + 设置 collected_at
- `src/app/api/sources/sync-all/route.ts` - 支持 only_due 参数
- `src/app/(dashboard)/sources/page.tsx` - 添加阈值配置 + 同步频率配置 UI
- `src/app/(dashboard)/inbox/page.tsx` - 默认排序 + 评分筛选 + AI 评分按钮
- `src/app/(dashboard)/content/list/page.tsx` - 展示收集时间
- `src/lib/services/content.ts` - 查询时包含 collected_at
- `src/lib/validations/data-source.ts` - 添加 sync_interval_minutes 字段
- `src/hooks/queries/useInboxQueries.ts` - 添加 score-batch mutation

---

## 风险与注意事项

1. **AI API 限流**: 批量评分时需要控制并发和请求间隔
2. **Karakeep API 限流**: 自动晋升批量操作时需要控制并发
3. **数据库迁移**: 添加 collected_at 和 sync_interval_minutes 字段需要执行 prisma migrate
4. **存量数据**: 刷新脚本需要在低峰期执行，避免影响线上服务
5. **评分成本**: AI 评分会产生 API 调用费用，需要合理控制批量评分的频率和数量
