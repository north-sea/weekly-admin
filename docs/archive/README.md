# 归档文档说明

本目录存放已完成需求的规划和实施文档。

## 目录结构

### 2026-01-24-design-optimization
**设计优化需求** - 已完成

包含文件：
- `DESIGN.md` - 设计规范文档
- `DESIGN_OPTIMIZATION.md` - 设计优化方案
- `DETAIL_FIXES.md` - 细节修复记录
- `DETAIL_OPTIMIZATION_REPORT.md` - 优化报告
- `findings_design_optimization.md` - 发现记录
- `progress_design_optimization.md` - 进度日志
- `task_plan_design_optimization.md` - 任务计划

**完成时间**: 2026-01-24
**主要内容**: UI/UX 设计优化，包括布局、颜色、圆角、阴影等视觉规范的统一

---

### 2026-01-25-ai-config
**AI 配置管理需求** - 已完成

包含文件：
- `findings_ai_config.md` - 发现记录
- `progress_ai_config.md` - 进度日志
- `task_plan_ai_config.md` - 任务计划

**完成时间**: 2026-01-25
**主要内容**: AI 配置的集中管理，包括 Prompt 模板、模型配置、API 密钥管理等

---

### 2026-01-28-unified-sources
**统一数据源需求** - 已完成

包含文件：
- `deduplication-and-aggregator.md` - 去重和聚合器设计文档
- `findings_unified_sources.md` - 发现记录
- `progress_unified_sources.md` - 进度日志
- `task_plan_unified_sources.md` - 任务计划

**完成时间**: 2026-01-28
**主要内容**: 统一 RSS 和 Karakeep 数据源，实现统一的收件箱工作流

---

### legacy
**旧版规划文件** - 已过期

包含文件：
- `findings.md` - 旧版发现记录
- `progress.md` - 旧版进度记录
- `task_plan.md` - 旧版任务计划

**说明**: 这些是早期使用的规划文件，已被按需求拆分的专项文件替代

---

## 当前活跃的规划文件

以下文件位于项目根目录，对应正在进行的需求：

- `findings_inbox_workflow.md` - 收件箱工作流优化发现
- `progress_inbox_workflow.md` - 收件箱工作流优化进度
- `task_plan_inbox_workflow.md` - 收件箱工作流优化计划

**当前需求**: 收件箱工作流优化
**开始时间**: 2026-01-29
**状态**: Phase 1 已完成，Phase 2-5 待开始

---

## 归档原则

1. **完成标准**: 需求的所有 Phase 都已完成并验证
2. **归档时机**: 新需求开始前，或文档数量过多时
3. **命名规范**: `YYYY-MM-DD-需求名称`
4. **保留内容**: 保留完整的规划、发现、进度文档
5. **清理原则**: 归档后从项目根目录移除，保持根目录整洁

---

## 查阅归档文档

如需查阅历史需求的实施细节，可以：

1. 按日期查找对应的归档目录
2. 阅读 `task_plan_*.md` 了解需求范围
3. 阅读 `progress_*.md` 了解实施过程
4. 阅读 `findings_*.md` 了解技术决策

---

**最后更新**: 2026-01-30
