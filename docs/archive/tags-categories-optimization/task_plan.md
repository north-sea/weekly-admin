# Task Plan: 标签与分类管理优化

## Goal

实现标签与分类管理系统的全面优化，包括标签治理（分组、别名、相似检测）、分类重构（层级限制、拖拽排序、安全迁移）、效率提升（增强选择器）和智能推荐（AI 标签/分类推荐），最终减少内容管理者 30%+ 的操作时间。

## Current Phase

Phase 15 (pending)

## Phases

### Phase 1: 数据模型与基础设施 (MVP 基础)
- [x] 1.1 设计并创建 `tag_groups` 表
- [x] 1.2 扩展 `tags` 表（添加 `group_id`, `aliases` 字段）
- [x] 1.3 扩展 `categories` 表（添加 `archived` 字段用于归档）
- [x] 1.4 创建数据库迁移脚本
- [x] 1.5 更新 Prisma schema 并生成客户端
- [x] 1.6 创建基础 API 路由结构
- **Status:** complete
- **Dependencies:** 无
- **Deliverables:**
  - `prisma/schema.prisma` 更新
  - 数据库迁移文件
  - 基础类型定义

### Phase 2: 标签分组管理 (Story 1.1)
- [x] 2.1 创建标签组 CRUD API (`/api/tag-groups`) - Phase 1 已完成
- [x] 2.2 创建标签组管理 UI 组件 (`TagGroupManager`)
- [x] 2.3 更新标签列表支持按组筛选
- [x] 2.4 更新标签创建/编辑表单支持选择组
- [x] 2.5 创建 React Query hooks (`useTagGroupQueries`)
- **Status:** complete
- **Dependencies:** Phase 1
- **Deliverables:**
  - `src/app/api/tag-groups/route.ts`
  - `src/components/tags/TagGroupManager.tsx`
  - `src/hooks/queries/useTagGroupQueries.ts`

### Phase 3: 标签别名系统 (Story 1.3)
- [x] 3.1 创建标签别名 API 端点
- [x] 3.2 更新标签编辑 UI 支持管理别名
- [x] 3.3 更新标签搜索逻辑支持别名匹配
- [x] 3.4 合并标签时自动转换为别名
- **Status:** complete
- **Dependencies:** Phase 1
- **Deliverables:**
  - `src/app/api/tags/[id]/aliases/route.ts`
  - `src/components/tags/TagAliasEditor.tsx`

### Phase 4: 相似标签检测 (Story 1.2)
- [x] 4.1 实现 Levenshtein 距离算法
- [x] 4.2 创建相似标签检测 API (`/api/tags/detect-similar`)
- [x] 4.3 集成 AI 语义相似度检测（复用现有 AI 服务）
- [x] 4.4 创建相似标签警告 UI 组件
- [x] 4.5 在标签创建时实时检测
- **Status:** complete
- **Dependencies:** Phase 1, Phase 3
- **Deliverables:**
  - `src/lib/utils/string-similarity.ts`
  - `src/app/api/tags/detect-similar/route.ts`
  - `src/components/tags/SimilarTagWarning.tsx`

### Phase 5: 增强标签选择器 (Story 3.1)
- [x] 5.1 安装 pinyin-pro 库
- [x] 5.2 创建拼音搜索工具函数
- [x] 5.3 实现常用标签统计逻辑
- [x] 5.4 实现最近使用标签记录（localStorage）
- [x] 5.5 创建增强版标签选择器组件
- [x] 5.6 支持键盘导航
- [x] 5.7 按标签组分类展示
- **Status:** complete
- **Dependencies:** Phase 2
- **Deliverables:**
  - `src/lib/utils/pinyin.ts`
  - `src/components/content/EnhancedTagSelector.tsx`
  - `src/hooks/useRecentTags.ts`

### Phase 6: 分类层级优化 (Story 2.1, 2.2)
- [x] 6.1 实现层级深度限制（默认 3 层）
- [x] 6.2 优化 CategoryTree 组件显示层级深度
- [x] 6.3 实现拖拽排序自动计算 sort_order
- [x] 6.4 添加层级深度配置选项
- [x] 6.5 显示每个分类的内容数量
- **Status:** complete
- **Dependencies:** Phase 1
- **Deliverables:**
  - `src/components/categories/CategoryTree.tsx` 更新
  - `src/lib/utils/category-helpers.ts`

### Phase 7: 分类安全迁移 (Story 2.3, 2.4)
- [x] 7.1 创建分类迁移 API
- [x] 7.2 实现删除前内容迁移功能
- [x] 7.3 实现分类归档功能
- [x] 7.4 增强分类合并功能（保留关联数据）
- [x] 7.5 创建迁移确认 UI
- **Status:** complete
- **Dependencies:** Phase 6
- **Deliverables:**
  - `src/app/api/categories/[id]/migrate/route.ts`
  - `src/app/api/categories/migrate/route.ts`
  - `src/components/categories/CategoryMigrationDialog.tsx`

### Phase 8: 增强分类选择器 (Story 3.2)
- [x] 8.1 创建树形下拉选择器组件
- [x] 8.2 实现分类路径面包屑显示
- [x] 8.3 支持搜索过滤（名称 + 拼音）
- [x] 8.4 实现默认值记忆功能
- **Status:** complete
- **Dependencies:** Phase 5, Phase 6
- **Deliverables:**
  - `src/components/content/EnhancedCategorySelector.tsx`

### Phase 9: AI 标签推荐 (Story 4.1)
- [x] 9.1 创建标签推荐 AI prompt
- [x] 9.2 创建标签推荐 API (`/api/ai/recommend-tags`)
- [x] 9.3 创建标签推荐 UI 组件
- [x] 9.4 集成到内容编辑页面（组件已创建，可按需集成）
- [x] 9.5 实现防抖触发（500ms）
- **Status:** complete
- **Dependencies:** Phase 5
- **Deliverables:**
  - `src/lib/ai/server/tag-recommender.ts`
  - `src/app/api/ai/recommend-tags/route.ts`
  - `src/components/content/TagRecommendations.tsx`

### Phase 10: AI 分类推荐 (Story 4.2)
- [x] 10.1 创建分类推荐 AI prompt
- [x] 10.2 创建分类推荐 API (`/api/ai/recommend-category`)
- [x] 10.3 创建分类推荐 UI 组件
- [x] 10.4 集成到内容编辑页面（组件已创建，可按需集成）
- **Status:** complete
- **Dependencies:** Phase 8
- **Deliverables:**
  - `src/lib/ai/server/category-recommender.ts`
  - `src/app/api/ai/recommend-category/route.ts`
  - `src/components/content/CategoryRecommendations.tsx`

### Phase 11: 智能标签合并建议 (Story 1.4)
- [x] 11.1 创建标签分析 API
- [x] 11.2 实现 AI 相似标签组检测
- [x] 11.3 创建合并建议 UI
- [x] 11.4 实现一键合并功能
- **Status:** complete
- **Dependencies:** Phase 4
- **Deliverables:**
  - `src/app/api/tags/analyze/route.ts`
  - `src/components/tags/SmartMergeSuggestions.tsx`
  - `src/components/ui/alert-dialog.tsx`

### Phase 12: 标签规范化工具 (Story 1.5)
- [x] 12.1 创建命名规则配置
- [x] 12.2 实现批量规范化预览
- [x] 12.3 创建规范化执行 API
- [x] 12.4 记录操作日志
- **Status:** complete
- **Dependencies:** Phase 2
- **Deliverables:**
  - `src/app/api/tags/normalize/route.ts`
  - `src/components/tags/TagNormalizationTool.tsx`

### Phase 13: 批量标签操作 (Story 3.3)
- [x] 13.1 更新内容列表支持多选（组件已创建，可集成）
- [x] 13.2 创建批量添加标签 API
- [x] 13.3 创建批量移除标签 API
- [x] 13.4 创建批量操作 UI
- **Status:** complete
- **Dependencies:** Phase 5
- **Deliverables:**
  - `src/app/api/contents/batch-tags/route.ts`
  - `src/components/content/BatchTagOperations.tsx`

### Phase 14: 标签健康度报告 (Story 4.3)
- [x] 14.1 创建标签统计 API
- [x] 14.2 实现健康度指标计算
- [x] 14.3 创建健康度报告 UI
- [x] 14.4 集成一键清理/合并入口
- **Status:** complete
- **Dependencies:** Phase 11, Phase 12
- **Deliverables:**
  - `src/app/api/tags/health-report/route.ts`
  - `src/components/tags/TagHealthReport.tsx`
  - `src/components/ui/progress.tsx`

### Phase 15: 测试与优化
- [ ] 15.1 编写单元测试
- [ ] 15.2 编写集成测试
- [ ] 15.3 性能优化（虚拟滚动等）
- [ ] 15.4 用户体验优化
- [ ] 15.5 文档更新
- **Status:** pending
- **Dependencies:** All previous phases
- **Deliverables:**
  - 测试文件
  - 性能优化代码
  - 更新的文档

## Key Questions

1. ~~标签组是否需要支持嵌套？~~ 不需要，保持扁平结构
2. ~~AI 推荐的置信度阈值如何设定？~~ 高 > 0.8, 中 0.5-0.8, 低 < 0.5
3. ~~拼音搜索是否需要服务端支持？~~ 先在客户端实现，性能不足再考虑服务端
4. ~~分类最大层级深度是否可配置？~~ 是，默认 3 层，可在设置中调整
5. 标签别名是否需要支持多语言？（待确认）

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 使用 pinyin-pro 库 | 轻量级、支持多音字、维护活跃 |
| 标签别名存储为 JSON 数组 | 简单灵活，无需额外表 |
| 复用 inbox-scorer AI 服务模式 | 保持代码一致性，减少重复 |
| 分类归档使用软删除 | 保留数据可恢复，安全性高 |
| 最近使用标签存 localStorage | 用户级别数据，无需服务端存储 |
| 相似度检测先模糊后语义 | 模糊匹配快速过滤，AI 语义精确判断 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes

- PRD 分三个阶段交付：
  - **Phase 1 (MVP)**: Story 1.1, 1.2, 1.3, 3.1 → 对应本计划 Phase 1-5
  - **Phase 2**: Story 2.1, 2.2, 2.3, 3.2, 4.1, 4.2 → 对应本计划 Phase 6-10
  - **Phase 3**: Story 1.4, 1.5, 2.4, 3.3, 4.3 → 对应本计划 Phase 11-14
- 每个 Phase 完成后进行代码审查和测试
- 优先保证 MVP 功能的稳定性
- 性能目标：相似标签检测 < 300ms，AI 推荐 < 1s
