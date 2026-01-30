# 周刊自动化管理 - 研究发现

**关联任务**: `task_plan_weekly_automation.md`
**创建时间**: 2026-01-31

---

## 现有代码分析

### 1. 数据库模型

**周刊表 (`weekly_issues`)**:
- `id`, `issue_number` (唯一), `title`, `slug` (唯一)
- `start_date`, `end_date` - 周刊时间范围
- `status`: draft | published | archived
- `total_items`, `total_word_count`, `reading_time` - 统计字段
- `quail_*` - Quail 发布相关字段

**周刊内容关联表 (`weekly_content_items`)**:
- `weekly_issue_id`, `content_id` - 关联关系
- `sort_order`, `section`, `featured` - 排序和分类
- 唯一约束: `(weekly_issue_id, content_id)`

**内容表 (`contents`)**:
- `content_type_id = 3` 表示 Weekly 类型内容
- `status`: draft | ready | published | archived | hidden
- `created_at` - 用于判断内容归属周刊

### 2. 现有 API

**周刊列表**: `GET /api/weekly`
- 返回 `_count.weekly_content_items` 可用于显示内容数量

**周刊内容管理**: `PUT /api/weekly/[id]/contents`
- 已有批量更新周刊内容的逻辑
- 使用事务删除旧关联、创建新关联、更新统计

**周刊创建**: `POST /api/weekly`
- 自动计算期号 (最大期号 + 1)
- 生成 slug: `issue-{期号}`

### 3. 现有组件

**周刊列表页**: `src/app/(dashboard)/weekly/page.tsx`
- 已有状态徽章 (draft/published/archived)
- 已有内容数量显示 (`total_items`)
- 需要增强: 空周刊警告、当前周高亮、操作按钮

**周刊编辑器**: `src/components/weekly/WeeklyEditor.tsx`
- 三栏布局: 可用内容 | 已选内容 | 预览
- 使用拖拽排序
- 需要增强: 待关联提示、批量关联、完整度指示器

**内容详情页**: `src/app/(dashboard)/content/[id]/page.tsx`
- 使用 `SimplifiedEditor` 组件
- 需要增强: 添加周刊关联卡片

### 4. 数据现状

**空周刊**: 31 期 (第 47-77 期)
- 时间范围: 2025-05-18 ~ 2025-12-20
- 全部为 draft 状态

**未关联内容**:
- 空周刊时间范围内只有 8 篇内容
- 大部分内容在更早的时间创建

**有内容的周刊**: 第 1-46 期
- 每期平均 10-15 篇内容

---

## 技术决策

### 1. 时间匹配策略

使用 `created_at` 作为内容归属周刊的依据:
- 内容的 `created_at` 在周刊的 `start_date` ~ `end_date` 范围内
- 时间比较使用 UTC 时区

### 2. 周刊时间范围

- 周一 00:00:00 UTC 开始
- 周日 23:59:59 UTC 结束
- 使用 dayjs 处理时间计算

### 3. 内容筛选条件

回填和自动关联时的内容筛选:
- `content_type_id = 3` (Weekly 类型)
- `status IN ('ready', 'published')`
- 未关联到任何周刊 (`weekly_content_items` 中无记录)

### 4. API 认证

- 管理后台调用: 使用现有 `authMiddleware`
- Cron Job 调用: 使用 API Key (环境变量 `CRON_API_KEY`)

---

## 待确认问题

1. ~~内容归属依据: `created_at` vs `published_at`~~ → 已确认使用 `created_at`
2. ~~周刊起始日: 周一 vs 周日~~ → 已确认周一开始
3. ~~每期最大内容数~~ → 已确认 15 篇

---

## 参考资料

- PRD: `docs/weekly-automation-prd.md`
- 现有周刊 API: `src/app/api/weekly/`
- 周刊组织服务: `src/lib/ai/server/weekly-organizer.ts`
- 数据模型: `prisma/schema.prisma`

---

*最后更新: 2026-01-31*
