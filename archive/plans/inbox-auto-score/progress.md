# Progress Log: 收件箱自动评分功能

**Task**: 收件箱自动评分功能
**Started**: 2026-02-01

---

## Session Log

### 2026-02-01 - 需求分析与设计

**Activities**:
- [x] 分析现有评分逻辑
- [x] 分析同步服务代码
- [x] 与用户讨论设计方案
- [x] 生成设计文档
- [x] 创建任务计划

**Findings**:
- `auto_preprocess` 选项存在但默认关闭
- 同步 API 未传递该参数
- Karakeep 有 `bookmark.createdAt` 可用于收集时间
- 现有 upsert 逻辑保留原有评分

**Decisions Made**:
- 全局设置存 `ai_settings` 表
- 数据源级别用 `null` 表示跟随全局
- 统一使用 `collected_at` 字段排序
- 内容变化不重新评分

**Files Created**:
- `archive/plans/2026-02-01-inbox-auto-score-design.md`
- `archive/plans/inbox-auto-score/task_plan.md`
- `archive/plans/inbox-auto-score/findings.md`
- `archive/plans/inbox-auto-score/progress.md`

**Next Steps**:
- Phase 1: 数据库变更

---

## Test Results

| Test | Date | Result | Notes |
|------|------|--------|-------|
| (pending) | - | - | - |

---

## Blockers

| Blocker | Status | Resolution |
|---------|--------|------------|
| (none) | - | - |

---

## Metrics

### 评分覆盖率

| Date | Total Items | Scored Items | Coverage |
|------|-------------|--------------|----------|
| (baseline pending) | - | - | - |
