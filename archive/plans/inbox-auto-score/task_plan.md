# Task Plan: 收件箱自动评分功能

**Created**: 2026-02-01
**Design Reference**: [2026-02-01-inbox-auto-score-design.md](../2026-02-01-inbox-auto-score-design.md)
**Status**: `not_started`

---

## Goal

实现同步后自动对新条目进行 AI 评分，支持全局默认设置 + 数据源级别覆盖，统一收件箱的时间排序字段。

---

## Success Criteria

- [ ] 同步后自动对新条目进行 AI 评分（可配置）
- [ ] 支持全局开关 + 数据源级别覆盖
- [ ] 收件箱按统一的 `collected_at` 字段排序
- [ ] 数据源列表显示自动评分状态

---

## Phases

### Phase 1: 数据库变更
**Status**: `not_started`
**Estimated Tasks**: 5

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1.1 | 新建 `ai_settings` 表 | `pending` | key-value 结构存储全局设置 |
| 1.2 | `data_sources` 表添加 `auto_score_override` 字段 | `pending` | `Boolean?` 三态设计 |
| 1.3 | `inbox_items` 表添加 `collected_at` 字段 | `pending` | `DateTime?` 统一收集时间 |
| 1.4 | 运行数据库迁移 | `pending` | `pnpm db:push` 或创建迁移文件 |
| 1.5 | 回填 `collected_at` 数据 | `pending` | 现有数据使用 `created_at` |

**Acceptance Criteria**:
- [ ] `ai_settings` 表创建成功
- [ ] `data_sources.auto_score_override` 字段存在
- [ ] `inbox_items.collected_at` 字段存在
- [ ] 现有数据的 `collected_at` 已回填

**Files to Modify**:
- `prisma/schema.prisma`

---

### Phase 2: 后端服务 - AI 设置
**Status**: `not_started`
**Estimated Tasks**: 4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 2.1 | 创建 `AiSettingsService` | `pending` | 读写全局 AI 设置 |
| 2.2 | 创建 GET `/api/ai-settings` | `pending` | 获取所有 AI 设置 |
| 2.3 | 创建 PUT `/api/ai-settings/[key]` | `pending` | 更新单个设置 |
| 2.4 | 初始化默认设置 | `pending` | `auto_score_on_sync: { enabled: true }` |

**Acceptance Criteria**:
- [ ] 可以读取 AI 设置
- [ ] 可以更新 AI 设置
- [ ] 默认设置已初始化

**Files to Create**:
- `src/lib/services/ai-settings.ts`
- `src/app/api/ai-settings/route.ts`
- `src/app/api/ai-settings/[key]/route.ts`

---

### Phase 3: 后端服务 - 同步逻辑
**Status**: `not_started`
**Estimated Tasks**: 5

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.1 | 修改 `SyncOrchestrator` 支持自动评分判断 | `pending` | 读取全局设置 + 数据源覆盖 |
| 3.2 | 修改 RSS 同步逻辑设置 `collected_at` | `pending` | 首次同步时间 |
| 3.3 | 修改 Karakeep 同步逻辑设置 `collected_at` | `pending` | `bookmark.createdAt` |
| 3.4 | 更新数据源 API 支持 `auto_score_override` | `pending` | CRUD 操作 |
| 3.5 | 同步 API 返回评分统计 | `pending` | 已有 `preprocess_result` |

**Acceptance Criteria**:
- [ ] 同步时根据配置自动评分
- [ ] `collected_at` 正确设置
- [ ] 数据源可配置 `auto_score_override`

**Files to Modify**:
- `src/lib/services/sync-orchestrator.ts`
- `src/app/api/sources/route.ts`
- `src/app/api/sources/[id]/route.ts`

---

### Phase 4: 前端 - AI 设置页面
**Status**: `not_started`
**Estimated Tasks**: 3

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | 创建 AI 设置 React Query hooks | `pending` | `useAiSettings`, `useUpdateAiSetting` |
| 4.2 | AI 设置页面添加"自动化设置"卡片 | `pending` | 同步后自动评分开关 |
| 4.3 | 添加说明文字 | `pending` | 解释功能作用 |

**Acceptance Criteria**:
- [ ] AI 设置页面显示自动化设置卡片
- [ ] 可以切换同步后自动评分开关
- [ ] 设置保存成功

**Files to Modify**:
- `src/app/(dashboard)/settings/ai/page.tsx`

**Files to Create**:
- `src/hooks/queries/useAiSettingsQueries.ts`

---

### Phase 5: 前端 - 数据源管理
**Status**: `not_started`
**Estimated Tasks**: 4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 5.1 | 数据源列表显示自动评分状态 | `pending` | Badge: 跟随全局/开启/关闭 |
| 5.2 | 更新 `SourceConfigDialog` 添加自动评分设置 | `pending` | 三态选择器 |
| 5.3 | 更新数据源 hooks 支持 `auto_score_override` | `pending` | 类型定义 + API 调用 |
| 5.4 | 同步按钮显示评分结果 | `pending` | Toast 显示评分数量 |

**Acceptance Criteria**:
- [ ] 数据源列表显示自动评分状态
- [ ] 可以配置数据源的自动评分覆盖
- [ ] 同步后显示评分统计

**Files to Modify**:
- `src/app/(dashboard)/sources/page.tsx`
- `src/components/sources/source-config-dialog.tsx`
- `src/hooks/queries/useDataSourceQueries.ts`

---

### Phase 6: 前端 - 收件箱优化
**Status**: `not_started`
**Estimated Tasks**: 3

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 6.1 | 收件箱 API 按 `collected_at` 排序 | `pending` | 替换原有排序字段 |
| 6.2 | 收件箱列表显示 `collected_at` | `pending` | 时间列 |
| 6.3 | 更新收件箱类型定义 | `pending` | 添加 `collected_at` 字段 |

**Acceptance Criteria**:
- [ ] 收件箱按 `collected_at DESC` 排序
- [ ] 时间列显示收集时间

**Files to Modify**:
- `src/app/api/inbox/route.ts`
- `src/app/(dashboard)/inbox/page.tsx`
- `src/types/inbox.ts` (如存在)

---

### Phase 7: 测试验证
**Status**: `not_started`
**Estimated Tasks**: 4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 7.1 | 测试全局设置开关 | `pending` | 开启/关闭后同步验证 |
| 7.2 | 测试数据源级别覆盖 | `pending` | 三种状态验证 |
| 7.3 | 测试 Karakeep 同步 `collected_at` | `pending` | 验证收藏时间 |
| 7.4 | 测试 RSS 同步 `collected_at` | `pending` | 验证首次同步时间 |

**Acceptance Criteria**:
- [ ] 全局设置生效
- [ ] 数据源覆盖生效
- [ ] 时间字段正确

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `prisma/schema.prisma` | Modify | Phase 1 |
| `src/lib/services/ai-settings.ts` | Create | Phase 2 |
| `src/app/api/ai-settings/route.ts` | Create | Phase 2 |
| `src/app/api/ai-settings/[key]/route.ts` | Create | Phase 2 |
| `src/lib/services/sync-orchestrator.ts` | Modify | Phase 3 |
| `src/app/api/sources/route.ts` | Modify | Phase 3 |
| `src/app/api/sources/[id]/route.ts` | Modify | Phase 3 |
| `src/hooks/queries/useAiSettingsQueries.ts` | Create | Phase 4 |
| `src/app/(dashboard)/settings/ai/page.tsx` | Modify | Phase 4 |
| `src/app/(dashboard)/sources/page.tsx` | Modify | Phase 5 |
| `src/components/sources/source-config-dialog.tsx` | Modify | Phase 5 |
| `src/hooks/queries/useDataSourceQueries.ts` | Modify | Phase 5 |
| `src/app/api/inbox/route.ts` | Modify | Phase 6 |
| `src/app/(dashboard)/inbox/page.tsx` | Modify | Phase 6 |

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| (none yet) | - | - | - |

---

## Notes

- 评分失败不影响同步结果（记录错误但不中断）
- 只评分本次新增的条目（`ai_score = null`）
- 已有评分的条目不会重复评分
- 内容变化时保留原评分（不自动重新评分）

---

## Dependencies

- 现有 `scoreInboxItem` 函数 (`src/lib/ai/server/inbox-scorer.ts`)
- 现有 `SyncOrchestrator.preprocessNewItems` 方法

---

## Timeline

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | 数据库变更 | `not_started` |
| Phase 2 | 后端服务 - AI 设置 | `not_started` |
| Phase 3 | 后端服务 - 同步逻辑 | `not_started` |
| Phase 4 | 前端 - AI 设置页面 | `not_started` |
| Phase 5 | 前端 - 数据源管理 | `not_started` |
| Phase 6 | 前端 - 收件箱优化 | `not_started` |
| Phase 7 | 测试验证 | `not_started` |
