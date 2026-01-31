# Findings & Decisions

## Requirements

### PRD 核心需求

**Epic 1: 标签治理**
- 1.1 标签分组管理 - 按类型分组（技术栈、主题、内容类型）
- 1.2 相似标签检测 - 创建时实时检测，基于编辑距离 + AI 语义
- 1.3 标签别名系统 - 每个标签可设置多个别名
- 1.4 智能标签合并建议 - AI 分析推荐可合并的相似标签
- 1.5 标签规范化工具 - 批量规范化命名

**Epic 2: 分类重构**
- 2.1 分类层级限制与可视化 - 树形视图，限制最大深度
- 2.2 拖拽排序优化 - 自动计算 sort_order
- 2.3 分类安全迁移 - 删除前迁移内容，支持归档
- 2.4 分类合并增强 - 保留关联数据，可撤销

**Epic 3: 效率提升**
- 3.1 增强标签选择器 - 常用置顶、最近使用、拼音搜索、键盘导航
- 3.2 增强分类选择器 - 树形下拉、搜索过滤、路径显示
- 3.3 批量标签操作 - 多选内容批量添加/移除标签

**Epic 4: 智能推荐**
- 4.1 内容编辑时标签推荐 - 基于标题/摘要，防抖 500ms
- 4.2 内容编辑时分类推荐 - 显示推荐理由
- 4.3 标签健康度报告 - 统计指标、重复检测、清理入口

### 成功指标

| 指标 | 目标值 |
|------|--------|
| 标签同义词重复率 | < 5% |
| 未使用标签占比 | < 10% |
| 标签选择平均耗时 | 减少 30% |
| AI 推荐采纳率 | > 60% |

## Research Findings

### 现有代码结构

**数据模型 (prisma/schema.prisma)**
- `tags` 表：id, name, slug, count, created_at, updated_at
- `categories` 表：id, name, slug, parent_id, sort_order, description
- `content_tags` 关联表：content_id, tag_id
- 需要新增：`tag_groups` 表，`tags.group_id`, `tags.aliases`

**现有标签管理页面** (`src/app/(dashboard)/settings/tags/page.tsx`)
- 已有功能：CRUD、搜索、分页、词云视图、合并向导、清理未使用
- 组件：TagCloud, TagStatsCard, UnusedTagsCleanupDialog, TagMergeWizard
- 使用 React Query hooks: useTagList, useCreateTag, useUpdateTag, useDeleteTag

**现有分类管理页面** (`src/app/(dashboard)/settings/categories/page.tsx`)
- 已有功能：CRUD、搜索、树形视图、网格视图、合并向导、拖拽移动
- 组件：CategoryTree, CategoryMergeWizard
- 使用 React Query hooks: useCategoryList, useCreateCategory, etc.

**AI 服务** (`src/lib/ai/server/inbox-scorer.ts`)
- 使用 `serverGenerateJSON` 调用 AI
- 使用 `AiPromptService.getByScene` 获取 prompt
- 使用 `renderPromptTemplate` 渲染模板
- 返回结构化 JSON 响应

### 技术选型

**拼音搜索库对比**
| 库 | 大小 | 多音字 | 维护 |
|----|------|--------|------|
| pinyin-pro | 小 | 支持 | 活跃 |
| pinyin | 中 | 支持 | 一般 |
| tiny-pinyin | 极小 | 不支持 | 停止 |

选择：**pinyin-pro** - 功能完整，体积适中

**相似度算法**
- Levenshtein 距离：适合拼写错误检测
- Jaro-Winkler：适合短字符串
- AI 语义相似度：适合同义词检测

方案：先用 Levenshtein 快速过滤，再用 AI 精确判断

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 标签组扁平结构 | 简化实现，满足当前需求 |
| 别名存储为 JSON | 灵活，无需额外表，查询简单 |
| 分类归档软删除 | 数据安全，可恢复 |
| 客户端拼音搜索 | 减少服务端压力，响应更快 |
| localStorage 存最近使用 | 用户级数据，无需服务端 |
| 复用 AI 服务模式 | 代码一致性，减少维护成本 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
|       |            |

## Resources

### 关键文件路径

**数据模型**
- `prisma/schema.prisma` - 数据库模型定义

**标签相关**
- `src/app/(dashboard)/settings/tags/page.tsx` - 标签管理页面
- `src/components/tags/` - 标签组件目录
- `src/hooks/queries/useTagQueries.ts` - 标签 React Query hooks
- `src/app/api/tags/` - 标签 API 路由

**分类相关**
- `src/app/(dashboard)/settings/categories/page.tsx` - 分类管理页面
- `src/components/categories/` - 分类组件目录
- `src/hooks/queries/useCategoryQueries.ts` - 分类 React Query hooks
- `src/app/api/categories/` - 分类 API 路由

**AI 服务**
- `src/lib/ai/server/client.ts` - AI 客户端
- `src/lib/ai/server/inbox-scorer.ts` - 评分服务（参考实现）
- `src/lib/services/ai-prompt.ts` - Prompt 管理服务

**内容编辑**
- `src/app/(dashboard)/content/` - 内容管理页面
- `src/components/content/` - 内容组件目录

### PRD 参考

- PRD 文档: `docs/tags-categories-optimization-prd.md`

## Visual/Browser Findings

*暂无*

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
