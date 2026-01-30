# Task Plan: 统一数据源管理系统重构

## Goal

将 RSS 和 Karakeep 等多个数据获取渠道统一管理，实现：数据源(data_sources) → 收件箱(inbox_items) → 内容库(contents, status=draft) → 就绪状态(status=ready) → 周刊组织 的完整流程。

## Current Phase

Phase 5

---

## 背景与现状分析

### 现有问题

1. **概念重复**：
   - `drafts` 表：专门存储 Karakeep 同步的数据，有 `pending/adopted/rejected` 状态
   - `contents` 表：有 `draft/published/archived/hidden` 状态
   - 两个"草稿"概念混淆

2. **流程割裂**：
   - Karakeep 数据 → `drafts` 表 → 转换 → `contents` 表 (status=draft)
   - RSS 数据 → 直接进入 `contents` 表 (status=draft)
   - 两条路径不统一

3. **标签丢失**：转换时 Karakeep 标签未完整保留

4. **缺少统一打分**：`drafts` 表没有评分机制，RSS 入库时也没有自动打分

### 目标数据流

```
数据源 (RSS/Karakeep/其他)
    ↓ (抓取/同步)
inbox_items 表 (待处理池)
    ↓ (AI 打分 + 自动分类/标签)
    ↓ (高分自动 / 手动采纳)
contents 表 (status: draft)
    ↓ (编辑确认)
contents 表 (status: ready)
    ↓ (周刊组织 - 从旧到新选择)
weekly_content_items 表
    ↓ (发布)
contents 表 (status: published)
```

---

## Phases

### Phase 1: 数据库模型设计与迁移
- [x] 1.1 更新 Prisma Schema - 添加新枚举和模型
- [x] 1.2 创建数据迁移脚本
- [x] 1.3 执行迁移并验证
- **Status:** complete

### Phase 2: 服务层重构
- [x] 2.1 创建数据源服务 (DataSourceService)
- [x] 2.2 创建收件箱服务 (InboxService)
- [x] 2.3 创建统一同步服务 (SyncOrchestrator)
- [x] 2.4 创建验证 Schema
- **Status:** complete

### Phase 3: API 路由重构
- [x] 3.1 创建数据源 API (/api/sources/*)
- [x] 3.2 创建收件箱 API (/api/inbox/*)
- [x] 3.3 废弃旧 API (添加重定向)
- **Status:** complete

### Phase 4: 前端重构
- [x] 4.1 创建数据源管理页面
- [x] 4.2 重构收件箱页面
- [x] 4.3 更新内容管理页面 (支持 ready 状态)
- [x] 4.4 更新周刊管理 (筛选 ready 状态)
- [x] 4.5 创建 React Query Hooks
- [x] 4.6 更新导航菜单
- **Status:** complete

### Phase 5: 清理与优化
- [x] 5.1 删除废弃代码（旧入口页面重定向）
- [x] 5.2 数据库清理 (删除旧表)
- [x] 5.3 更新类型定义
- [x] 5.4 测试验证
- **Status:** complete

---

## Key Questions (已确认)

| 问题 | 答案 |
|------|------|
| 新状态命名？ | `ready` |
| drafts 表处理方式？ | 重命名为 `inbox_items`，作为统一待处理池 |
| 页面结构？ | 新建 `/sources` 页面统一管理数据源 |
| 自动晋升阈值？ | 可配置，存储在 `data_sources.auto_promote_threshold` |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 重命名 `drafts` 为 `inbox_items` | 更直观表达"待处理池"概念 |
| 重命名 `rss_sources` 为 `data_sources` | 支持多种数据源类型 |
| `contents.status` 增加 `ready` | 区分"编辑中草稿"和"可用于周刊"的内容 |
| 自动晋升阈值存储在数据源配置中 | 不同数据源可有不同阈值 |
| 保留 `source_item_id` 字段 | 存储源系统 ID (karakeep_id, rss guid 等) |
| Phase 1 先新增表（不立即删旧表） | 降低风险，保持现有 RSS/Karakeep 逻辑可用 |

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `pnpm type-check` 多处历史报错 | 1 | 暂不在本次重构范围内；先保证 Prisma schema valid |
| session-catchup 脚本路径不存在 | 1 | 使用 `/Users/yqg/.codex/skills/planning-with-files-skill/scripts/session-catchup.py` |
| 数据库不可达 `100.113.231.101:3306` | 1 | 已在可连接环境执行 `node scripts/drop-legacy-tables.js --apply` |
| `pnpm type-check` 仍有历史错误 | 2 | 记录在 `progress_unified_sources.md`，可另起修复任务 |

---

## Notes

- 每个 Phase 完成后更新状态为 `complete`
- 执行前先阅读相关现有代码
- 数据迁移前务必备份数据库
- `scripts/migrate-to-unified-sources.ts` 默认 dry-run；确认备份后用 `--apply` 执行写入
- 保持向后兼容，旧 API 添加重定向而非直接删除
- 删除旧表需要在数据库执行 DROP（或通过迁移脚本完成）
