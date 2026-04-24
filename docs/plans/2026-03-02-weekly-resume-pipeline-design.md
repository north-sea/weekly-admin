# Weekly 断更后恢复：以 Karakeep→Inbox 为中心的“不断更”流水线设计

日期：2026-03-02

## 背景与问题定义

从现状数据看，断更的直接原因不是周刊关联规则，而是可用内容池不足：

- 大量 Karakeep 条目停留在 `inbox_items.pending` 且 `content_id = NULL`，没有被晋升为 `contents`。
- 周刊自动关联（`/api/weekly/auto-link` 等）依赖 `contents`（常见筛选为某些 `content_type` 且 `ready/published`），内容池空就“无货可取”。

本设计把“不断更”的核心动作收敛成：**每天稳定把 Karakeep 新增同步进收件箱 + 自动评分；人工只做一次性批量晋升确认。**

## 目标

- 每天一次（NAS cron）自动把 Karakeep Draft 列表的“新增条目”同步到 `inbox_items`。
- 同步后自动完成 AI 预处理（评分 + 相似度检测），让收件箱默认视图可“一键处理”。
- 人工动作保持可控：打开收件箱，按阈值智能勾选，点一次“批量晋升”→ 产出 `contents(draft)`。
- cron 可观测：同一次请求返回每个数据源的成功/失败、同步数量、评分数量，便于日志与告警。

## 非目标

- 不引入“自动晋升为 contents”的全自动策略（保留人工确认，避免误晋升）。
- 不在本设计内解决“周刊自动发布”的策略与内容校验（属于周刊发布链路）。
- 不扩展 RSS 的每日同步策略（本轮仅 Karakeep）。

## 方案概览（每日节奏）

1. NAS cron（每天一次）调用 `POST /api/sources/sync-all`：
   - 仅同步 Karakeep：`type: 'karakeep'`
   - 仅新增：`incremental: true`
   - 同步后自动预处理：`auto_preprocess: true`
   - 同步等待返回结果：`wait: true`
2. 你打开收件箱（默认 `pending` + `collected_at` 排序）：
   - 评分已生成，UI 默认阈值（例如 `>= 70`）智能勾选
   - 一键“批量晋升”→ 产出 `contents(draft)`，后续进入周刊编辑/关联流程

## API 设计：/api/sources/sync-all

文件：`src/app/api/sources/sync-all/route.ts`

### 新增请求参数

- `incremental?: boolean`：透传到单源同步逻辑（对 Karakeep 生效）。
- `auto_preprocess?: boolean`：透传到 `SyncOrchestrator.syncDataSource(..., { auto_preprocess })`。
- `wait?: boolean`：
  - `false | undefined`：保持现有行为（异步 fire-and-forget，立刻返回 started 信息）。
  - `true`：在同一请求内跑完所有匹配数据源，并返回每个源的执行结果（用于 cron）。

### wait:true 的响应形状（HTTP 200）

约定：即使存在失败也返回 200，通过 payload 表达失败，便于 cron 统一解析。

- `started_at`、`finished_at`
- `total_sources`、`ok_count`、`failed_count`
- `results[]`：每个源一个结果：
  - `source_id`、`name`
  - `ok: boolean`
  - `result?: SyncResult`（成功时，复用 `SyncOrchestrator.syncDataSource` 返回，含 `preprocess_result`）
  - `error?: string`（失败时）

### 失败策略

- `wait:true`：任何单源失败不阻断其他源，最后汇总返回。
- `wait:false`：仍按现有异步逻辑执行（失败仅记录服务端日志）。

## 同步器稳定性改造（核心）

文件：`src/lib/services/sync-orchestrator.ts`

### 1) 自动预处理“漏评分”问题（秒级 Timestamp 边界）

现状：`preprocessNewItems` 使用 `created_at >= since` 选取“新条目”，但 `created_at/synced_at` 是 `@db.Timestamp(0)`（秒级），可能出现：

- `syncStartedAt = 12:00:00.500`
- 新写入行的 `created_at = 12:00:00`（被截断到秒）
- 结果：`created_at < since`，该条目被错误排除，导致“同步了但没评分”。

建议修正：

- 预处理筛选改为以 `synced_at` 为主（更贴近“本次同步写入/更新”）。
- 对 `since` 做安全回退：`sinceFloorToSecond(syncStartedAt) - 2s`（避免同秒写入被漏掉）。

### 2) Karakeep incremental 的 last_synced_at 推进语义

增量过滤：`bookmark.createdAt > source.last_synced_at`。

风险：如果本次同步中存在非重复类错误，但仍把 `last_synced_at` 更新到“现在”，下次 `incremental:true` 可能永久跳过这些失败项。

约定（本轮选择）：

- **仅当本次同步无错误时**推进 `data_sources.last_synced_at`；
- 一旦存在非重复类错误：不推进 `last_synced_at`，允许下次重试（容忍重复 upsert 换稳定）。

## NAS Cron 建议（仅 Karakeep）

推荐 body：

```json
{ "type": "karakeep", "incremental": true, "auto_preprocess": true, "wait": true }
```

建议执行时间：每天早上 8:00（按你习惯可调整）。

## 验收标准（Definition of Done）

- cron 日志能看到 `ok_count/failed_count` 与每个源的 `upserted/preprocess_result`。
- 连续 3 天运行后：
  - 每天都有新增 `inbox_items.pending`（除非当天确实无新增）。
  - 同步后能看到新增条目的 `ai_score`（不会出现“新增但未评分”的偶发漏跑）。
  - 手动在收件箱“批量晋升”后，`contents(draft)` 数量稳定增长。

## 回滚与风险

- `wait` / `incremental` / `auto_preprocess` 全为可选参数，不影响既有 UI 调用路径。
- `wait:true` 会拉长请求耗时；cron 侧需设置足够 `curl --max-time`。
- 预处理包含 AI 调用，可能受速率限制；建议保持“每天一次”而非高频。

