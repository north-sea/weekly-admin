# Findings: 收件箱自动评分功能

**Task**: 收件箱自动评分功能
**Started**: 2026-02-01

---

## 现有代码分析

### 1. 评分服务 (`inbox-scorer.ts`)

**位置**: `src/lib/ai/server/inbox-scorer.ts`

**关键函数**:
- `scoreInboxItem(itemId)` - 单条评分
- `batchScoreInboxItems(itemIds)` - 批量评分

**评分条件**: 只评分 `ai_score = null` 的条目

---

### 2. 同步服务 (`sync-orchestrator.ts`)

**位置**: `src/lib/services/sync-orchestrator.ts`

**现有逻辑**:
- `SyncOptions.auto_preprocess` 选项存在，但默认 `false`
- `preprocessNewItems()` 方法已实现，包含评分和相似度检测
- 同步 API 未传递 `auto_preprocess` 参数

**Upsert 行为**:
- `ai_score` 不在 update 字段中
- 内容变化时保留原有评分

---

### 3. Karakeep API (`karakeep-api.ts`)

**位置**: `src/lib/services/karakeep-api.ts`

**时间字段**:
- `bookmark.createdAt` - 收藏时间（用于 `collected_at`）
- `bookmark.modifiedAt` - 修改时间
- `content.datePublished` - 原文发布时间

---

### 4. 数据库模型 (`schema.prisma`)

**现有时间字段** (`inbox_items`):
- `source_published_at` - 原文发布时间
- `synced_at` - 最后同步时间
- `created_at` - 记录创建时间
- `updated_at` - 记录更新时间

**需要新增**:
- `collected_at` - 统一收集时间

---

## 设计决策

| 决策 | 选项 | 理由 |
|------|------|------|
| 全局设置存储 | `ai_settings` 表 | 复用 AI 设置页面，无需新建设置模块 |
| 数据源级别覆盖 | `null` 表示跟随全局 | 三态设计，灵活且语义清晰 |
| 内容变化处理 | 保留原评分 | 避免不必要的 API 调用，用户可手动触发 |
| 时间字段 | 统一 `collected_at` | 简化排序逻辑，一个字段满足所有来源 |

---

## 技术要点

### `collected_at` 值来源

| 数据源类型 | `collected_at` 值 |
|------------|-------------------|
| Karakeep | `bookmark.createdAt`（收藏时间） |
| RSS | 首次同步时间（`synced_at` 或 `created_at`） |

### 自动评分判断逻辑

```
1. 检查数据源 `auto_score_override`
   - `true` → 强制开启
   - `false` → 强制关闭
   - `null` → 继续检查全局设置

2. 检查全局设置 `ai_settings.auto_score_on_sync`
   - `{ enabled: true }` → 开启
   - `{ enabled: false }` → 关闭
```

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `src/lib/ai/server/inbox-scorer.ts` | 评分服务 |
| `src/lib/services/sync-orchestrator.ts` | 同步编排 |
| `src/lib/services/karakeep-api.ts` | Karakeep API |
| `prisma/schema.prisma` | 数据库模型 |
| `src/app/(dashboard)/sources/page.tsx` | 数据源列表页 |
| `src/components/sources/source-config-dialog.tsx` | 数据源配置对话框 |
| `src/app/(dashboard)/settings/ai/page.tsx` | AI 设置页面 |
