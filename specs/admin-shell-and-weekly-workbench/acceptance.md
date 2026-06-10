# Acceptance Record: Admin Shell and Weekly Workbench

**Workspace**: `admin-shell-and-weekly-workbench` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| US1 / FR-001 首页生产驾驶舱 | `/dashboard` 显示第 91 期、日期范围、候选 0、已选 17、完整度、发布状态、最近 runs 和下一步 `采集候选内容`。 | `/private/tmp/admin-dashboard-desktop-final.png`, `/private/tmp/admin-dashboard-mobile-final.png`, `weekly-production-dashboard.test.tsx` | PASS |
| US1-4 / FR-009 runs 不可用降级 | summary service 在 `automation_runs` client 不可用时保留 issue/candidates 基础状态，runs 降级为空。 | `src/lib/services/weekly-workbench.test.ts`, `src/components/dashboard/weekly-production-dashboard.test.tsx` | PASS |
| US2 / FR-002 生产线导航 | 侧边栏按驾驶舱、采集、筛选、组刊、发布、复盘、设置组织；桌面和移动端可访问。 | `src/components/layout/MenuConfig.tsx`, `src/components/layout/MenuConfig.test.ts`, dashboard/workbench screenshots | PASS |
| US2-3 / FR-011 legacy 降噪 | 周刊列表保留创建/列表主流程；旧自动化动作收束在 `历史工具` 区域。 | `src/app/(dashboard)/weekly/page.tsx`, `rg "历史工具|AI 组织旧工具|历史快速填满"` | PASS |
| US3 / FR-003 工作台闭环 | `/weekly/editor/91` 显示工作台状态、建议预览、发布检查、自动化运行、内容管理、候选、已选、预览。 | `/private/tmp/admin-workbench-desktop-final.png`, `src/components/weekly/WeeklyWorkbench.test.tsx` | PASS |
| US3-1 / FR-005 候选池 | 当前现场候选池为 `0 / empty` 并显示空状态；组件测试覆盖候选元信息、评分、来源链接和已入刊状态。 | `AvailableContentsList.test.tsx`, live replay DOM evidence | PASS |
| US3-2 / FR-007 建议预览 | 现场未生成前只有 `生成建议`，没有 `应用建议`；组件/API 测试验证 preview 不写入，apply 独立确认。 | `SuggestionPanel.test.tsx`, `suggest/route.test.ts`, `apply/route.test.ts` | PASS |
| US3-3 / FR-006/FR-007 应用建议刷新 | apply wrapper 复用 suggestion apply service，测试覆盖新增/跳过结果；UI 测试覆盖应用后回调刷新路径。 | `src/lib/automation/weekly-suggestions.ts`, `SuggestionPanel.test.tsx`, `apply/route.test.ts` | PASS |
| US3-4 / FR-006 手动编排 | 现场存在 17 个 section 输入、17 个 featured 控制和上移/下移按钮；保存失败有 toast 回退。 | `SelectedContentsList.test.tsx`, live replay DOM evidence | PASS |
| US3-5 / FR-010 无图片预览 | 工作台 preview DOM `img` 数量为 0；无图片字段回归测试确认不渲染封面、主图、裁剪或 AI 图片入口。 | `WeeklyPreview.test.tsx`, `WeeklyIssueLayout.test.tsx`, live replay DOM evidence | PASS |
| US4 / FR-008 发布检查和外部副作用 | 当前 17/15 触发发布门禁，检查区发布按钮 disabled，未触发 Quail；发布可用时必须先打开确认对话框，确认后才调用 wrapper；publish wrapper 测试覆盖 idempotency、token delegation、force/deliver 和错误证据。 | `PublishChecklist.test.tsx`, `publish/route.test.ts`, `api/v1/weekly/publish/route.test.ts` | PASS |
| US5 / FR-009 自动化运行追踪 | dashboard 显示最近 runs：`ai/feedback_digest`、`score/run`、`weekly/candidates`；工作台 runs 区域可显示暂无/失败/运行中状态。 | `AutomationRunTimeline.test.tsx`, `runs/route.test.ts`, live replay DOM evidence | PASS |
| US6 / FR-014 响应式 | 移动端工作台主 grid computed columns 为 `298px`，子面板宽度 `[298,298,298]`；桌面子面板宽度 `[213,370,291]`。 | `/private/tmp/admin-workbench-mobile-content-final.png`, `/private/tmp/admin-workbench-desktop-final.png` | PASS |
| FR-012 搜索 fallback | candidates wrapper/service 复用候选服务和 fallback 语义，候选为空时不阻塞页面。 | `candidates/route.test.ts`, `weekly-workbench.test.ts` | PASS |
| FR-013 错误可操作 | summary、candidates、runs、suggest、apply、publish wrapper 均覆盖失败响应；UI 显示 destructive alert/toast。 | T024/T025 tests | PASS |
| FR-015 不新增 schema | 未新增 Prisma migration、表、字段、Redis、Hermes 或新持久状态；只读/聚合既有表和服务。 | `git diff --name-only -- prisma database`, `spec.md`, `plan.md`, `tasks.md` | PASS |

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | UI wrappers、dashboard、workbench、建议、发布检查、runs timeline 和 no-image 回归均有测试覆盖。 |
| Workflow closure | PASS | dashboard -> workbench -> candidate/suggest/apply/manual/preview/publish gate 的 producer-consumer 链路已打通；现场数据触发安全发布门禁。 |
| User-visible outcome | PASS | 桌面和移动端截图显示周刊生产驾驶舱和工作台可见、可操作、无图片生产入口。 |

**Overall**: PASS

## Workflow Replay

- **输入摘要**: 真实本地 dev server，seed 管理员登录，周刊 issue 91。
- **最终 payload 摘要**: dashboard summary 显示 issue 91、候选 0、已选 17、最近 runs 和下一步；workbench 显示 selected 17/15、candidate empty、manual controls、preview links、publish checklist blocked。
- **用户可见结果断言**: 用户可从首页判断下一步，进入工作台查看状态、调整编排、确认无图片预览，并在内容超量时被发布检查阻止。
- **Replay 类型**: 真实、非破坏性。外部 Quail 发布未现场触发，因为当前数据未通过检查；发布写路径由 API/UI 测试覆盖。

## Closeout Checklist

| Item | Status | Evidence / Rationale | Next Step |
|---|---|---|---|
| 旧逻辑、旧路径、fallback 或临时兼容退役 | 已完成 | 周刊列表旧自动化动作降级到 `历史工具`；legacy API 保留兼容，主流程迁入 dashboard/workbench。 | 后续独立 feature 再评估删除 legacy API。 |
| 发布、提交、CI 或 follow-through | 延后 | 本地验证已完成；未执行 git commit，未触发真实 Quail 发布。 | 用户确认后再做 commit；真实发布需用通过检查的周刊执行。 |
| 文档、阶段说明、模板或验收记录更新 | 已完成 | `spec.md`、`plan.md`、`tasks.md` 和本 `acceptance.md` 已记录。 | 无。 |
| ADR、架构债或演进触发信号 | 已完成 | 保留 UI wrapper、automation_runs、server-side publish delegation、不新增 schema 的 ADR；Redis/Hermes/field drop 明确延后。 | 候选和 runs 规模上升后进入 `redis-job-orchestration`；智能召回进入 `hermes-weekly-intelligence`。 |
| 知识同步或经验沉淀 | 已完成 | 已写入 nmem 记忆 `87dd0e8c-72fa-4dff-8826-ed2999180a07`，标题 `weekly/admin admin-shell-and-weekly-workbench 交付决策`。 | 无。 |

## Commit Result

| Field | Value |
|---|---|
| Status | not_submitted |
| Commit Hashes | 无 |
| Commit Messages | 无 |
| Included Files | 见 [commit-plan.md](commit-plan.md) |
| Excluded / Remaining Files | 见 [commit-plan.md](commit-plan.md) 的 Excluded Files / Needs User Decision。 |
| Reason | 已生成 commit plan，等待用户明确确认后才能执行 `git add` / `git commit`。 |

## Completion Record

- **最终结论**: PASS
- **完成依据**: Evidence Table 覆盖 P1/P2 需求；T024/T025/T026 通过；T027 现场回放通过；发布外部副作用被安全门禁阻止且写路径测试覆盖。
- **阻塞项**: 无。
- **延后项**: 不删除 legacy API；不 drop image 字段；不引入 Redis/Hermes；不现场触发 Quail 发布；不自动提交。
- **退役结论**: 旧图片生产 surface 不在 dashboard/workbench 主流程出现；旧周刊自动化按钮保留为历史工具。
- **提交结论**: not_submitted；已生成 [commit-plan.md](commit-plan.md)，等待用户确认。
- **后续动作**: 当前 feature closeout 完成；下一步推荐进入 `redis-job-orchestration`。如用户需要提交，先生成 commit plan。
