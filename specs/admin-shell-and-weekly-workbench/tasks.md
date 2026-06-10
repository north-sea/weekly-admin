# Tasks: Admin Shell and Weekly Workbench

**Workspace**: `admin-shell-and-weekly-workbench` | **Date**: 2026-06-06
**Input**: `specs/admin-shell-and-weekly-workbench/spec.md` + `plan.md`
**Prerequisites**: spec.md, plan.md

---

## 执行原则

- 按依赖顺序推进：先建立 cookie-auth UI wrapper 和聚合服务，再改页面和工作台，最后做发布、legacy 降噪和验证。
- 不新增 schema，不创建 `data-model.md`。
- 浏览器 UI 不直接调用 `/api/v1/*` automation Bearer contract。
- 每个写操作后刷新统一事实源：issue、selected contents、completeness、runs。
- 任一任务发现需要 Redis、Hermes、新表或字段，必须暂停并回到 `plan`。

---

## Phase 1: UI API Wrapper Foundation

**目标**: 建立浏览器可调用的 cookie-auth 工作台 API 边界，复用既有服务，不暴露 automation token。

- [x] T001 [Foundation] 创建 weekly workbench service 聚合层
  - scope: `src/lib/services/weekly-workbench.ts`
  - maps_to: FR-001 / FR-004 / FR-009 / ADR-001 / ADR-002
  - verify: `pnpm test src/lib/services/weekly-workbench.test.ts src/app/api/weekly/workbench/summary/route.test.ts src/app/api/weekly/workbench/candidates/route.test.ts src/app/api/weekly/workbench/runs/route.test.ts`; `pnpm type-check`

- [x] T002 [Foundation] 新增 summary wrapper
  - scope: `src/app/api/weekly/workbench/summary/route.ts`
  - maps_to: US1 / FR-001 / FR-004 / NFR-001
  - verify: `src/app/api/weekly/workbench/summary/route.test.ts`; `pnpm type-check`

- [x] T003 [Foundation] 新增 candidates wrapper
  - scope: `src/app/api/weekly/workbench/candidates/route.ts`, `src/lib/automation/weekly-candidates.ts`
  - maps_to: US3-1 / FR-005 / FR-012 / Producer-Consumer candidates
  - verify: `src/app/api/weekly/workbench/candidates/route.test.ts`; `pnpm type-check`

- [x] T004 [Foundation] 新增 runs wrapper
  - scope: `src/app/api/weekly/workbench/runs/route.ts`, `prisma.automation_runs`
  - maps_to: US5 / FR-009 / ADR-002 / 可追踪性
  - verify: `src/app/api/weekly/workbench/runs/route.test.ts`; `pnpm type-check`

- [x] T005 [Foundation] 新增 suggest wrapper
  - scope: `src/app/api/weekly/workbench/[id]/suggest/route.ts`, `src/lib/ai/server/weekly-organizer.ts`
  - maps_to: US3-2 / FR-007 / ADR-001
  - verify: `pnpm test src/lib/services/weekly-workbench.test.ts src/app/api/weekly/workbench/summary/route.test.ts src/app/api/weekly/workbench/candidates/route.test.ts src/app/api/weekly/workbench/runs/route.test.ts 'src/app/api/weekly/workbench/[id]/suggest/route.test.ts' 'src/app/api/weekly/workbench/[id]/apply/route.test.ts'`; `pnpm type-check`

- [x] T006 [Foundation] 新增 apply wrapper
  - scope: `src/app/api/weekly/workbench/[id]/apply/route.ts`, `src/lib/automation/weekly-suggestions.ts`
  - maps_to: US3-3 / FR-006 / FR-007 / 一致性
  - verify: `pnpm test src/lib/services/weekly-workbench.test.ts src/app/api/weekly/workbench/summary/route.test.ts src/app/api/weekly/workbench/candidates/route.test.ts src/app/api/weekly/workbench/runs/route.test.ts 'src/app/api/weekly/workbench/[id]/suggest/route.test.ts' 'src/app/api/weekly/workbench/[id]/apply/route.test.ts'`; `pnpm type-check`

- [x] T007 [Foundation] 新增 publish wrapper 和 human run tracking
  - scope: `src/app/api/weekly/workbench/[id]/publish/route.ts`, `src/lib/services/weekly-workbench.ts`, `src/lib/automation/run.ts` or wrapper-local equivalent
  - maps_to: US4 / FR-008 / NFR-003 / ADR-003
  - verify: `pnpm test src/lib/services/weekly-workbench.test.ts src/app/api/weekly/workbench/summary/route.test.ts src/app/api/weekly/workbench/candidates/route.test.ts src/app/api/weekly/workbench/runs/route.test.ts 'src/app/api/weekly/workbench/[id]/suggest/route.test.ts' 'src/app/api/weekly/workbench/[id]/apply/route.test.ts' 'src/app/api/weekly/workbench/[id]/publish/route.test.ts'`; `pnpm type-check`

---

## Phase 2: Navigation And Dashboard

**目标**: 将后台入口和首页调整为周刊生产线视角。

- [x] T008 [Shell] 重组导航配置
  - scope: `src/components/layout/MenuConfig.tsx`, `src/components/layout/AppSidebar.tsx` if needed
  - maps_to: US2 / FR-002 / FR-010 / FR-011
  - verify: `pnpm test src/components/layout/MenuConfig.test.ts`; `pnpm type-check`

- [x] T009 [Dashboard] 替换 dashboard 主视图为生产驾驶舱
  - scope: `src/app/(dashboard)/dashboard/page.tsx`, new dashboard components under `src/components/weekly/` or `src/components/dashboard/`
  - maps_to: US1 / FR-001 / NFR-001 / 可用性
  - verify: `pnpm test src/components/dashboard/weekly-production-dashboard.test.tsx src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

- [x] T010 [Dashboard] 实现 nextAction 映射和入口跳转
  - scope: dashboard components, summary DTO
  - maps_to: US1-2 / FR-013
  - verify: `pnpm test src/components/dashboard/weekly-production-dashboard.test.tsx src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

---

## Phase 3: Weekly Workbench Core

**目标**: 将周刊编辑页改造成候选、建议、已选、预览、检查清单的一体化工作台。

- [x] T011 [Workbench] 搭建 `WeeklyWorkbench` 容器和状态加载
  - scope: `src/app/(dashboard)/weekly/editor/[id]/page.tsx`, `src/components/weekly/WeeklyWorkbench.tsx`
  - maps_to: US3 / FR-003 / ADR-004
  - verify: `pnpm test src/components/weekly/WeeklyWorkbench.test.tsx src/components/dashboard/weekly-production-dashboard.test.tsx src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

- [x] T012 [Workbench] 实现候选池面板
  - scope: `CandidatePanel`, `AvailableContentsList` adaptation
  - maps_to: US3-1 / FR-005 / FR-012
  - verify: `pnpm test src/components/weekly/AvailableContentsList.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

- [x] T013 [Workbench] 实现建议预览面板
  - scope: `SuggestionPanel`, suggest wrapper client integration
  - maps_to: US3-2 / FR-007
  - verify: `pnpm test src/components/weekly/SuggestionPanel.test.tsx src/components/weekly/AvailableContentsList.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

- [x] T014 [Workbench] 实现建议应用流程
  - scope: `SuggestionPanel`, apply wrapper client integration
  - maps_to: US3-3 / FR-007 / 一致性
  - verify: `pnpm test src/components/weekly/SuggestionPanel.test.tsx 'src/app/api/weekly/workbench/[id]/apply/route.test.ts' src/lib/services/weekly-workbench.test.ts src/lib/automation/weekly-suggestions.test.ts`; `pnpm type-check`

- [x] T015 [Workbench] 实现已选编排和手动编辑
  - scope: `SelectedIssueOutline`, `SelectedContentsList`, `/api/weekly/[id]/contents` or wrapper
  - maps_to: US3-4 / FR-006
  - verify: `pnpm test src/components/weekly/SelectedContentsList.test.tsx 'src/app/api/weekly/[id]/contents/route.test.ts' src/components/weekly/AvailableContentsList.test.tsx src/components/weekly/SuggestionPanel.test.tsx`; `pnpm type-check`

- [x] T016 [Workbench] 实现真实预览和无图片回归
  - scope: `WeeklyPreview`, workbench preview area
  - maps_to: US3-5 / FR-010 / no-image regression
  - verify: `pnpm test src/components/weekly/WeeklyPreview.test.tsx src/components/weekly/WeeklyIssueLayout.test.tsx src/components/weekly/SelectedContentsList.test.tsx`; `pnpm type-check`

- [x] T017 [Workbench] 实现完整度和发布检查清单
  - scope: `CompletenessIndicator`, `PublishChecklist`
  - maps_to: US4-1 / FR-008 / CD-004
  - verify: `pnpm test src/components/weekly/PublishChecklist.test.tsx src/components/weekly/SuggestionPanel.test.tsx src/components/weekly/WeeklyPreview.test.tsx src/components/weekly/WeeklyIssueLayout.test.tsx`; `pnpm type-check`

- [x] T018 [Workbench] 实现 automation run timeline
  - scope: `AutomationRunTimeline`, runs wrapper client integration
  - maps_to: US5 / FR-009 / 可追踪性
  - verify: `pnpm test src/components/weekly/AutomationRunTimeline.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/app/api/weekly/workbench/runs/route.test.ts src/lib/services/weekly-workbench.test.ts`; `pnpm type-check`

---

## Phase 4: Publish And Legacy Tooling

**目标**: 发布路径可追踪，旧周刊列表入口降噪但不破坏历史工具。

- [x] T019 [Publish] 接入 publish wrapper 到工作台
  - scope: `PublishChecklist`, publish wrapper
  - maps_to: US4-2 / US4-3 / FR-008 / ADR-003
  - verify: `pnpm test src/components/weekly/PublishChecklist.test.tsx 'src/app/api/weekly/workbench/[id]/publish/route.test.ts' src/app/api/v1/weekly/publish/route.test.ts`; `pnpm type-check`

- [x] T020 [Publish] 处理重复发布、force republish、deliver 选项
  - scope: publish wrapper, `PublishChecklist`
  - maps_to: US4-4 / US4-5
  - verify: `pnpm test src/components/weekly/PublishChecklist.test.tsx 'src/app/api/weekly/workbench/[id]/publish/route.test.ts' src/app/api/v1/weekly/publish/route.test.ts`; `pnpm type-check`

- [x] T021 [Legacy] 降噪周刊列表自动化按钮
  - scope: `src/app/(dashboard)/weekly/page.tsx`
  - maps_to: US2-3 / FR-011 / CD-005
  - verify: `pnpm type-check`; `rg -n "历史工具|驾驶舱|创建周刊|创建本周草稿|关联本周内容|AI 组织旧工具|历史快速填满" 'src/app/(dashboard)/weekly/page.tsx'`

- [x] T022 [Legacy] 保留旧 API 兼容但明确消费者
  - scope: `/api/weekly/auto-create`, `/api/weekly/auto-link`, `/api/weekly/backfill`, `/weekly/generate`
  - maps_to: Known Risks / ADR-004
  - verify: `pnpm type-check`; `rg -n "export async function|auto-create|auto-link|backfill" src/app/api/weekly/auto-create src/app/api/weekly/auto-link src/app/api/weekly/backfill src/app/\\(dashboard\\)/weekly/generate`

---

## Phase 5: Responsive, Tests, And Evidence

**目标**: 收口用户可见体验、关键测试和 workflow replay 证据。

- [x] T023 [Responsive] 桌面和移动端布局检查
  - scope: dashboard, weekly workbench, sidebar
  - maps_to: US6 / FR-014 / NFR-002
  - verify: Playwright 或截图覆盖 desktop/mobile；无文本重叠、按钮溢出、核心操作不可达
  - evidence: `agent-browser --session sdd-responsive set viewport 390 844`; `/private/tmp/admin-dashboard-mobile-final.png`; `/private/tmp/admin-workbench-mobile-final.png`; `/private/tmp/admin-workbench-mobile-content-final.png`; mobile workbench grid `grid-cols-1 ... lg:grid-cols-12` computed columns `298px`, child widths `[298,298,298]`.
  - evidence: `agent-browser --session sdd-responsive set viewport 1280 900`; `/private/tmp/admin-dashboard-desktop-final.png`; `/private/tmp/admin-workbench-desktop-final.png`; desktop workbench grid child widths `[213,370,291]`.

- [x] T024 [Tests] 补 API/service 单测
  - scope: workbench wrapper routes, `weekly-workbench.ts`
  - maps_to: NFR-005 / ADR-001 / ADR-002 / ADR-003
  - verify: `pnpm test` 覆盖 summary、candidates、runs、suggest、apply、publish
  - evidence: `pnpm test src/lib/services/weekly-workbench.test.ts src/app/api/weekly/workbench/summary/route.test.ts src/app/api/weekly/workbench/candidates/route.test.ts src/app/api/weekly/workbench/runs/route.test.ts 'src/app/api/weekly/workbench/[id]/suggest/route.test.ts' 'src/app/api/weekly/workbench/[id]/apply/route.test.ts' 'src/app/api/weekly/workbench/[id]/publish/route.test.ts' src/app/api/v1/weekly/publish/route.test.ts` -> 8 files / 28 tests passed.

- [x] T025 [Tests] 补 UI 组件/交互测试
  - scope: dashboard/workbench components
  - maps_to: US1 / US3 / US4 / US5 / US6
  - verify: component tests 或 Playwright 覆盖 summary、suggest preview、apply refresh、publish checklist、runs timeline
  - evidence: `pnpm test src/components/dashboard/weekly-production-dashboard.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/components/weekly/AvailableContentsList.test.tsx src/components/weekly/SuggestionPanel.test.tsx src/components/weekly/SelectedContentsList.test.tsx src/components/weekly/WeeklyPreview.test.tsx src/components/weekly/WeeklyIssueLayout.test.tsx src/components/weekly/PublishChecklist.test.tsx src/components/weekly/AutomationRunTimeline.test.tsx src/components/layout/MenuConfig.test.ts` -> 10 files / 29 tests passed.

- [x] T026 [Static] 静态检查
  - scope: full repo
  - maps_to: general quality gate
  - verify: `pnpm lint`, `pnpm type-check`
  - evidence: `pnpm lint` -> exit 0, 0 errors / 461 warnings; warnings are existing repo-wide lint debt patterns such as `no-explicit-any`, `no-require-imports`, and `react-hooks/set-state-in-effect`.
  - evidence: `pnpm type-check` -> `next typegen && tsc --noEmit` passed.

- [x] T027 [Workflow Replay] 端到端生产线回放
  - scope: dashboard + workbench + publish
  - maps_to: multi-stage-workflow / artifact-handoff / user-visible-output
  - verify: 按 plan 的 Workflow Replay 8 步记录 fresh evidence
  - evidence: Non-destructive live replay via `agent-browser --session sdd-responsive`: `/dashboard` shows issue 91, date range `2026-03-22` to `2026-03-28`, candidates `0`, selected `17`, publish status `待发布`, recent runs (`ai/feedback_digest`, `score/run`, `weekly/candidates`), next action `采集候选内容`.
  - evidence: `/weekly/editor/91` workbench loads issue 91 with selected `17/15`, candidates `0 / empty`, runs `0`, suggestion panel has `生成建议` and no `应用建议` before preview, manual section inputs `17`, featured buttons `17`, non-drag up/down controls present, preview has `0` `img` elements and `17` source links.
  - evidence: Publish checklist blocks external side effect on current data: content count `当前 17 篇，建议 10-15 篇`, checklist publish button disabled, message `发布动作将在检查全部通过后启用。` No live Quail publish was triggered.
  - evidence: Destructive/write paths are covered by T024/T025 tests: suggest preview before apply, apply refresh result, publish wrapper idempotency/token/delegation/error evidence, publish checklist ready/blocked/force/deliver states.

- [x] T028 [Closeout Prep] 退役检查和交付说明
  - scope: specs acceptance notes, changed UI/API entrypoints
  - maps_to: prior-closure-failure / closeout readiness
  - verify: 明确旧入口保留/降级状态、无图片 surface、deferred Redis/Hermes/field drop 未被误做
  - evidence: `specs/admin-shell-and-weekly-workbench/acceptance.md` records evidence table, workflow replay, closeout checklist, legacy降噪、无图片回归、deferred Redis/Hermes/field drop、not_submitted commit status, and nmem knowledge sync `87dd0e8c-72fa-4dff-8826-ed2999180a07`; `commit-plan.md` records included/excluded/needs-user-decision files.

---

## 依赖与顺序

- 关键路径: T001 -> T002/T003/T004/T005/T006/T007 -> T009/T011 -> T012-T018 -> T019/T020 -> T023-T028。
- T008 可与 Phase 1 并行，但最终需要在 dashboard/workbench 可跳转后验证。
- T021/T022 可在 workbench 核心可用后执行，避免先移除旧入口导致无主流程替代。
- T024 可随 Phase 1 同步推进；T025/T023 依赖 UI 基本成型。
- T027 必须在 publish、runs、dashboard、workbench 都完成后执行。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 首页生产状态 | T001, T002, T009, T010, T023, T027 |
| US2 生产线导航 | T008, T021, T022, T023 |
| US3 工作台候选/建议/编排 | T003, T005, T006, T011-T016, T024, T025, T027 |
| US4 发布检查和外部副作用 | T007, T017, T019, T020, T024, T025, T027 |
| US5 自动化运行追踪 | T004, T018, T024, T025, T027 |
| US6 响应式核心处理 | T008, T011-T018, T023, T025 |
| FR-010 无图片 UI | T008, T012, T016, T028 |
| FR-015 不新增 schema | T001, T004, T007, T028 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 UI wrapper 边界 | T001-T007 | T024, T026 |
| ADR-002 automation_runs 来源 | T004, T018 | T024, T027 |
| ADR-003 publish tracking | T007, T019, T020 | T024, T027 |
| ADR-004 分层替换 UI | T008-T022 | T023, T025 |
| 可用性 | T002, T009, T010, T011 | T023, T027 |
| 一致性 | T006, T014, T015, T019 | T024, T027 |
| 可追踪性 | T004, T007, T018, T019 | T024, T027 |
| 安全性 | T001-T007 | T024, T026 |

---

## Notes

- T007 是实现风险最高的任务：要让 human-triggered publish 有 run evidence，但不能把 automation token 暴露给浏览器。
- T007 修订策略：publish wrapper 先做 human cookie auth，再在服务端用 `ADMIN_UI_AUTOMATION_TOKEN` 或 `CRON_API_TOKEN` 委托现有 `/api/v1/weekly/publish`，复用正式 automation run tracking。浏览器必须提供 `Idempotency-Key`，服务端不得生成随机 key。
- 如果发现 `/api/weekly/[id]/contents` 当前 status 校验不接受 `ready`，而候选来自 `ready/published`，应在 T015 中统一语义并补测试。
- 工作台 UI 不应一次性追求复杂动画或装饰，优先信息密度、稳定布局和可操作状态。

---

## Stage Readiness

- 推荐下一步：`closeout` 完成后进入 `redis-job-orchestration`
- 阻塞项（如有）：无。T001-T028 已完成；publish wrapper 采用服务端委托现有 automation publish route，不新增 schema，不暴露 automation token。
