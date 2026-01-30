# Progress: 统一数据源管理系统重构

## Session Log

### 2026-01-28 - 需求分析与计划制定

**完成内容**：
1. ✅ 分析现有代码结构
   - 阅读 `prisma/schema.prisma` - 了解 drafts、rss_sources、contents 表结构
   - 阅读 `src/lib/services/draft.ts` - 了解 Karakeep 同步逻辑
   - 阅读 `src/lib/rss/ingest.ts` - 了解 RSS 入库逻辑

2. ✅ 确认需求
   - 新状态命名: `ready`
   - drafts 表处理: 重命名为 `inbox_items`
   - 页面结构: 新建 `/sources` 页面
   - 自动晋升阈值: 可配置

3. ✅ 制定详细计划
   - 创建 `task_plan_unified_sources.md`
   - 创建 `findings_unified_sources.md`
   - 创建 `progress_unified_sources.md`

**发现的问题**：
- drafts 表和 contents 表的"草稿"概念重复
- Karakeep 和 RSS 两条数据流不统一
- 转换时标签丢失
- 缺少统一的 AI 评分机制

---

### 2026-01-28 - Phase 1.1/1.2 实施（Schema + 迁移脚本）

**完成内容**：
1. ✅ 更新 Prisma Schema
   - 新增 `data_sources` / `inbox_items` 模型与关系
   - 新增 `DataSourceType` / `InboxStatus` 枚举
   - `contents.status` 增加 `ready`

2. ✅ 更新数据库初始化迁移脚本
   - `scripts/migrate-db.ts`：创建 `data_sources`、`inbox_items` 表
   - `scripts/migrate-db.ts`：扩展 `contents.status` 枚举支持 `ready`

3. ✅ 新增一次性数据迁移脚本
   - `scripts/migrate-to-unified-sources.ts`：迁移 `rss_sources` → `data_sources`、`drafts` → `inbox_items`

**待验证**：
- 运行 `pnpm db:generate` / `pnpm type-check`
- 在本地数据库执行 `pnpm tsx scripts/migrate-to-unified-sources.ts`（默认 dry-run）
- 确认备份后执行 `pnpm tsx scripts/migrate-to-unified-sources.ts --apply`

---

### 2026-01-28 - Phase 1.3 执行迁移（用户已完成）

**完成内容**：
- ✅ 已按步骤备份并执行 `scripts/migrate-to-unified-sources.ts --apply`，数据已刷新到新表

---

### 2026-01-28 - Phase 2 服务层重构（基础完成）

**完成内容**：
- ✅ 新增 `DataSourceService` / `InboxService` / `SyncOrchestrator`
- ✅ 新增 Zod 校验：`src/lib/validations/data-source.ts`、`src/lib/validations/inbox.ts`

**待验证**：
- 后续在 Phase 3 API 路由中接入并进行接口级验证

---

### 2026-01-28 - Phase 3 API 路由重构（进行中）

**完成内容**：
- ✅ 新增 `/api/sources/*`：数据源 CRUD + 单源同步 + 全部同步
- ✅ 新增 `/api/inbox/*`：列表 + 统计 + 详情更新 + 晋升 + 批量操作

**补充完成**：
- ✅ 旧路由废弃/兼容：`/api/rss/*`、`/api/drafts/*` 已改为适配新数据源/收件箱或返回 410

---

### 2026-01-28 - Phase 4 前端重构（部分完成）

**完成内容**：
- ✅ 新增 `/sources` 数据源管理页面
- ✅ 新增 `/inbox` 收件箱页面
- ✅ 新增 React Query Hooks：`useDataSourceQueries` / `useInboxQueries`
- ✅ 更新侧边栏导航：RSS/草稿入口替换为数据源/收件箱

**补充完成**：
- ✅ 内容管理支持 `ready` 状态（筛选 + 编辑表单校验）
- ✅ 周刊可用内容/AI 组织候选改为使用 `ready` 状态

---

### 2026-01-28 - Phase 5.1 清理（旧入口重定向）

**完成内容**：
- ✅ `/rss` 入口重定向到 `/sources`
- ✅ `/content/drafts` 入口重定向到 `/inbox`

---

### 2026-01-28 - Phase 5.2 清理准备（旧表引用盘点）

**完成内容**：
- ✅ 盘点 `rss` 去重/入库逻辑仍引用 `drafts`/`rss_sources`
- ✅ `/api/drafts` 仅列表路由仍依赖 `DraftService`（其余已映射 inbox）
- ✅ 识别旧 drafts Hooks/组件与快捷入口引用
- ✅ 定位 `DraftService` 主要用于 editor/inbox/all 混合列表
- ✅ 快捷入口指向 `/content/drafts`（需改为 `/inbox`）
- ✅ useApi 中仍含 drafts queryKeys/invalidations
- ✅ 确认 `ingestRssSource`/`drafts_status` 等旧引用已清零
- ✅ 校验清理相关文件变更位置（schema/api/hooks/rss/导航）

---

### 2026-01-28 - Phase 5.2 清理执行（删除旧表/冗余代码）

**完成内容**：
- ✅ Prisma 移除 `drafts` / `rss_sources` 模型与枚举
- ✅ RSS 去重改为基于 `inbox_items`，移除旧 `rss/ingest.ts`
- ✅ 移除 `DraftService` 与旧 drafts hooks/组件
- ✅ `/api/drafts` 列表路由改为直接查询 contents/inbox
- ✅ 快捷入口统一指向 `/inbox`

**执行结果**：
- ✅ 用户已在可访问 DB 环境执行并确认旧表删除

---

### 2026-01-28 - Phase 5.3 类型定义更新

**完成内容**：
- ✅ Content 状态类型补齐 `ready/hidden`
- ✅ RSS 去重类型改为 `inbox` 语义，并保留 `from_drafts` 兼容字段
- ✅ SyncOrchestrator 补充去重来源统计，/api/rss/fetch 返回新字段

---

### 2026-01-28 - Phase 5.4 测试验证（执行中）

**执行内容**：
- ✅ 运行 `pnpm type-check`

**结果**：
- ✅ `pnpm type-check` 通过

## Phase 执行记录

### Phase 1: 数据库模型设计与迁移

**状态**: in_progress

**待执行任务**:
- [x] 1.1 更新 Prisma Schema
- [x] 1.2 创建数据迁移脚本
- [ ] 1.3 执行迁移并验证

#### 1.1 更新 Prisma Schema

**文件**: `prisma/schema.prisma`

**变更内容**:

1. 添加新枚举:
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

2. 修改 contents_status 枚举 (添加 ready):
```prisma
enum contents_status {
  draft
  ready      // 新增
  published
  archived
  hidden
}
```

3. 创建 data_sources 模型 (详见 findings_unified_sources.md)

4. 创建 inbox_items 模型 (详见 findings_unified_sources.md)

5. 更新 contents 模型关系:
```prisma
model contents {
  // ... 现有字段
  inbox_items  inbox_items[]  // 新增关系
}
```

6. 更新 categories 模型关系:
```prisma
model categories {
  // ... 现有字段
  data_sources  data_sources[]  // 新增关系
}
```

**验证命令**:
```bash
pnpm db:generate
pnpm type-check
```

---

#### 1.2 创建数据迁移脚本

**文件**: `scripts/migrate-to-unified-sources.ts`

**功能**:
1. 创建新表 (data_sources, inbox_items)
2. 迁移 rss_sources → data_sources
3. 创建 Karakeep 数据源记录
4. 迁移 drafts → inbox_items
5. 验证数据完整性
6. (可选) 删除旧表

**执行命令**:
```bash
pnpm tsx scripts/migrate-to-unified-sources.ts
# 确认备份后：
pnpm tsx scripts/migrate-to-unified-sources.ts --apply
```

---

#### 1.3 执行迁移并验证

**步骤**:
1. 备份数据库
2. 执行迁移脚本
3. 验证数据完整性
4. 更新 Prisma Client

---

### Phase 2: 服务层重构

**状态**: pending

(待 Phase 1 完成后填写)

---

### Phase 3: API 路由重构

**状态**: pending

(待 Phase 2 完成后填写)

---

### Phase 4: 前端重构

**状态**: pending

(待 Phase 3 完成后填写)

---

### Phase 5: 清理与优化

**状态**: pending

(待 Phase 4 完成后填写)

---

## Test Results

- ✅ `pnpm prisma validate` 通过
- ✅ `pnpm prisma generate` 通过
- ❌ `pnpm type-check` 当前仓库存在多处历史 TS 报错（需单独清理，不阻塞本次 Phase 1.1/1.2）

---

## Errors Encountered

| 时间 | 错误 | 解决方案 |
|------|------|----------|
| 2026-01-28 | `pnpm type-check` 报错（多处历史问题） | 记录清单，后续集中修复；本次仅保证 Prisma schema valid |

---

## Notes

- 每完成一个子任务，更新对应的 checkbox
- 遇到错误立即记录到 Errors Encountered
- 重要发现记录到 findings_unified_sources.md
