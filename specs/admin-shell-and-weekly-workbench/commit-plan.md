# Commit Plan: Admin Shell and Weekly Workbench

**Workspace**: `admin-shell-and-weekly-workbench`
**Date**: 2026-06-07
**Status**: Superseded For Shared UI By Product-Surface Combined Plan

> 未获得用户明确确认前，不执行 `git add` 或 `git commit`。

## Summary

当前 feature 有相关 diff。用户已确认采用 Option B：image retirement + workbench + shared UI/service 进入综合 product-surface 批次。具体提交边界见 [../admin-modernization-roadmap/product-surface-commit-plan.md](../admin-modernization-roadmap/product-surface-commit-plan.md)。

本文件保留为 workbench feature 的归属依据；不再作为独立 workbench 提交的最终执行计划。

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `specs/.active` | 记录当前 SDD active feature。 | 指向 `admin-shell-and-weekly-workbench`。 |
| `specs/admin-shell-and-weekly-workbench/spec.md` | 当前 feature 规格。 | T028 / acceptance。 |
| `specs/admin-shell-and-weekly-workbench/plan.md` | 当前 feature 实现方案和 ADR。 | T028 / acceptance。 |
| `specs/admin-shell-and-weekly-workbench/tasks.md` | T001-T028 执行任务和证据。 | 全部任务已完成。 |
| `specs/admin-shell-and-weekly-workbench/acceptance.md` | 持久验收记录。 | Evidence Table / Workflow Replay / Closeout Checklist。 |
| `specs/admin-shell-and-weekly-workbench/commit-plan.md` | 当前提交计划。 | closeout 规则要求。 |
| `specs/admin-modernization-roadmap/tasks.md` | roadmap 同步当前 feature 完成状态，并推荐下一项。 | T007 已标记完成，下一步改为 `redis-job-orchestration`。 |
| `src/app/(dashboard)/dashboard/page.tsx` | 首页替换为周刊生产驾驶舱。 | T009-T010 / T023 / T027。 |
| `src/app/(dashboard)/weekly/editor/[id]/page.tsx` | 周刊编辑页接入工作台、建议、发布检查和 runs。 | T011-T020 / T027。 |
| `src/app/(dashboard)/weekly/page.tsx` | 周刊列表 legacy 自动化入口降噪。 | T021-T022。 |
| `src/app/api/weekly/[id]/contents/route.ts` | 手动编排保存语义调整。 | T015。 |
| `src/app/api/weekly/[id]/contents/route.test.ts` | 手动编排保存测试。 | T015 / T024。 |
| `src/app/api/weekly/workbench/**` | cookie-auth UI wrapper routes：summary/candidates/runs/suggest/apply/publish。 | T001-T007 / T024。 |
| `src/components/dashboard/weekly-production-dashboard.tsx` | 周刊生产驾驶舱组件。 | T009-T010 / T025。 |
| `src/components/dashboard/weekly-production-dashboard.test.tsx` | dashboard UI 测试。 | T025。 |
| `src/components/layout/MenuConfig.tsx` | 生产线导航配置。 | T008。 |
| `src/components/layout/MenuConfig.test.ts` | 导航配置测试。 | T008 / T025。 |
| `src/components/weekly/AvailableContentsList.tsx` | 候选池无图片、评分和来源展示。 | T012 / T016。 |
| `src/components/weekly/AvailableContentsList.test.tsx` | 候选池测试。 | T012 / T025。 |
| `src/components/weekly/AutomationRunTimeline.tsx` | 工作台 runs timeline。 | T018。 |
| `src/components/weekly/AutomationRunTimeline.test.tsx` | runs timeline 测试。 | T018 / T025。 |
| `src/components/weekly/HoverImagePreview.tsx` | 删除 legacy 图片 hover preview surface。 | FR-010 / T028。 |
| `src/components/weekly/PublishChecklist.tsx` | 发布检查、确认对话框、force/deliver、run evidence。 | T017 / T019-T020 / Verify fix。 |
| `src/components/weekly/PublishChecklist.test.tsx` | 发布检查和确认测试。 | T025 / Verify fix。 |
| `src/components/weekly/SelectedContentsList.tsx` | 已选编排、section/featured、非拖拽移动控件。 | T015 / T023。 |
| `src/components/weekly/SelectedContentsList.test.tsx` | 已选编排测试。 | T015 / T025。 |
| `src/components/weekly/SuggestionPanel.tsx` | 建议预览和 apply 人工确认面。 | T013-T014。 |
| `src/components/weekly/SuggestionPanel.test.tsx` | 建议预览/apply 测试。 | T013-T014 / T025。 |
| `src/components/weekly/WeeklyEditor.tsx` | 旧内容编辑区域响应式和无图片预览适配。 | T015-T016 / T023。 |
| `src/components/weekly/WeeklyIssueLayout.tsx` | 周刊输出布局 no-image 回归。 | T016 / FR-010。 |
| `src/components/weekly/WeeklyIssueLayout.test.tsx` | no-image 输出测试。 | T016 / T025。 |
| `src/components/weekly/WeeklyPreview.tsx` | 工作台真实预览 no-image 回归。 | T016。 |
| `src/components/weekly/WeeklyPreview.test.tsx` | 工作台 preview no-image 测试。 | T016 / T025。 |
| `src/components/weekly/WeeklyWorkbench.tsx` | 工作台状态容器，聚合 issue/candidates/runs。 | T011 / T018。 |
| `src/components/weekly/WeeklyWorkbench.test.tsx` | 工作台状态加载测试。 | T011 / T025。 |
| `src/lib/automation/weekly-suggestions.ts` | 建议应用语义补齐。 | T014。 |
| `src/lib/services/weekly-workbench.ts` | weekly workbench 聚合服务。 | T001-T007 / T024。 |
| `src/lib/services/weekly-workbench.test.ts` | workbench service 单测。 | T024。 |

## Excluded Files

| File | Reason |
|---|---|
| `.claude/settings.local.json` | 本地工具设置，非当前 feature 交付内容。 |
| `docs/automation-plan-admin.md` | 归属不确定；不在当前 acceptance evidence 中。 |
| `package.json`, `pnpm-lock.yaml` | 依赖变更归属不确定；当前 feature 未引入新依赖。 |
| `scripts/**`, `scripts/迁移/**` | 脚本改动和删除不属于本 feature。 |
| `specs/image-feature-retirement/**` | 另一个 feature 的产物，不混入当前提交。 |
| `specs/inbox-ai-scoring/acceptance.md` | 其它 feature 验收记录。 |
| `src/app/(dashboard)/content/**`, `src/components/content/**` | 内容编辑/图片退役相关，归属不属于当前 feature。 |
| `src/app/(dashboard)/inbox/page.tsx` | inbox 改动不属于当前 feature。 |
| `src/app/(dashboard)/settings/ai/page.tsx` | AI 设置页改动不属于当前 feature。 |
| `src/app/api/ai/**`, `src/app/api/inbox/[id]/crop-image/**`, `src/app/api/upload/image/**` | AI/image API 相关，归属不属于当前 feature。 |
| `src/app/api/health/startup/route.ts` | 健康检查改动归属不确定。 |
| `src/app/api/weekly/[id]/route.ts`, `src/app/api/weekly/route.ts` | 当前 plan 未把这些列为主改动；需另行确认。 |
| `src/components/inbox/image-cropper.tsx` | 图片退役相关删除，不属于当前 feature。 |
| `src/lib/ai/client.ts`, `src/lib/config-validation.ts`, `src/proxy.ts` | 平台/配置改动归属不确定。 |
| `src/lib/services/content.ts`, `src/lib/services/inbox.ts`, `src/lib/services/karakeep-resync.ts`, `src/lib/services/quail.ts`, `src/lib/services/sync-orchestrator.ts`, `src/lib/validations/content.ts` | 服务层改动归属不确定，当前 evidence 未覆盖。 |
| `src/lib/services/image-*` | 图片退役相关删除，不属于当前 feature。 |
| `src/lib/services/quail.test.ts` | 未纳入当前 T024/T025 验证命令，归属需确认。 |

## Needs User Decision

| File | Why Uncertain | Question |
|---|---|---|
| `src/app/api/weekly/[id]/route.ts` | 与 weekly 发布/状态相关，但当前 feature 主发布路径是 workbench publish wrapper。 | 是否属于本 feature 一并提交，还是另一个 legacy/API 清理任务？ |
| `src/app/api/weekly/route.ts` | 与 weekly 列表/创建相关，但未列入当前 tasks 的关键修改范围。 | 是否属于本 feature 一并提交？ |
| `src/lib/services/quail.ts`, `src/lib/services/quail.test.ts` | 可能与 publish 行为相关，但当前 wrapper 通过 `/api/v1/weekly/publish` 测试覆盖。 | 是否属于 publish 相关修复，还是独立 Quail 服务改动？ |

## Risks

| Risk | Impact | Handling |
|---|---|---|
| 大量无关 dirty files | 宽泛 add 会混入图片退役、AI/image、配置、依赖等改动。 | 只允许 add Included Files；不得 `git add -A`。 |
| `HoverImagePreview.tsx` 删除 | 删除 UI surface 风险高于普通 patch。 | 已由 no-image regression 和 acceptance 覆盖；提交前用户可复核。 |
| 外部 Quail 发布未现场触发 | 无法证明 live side effect 成功。 | 当前数据 17/15 被门禁阻止；publish wrapper/API/UI tests 覆盖写路径。 |
| Dev server scheduler | `pnpm dev` 会启动 inbox scoring scheduler。 | 本次验证用 dev server 已停止；需要试用时重新运行 `pnpm dev`。 |

## Commit Batches

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files 全部 | `feat(weekly): add admin production workbench` | 单个 feature 跨 UI wrapper、dashboard、workbench、publish gate、acceptance，测试和文档需同批保持一致。 |

## Execution Rules

- 未获得用户明确确认前，不得执行 `git add` 或 `git commit`。
- 只允许 add `Included Files` 中属于已确认 batch 的文件。
- 不得使用 `git add -A`、`git add .` 或等价宽泛命令。
- 每个 batch 单独提交；任一 batch 失败时停止后续 batch。
- 不自动执行 `git push`。push 必须由用户另行明确要求。

## User Confirmation

等待用户确认：

- `确认提交`: 按上述 batch 执行本地提交。
- `修改计划`: 根据用户要求调整 included/excluded/batches。
- `暂不提交`: closeout 记录 not submitted 和剩余 dirty files。
