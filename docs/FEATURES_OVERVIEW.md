# Weekly 内容管理系统 - 功能概要

**文档目的**: 用一份短文档,概括 Weekly 内容管理系统的主要功能和当前重构进度,配合 `MAIN_PRD.md` 与 `TASKS.md` 使用。

---

## 1. 系统定位与角色

- **定位**: 为内容创作者提供「采集 → 编辑 → 组装周刊 → 发布 → 复盘」的一站式后台。
- **主要角色**:
  - 内容编辑: 日常使用草稿池、内容编辑器和周刊编辑器。
  - 管理员: 关注分析报表、操作日志、配置与权限。

---

## 2. 核心功能模块

### 2.1 登录与权限

- 登录页已迁移到 shadcn/ui,使用 `react-hook-form + zod` 做校验。
- 登录成功后进入 `(dashboard)` 区域,复用统一布局与导航。
- 使用 JWT + 中间件做权限控制,结合 Zustand 存储登录状态。

### 2.2 内容管理 (Blog / Weekly)

- **内容列表**:
  - 支持按类型、状态等筛选内容。
  - 通过 React Query 获取数据,具备加载/错误状态。
- **内容编辑器**:
  - 新版编辑页 `/content/[id]/page.tsx` 基于 shadcn/ui。
  - 支持两种内容类型:
    - Blog: 标题、描述、封面、SEO 信息等。
    - Weekly: 来源、来源链接、截图 API、推荐理由等。
  - 集成 Markdown 编辑器 + 实时预览,3 秒防抖自动保存。
  - 通过 `ContentFormatAdapter` 同时兼容 Markdown 字符串与 JSON 结构化内容。
- **内容预览**:
  - 统一的 `ContentPreview` 组件,自动检测内容格式并渲染。
  - 支持桌面/移动端预览模式、打印优化、代码高亮。
  - 预览底层已迁移为结构化数据渲染, `contents` 表新增 `image_url` 和 `summary` 字段, 对旧数据自动回退为 Markdown 渲染; 迁移与优化细节见 `docs/archive/MIGRATION_SUMMARY.md` 与 `docs/archive/STRUCTURED_PREVIEW_MIGRATION.md`。

### 2.3 草稿管理 (Karakeep 同步)

- 新版草稿页 `/content/drafts/page.tsx` 完全使用 shadcn/ui。
- **卡片视图**:
  - 使用 `DraftCard` 显示标题、来源、摘要、封面、AI 标签建议、优先级等。
  - 支持多选、批量操作 (采用/拒绝)。
- **快速预览**:
  - `DraftPreviewDialog` 以模式框展示完整内容,使用 `StructuredPreview` 渲染。
  - 显示 AI 分类/标签建议,便于判断价值。
- **筛选与搜索**:
  - `DraftFilters` 支持按状态、阶段、优先级、重复状态等多维筛选。
  - 支持排序和分页,参数与 URL 同步。
- **Karakeep 同步**:
  - 一键触发同步,Toast 显示新增/更新/未变化/错误等统计结果。
  - 基于 `drafts` 表设计,支持去重字段、AI 分类/标签建议和状态管理; 详细数据模型见 `docs/archive/草稿管理功能开发任务.md`。

### 2.4 周刊管理

- **周刊编辑器** `/weekly/editor/[id]/page.tsx`:
  - 三栏布局: 左侧内容池、中间周刊结构、右侧实时预览。
  - 使用 `@dnd-kit` 实现拖拽:
    - 从内容池拖入周刊结构。
    - 在中栏调整顺序。
  - 元信息表单使用 shadcn Input/Textarea/Select 构建:
    - 周刊期号、标题、描述、时间范围、状态等。
  - 实时预览展示最终读者看到的排版,突出精选内容。
- **周刊列表页** `/weekly/page.tsx`:
  - 保留原有基础列表功能,后续阶段计划迁移到 shadcn/ui。

### 2.5 搜索与分析

- **搜索** `/search/page.tsx`:
  - 基于 MeiliSearch 的全文搜索,支持 Blog 和 Weekly。
  - 搜索条件: 关键词、类型、状态、分类、标签等。
  - 目前页面仍使用 Ant Design 组件,计划在阶段 4 统一迁移到 shadcn/ui。
- **分析与仪表板**:
  - 仪表板 `/dashboard` 展示内容总量、发布趋势、分类与标签分布等。
  - 使用 Ant Design 卡片与图表组件,后续会按阶段 3 进行 UI 重构。

### 2.6 操作日志与运维

- **操作日志**:
  - Prisma schema 中 `operation_logs.resource_id` 已改为 `String?`,兼容多种 ID 类型。
  - `OperationLogService` 统一将 `resourceId` 转为字符串存储。
  - 页面 `/operation-logs` 提供筛选、导出、异常检测等功能(目前仍基于 Ant Design)。
- **配置校验与监控**:
  - `src/lib/config-validation.ts` 等工具确保关键环境变量正确配置。
  - 提供基本的启动检查脚本和错误处理封装。

### 2.7 API 设计与数据层

- **统一响应格式**: 所有后端接口遵循统一的 `{ success, data | error, meta }` 结构, 包括分页数据封装在 `data.items/total/page/...` 中, 便于前端通过类型守卫安全消费; 详细约定见 `docs/archive/API_RESPONSE_FORMAT.md`。
- **React Query 数据层**: 数据获取逐步统一到 React Query hooks + `api-client` 封装, 并按业务领域拆分到 `src/hooks/queries/*`; 更深入的重构计划和分阶段目标记录在 `docs/archive/react_query_refactor_plan.md`。

---

## 3. 重构阶段一览 (简版)

> 详细任务请参考 `TASKS.md`,这里只保留高层视角。

- **阶段 1: 基础设施和关键页面**
  - ✅ 完成 shadcn/ui + claude theme 安装与配置。
  - ✅ 完成设计系统文档与色彩/排版/间距规范。
  - ✅ 登录页、内容编辑页、内容预览页全部迁移到新 UI,并引入 `ContentFormatAdapter`。
- **阶段 2: 工作流简化**
  - ✅ 草稿管理重构 (卡片视图 + 快速预览 + 批量操作 + 同步)。
  - ✅ 周刊编辑器重构 (三栏工作台 + 拖拽 + 实时预览)。
  - ⏳ T2.3 路由结构优化、T2.4 数据流优化尚未开始。
- **阶段 3~5: 仪表板、其他页面和测试文档**
  - 仪表板、搜索页、设置/日志等仍主要使用 Ant Design,按计划在后续阶段迁移。
  - 系统级测试与最终文档整理 (T5.x) 也集中在后期完成。

---

## 4. 如何使用这些文档

- 想了解「为什么这么做」以及完整规划: 看 `MAIN_PRD.md`。
- 想知道「现在做到哪一步了」以及下一步是什么: 看 `TASKS.md`。
- 只想快速理解系统能做什么: 看本文件 `FEATURES_OVERVIEW.md` 即可。
