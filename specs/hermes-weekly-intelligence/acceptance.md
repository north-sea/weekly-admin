# Acceptance Record: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)
**Verdict**: PASS

---

## Summary

Hermes Weekly Intelligence 的 Admin-side MVP 已完成：Hermes 可以登记 preview artifact，Admin workbench 可以展示 Hermes 建议、置信度、证据和复盘摘要，人工 apply 仍是唯一写回路径。未实现 Hermes skill 本体、NAS 部署命令或 PG/pgvector DDL，符合 spec 边界。

---

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| US1 / feedback digest 是 Hermes 偏好学习输入 | 既有 `/api/v1/ai/feedback/digest` contract 保留；scope/docs 更新为 Hermes `ops:read` 输入 | `docs/automation-contracts.md`; `src/app/api/v1/ai/feedback/digest/route.ts` | PASS |
| US2-1 / Hermes 通过 Admin candidates 读取候选 | Existing `/api/v1/weekly/candidates` 保留；suggestion artifact content id 在 register/apply 前校验 Admin 当前状态 | `src/lib/automation/weekly-suggestions.ts`; `route.test.ts` | PASS |
| US2-2 / 输出 preview artifact | `WeeklySuggestionArtifactSchema`; `/api/v1/weekly/suggestions` register mode; OpenAPI oneOf schema | `src/lib/automation/hermes-artifacts.ts`; `src/lib/automation/openapi.ts`; focused tests | PASS |
| US2-3 / 人工确认后写回 | `SuggestionPanel` 只在用户点击 apply 后调用 workbench apply；`applyWeeklySuggestion` 保持唯一写入服务 | `SuggestionPanel.test.tsx`; `weekly-suggestions.test.ts` | PASS |
| US3 / ops report 可见且不阻塞 | `getLatestHermesOpsReport`; `AutomationRunTimeline` 展示 Hermes 复盘，加载失败时只显示不可用提示 | `weekly-workbench.test.ts`; `AutomationRunTimeline.test.tsx` | PASS |
| US4 / read model 不成为事实源 | 未新增 Prisma model/migration/PG DDL；`data-model.md` 明确外部 ownership 和 rebuild source | `git diff --name-only`; `data-model.md` | PASS |
| FR-003 / scope 最小权限 | Hermes planner 默认 `weekly:read,weekly:suggest,ops:read`，不默认 `weekly:publish` | `docs/automation-contracts.md` | PASS |
| FR-013 / secret redaction | Artifact schema 拒绝 secret-like 字段；测试覆盖 token 字段 rejected | `hermes-artifacts.test.ts` | PASS |

---

## Verification Evidence

- Focused tests: PASS
  - `./node_modules/.bin/vitest run src/app/api/v1/openapi.json/route.test.ts src/lib/automation/hermes-artifacts.test.ts src/app/api/v1/weekly/suggestions/route.test.ts 'src/app/api/v1/weekly/suggestions/[id]/apply/route.test.ts' src/lib/automation/weekly-suggestions.test.ts src/lib/services/weekly-workbench.test.ts src/components/weekly/SuggestionPanel.test.tsx src/components/weekly/AutomationRunTimeline.test.tsx`
  - Result: 8 files / 43 tests passed.
- TypeScript: PASS
  - `./node_modules/.bin/tsc --noEmit`
- ESLint: PASS with existing warnings
  - `./node_modules/.bin/eslint .`
  - Result: 0 errors / 462 warnings.
- Diff hygiene: PASS
  - `git diff --check`
- SDD validator: TOOLING LIMITATION
  - `bash /Users/yqg/.agents/skills/sdd/scripts/validate-sdd.sh --closeout-ready`
  - Result: failed before workspace checks because the script resolves root from its install path (`/Users/yqg/.agents`) and cannot find this repo's `specs/.active`.
- `pnpm type-check`: BLOCKED by local pnpm non-TTY deps purge guard before TypeScript execution; equivalent local `tsc --noEmit` passed.

---

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | Artifact schema, v1 suggestions register/apply, workbench service, UI components and OpenAPI/docs are implemented and tested. |
| Workflow closure | PASS | Hermes register -> workbench preview -> human apply -> Admin write path covered by focused API/service/UI tests. |
| User-visible outcome | PASS | Suggestion panel shows provider/confidence/evidence/run ids; automation timeline shows Hermes ops report and unavailable fallback. |

**Overall**: PASS

---

## Workflow Replay

- **输入摘要**: Hermes suggestion artifact fixture with `provider=hermes`, `weeklyIssueId=7`, `agentRunId=hermes_1`, one content item and evidence refs.
- **最终 payload 摘要**: Workbench apply sends `replaceExisting=false`, optional `sourceRunId/agentRunId`, and projected `items[]` to Admin apply wrapper.
- **用户可见结果断言**: Suggestion panel displays Hermes provider, confidence, evidence refs and item reason; automation timeline displays Hermes ops report when available.
- **Replay 类型**: fixture。真实 Hermes runtime / NAS deployment is outside this Admin repo; Admin-side contract replay is covered by tests.

---

## Bugfix Closure

> 跳过 bugfix-loop-breaker：本 feature 是新能力交付，不是修复已定位 bug。

---

## Residual Risks

- Hermes external skill implementation, NAS deployment and hermes-db/PG migrations remain outside this Admin repo and must be delivered in the owning runtime/repo.
- Admin MVP stores sanitized preview/report summaries in `automation_runs.result_summary`; high-volume querying may require a future first-class `weekly_suggestion_artifacts` table through Prisma Migrate.
- `pnpm` commands in this environment can be blocked by non-TTY dependency purge protection; use local binaries for verification until pnpm config is fixed.

---

## Closeout Checklist

| Item | Status | Evidence / Rationale | Next Step |
|---|---|---|---|
| 旧逻辑、旧路径、fallback 或临时兼容退役 | 已完成 | Admin organizer fallback intentionally remains as fallback; Hermes path is additive and does not create a competing write path. | Monitor provider confusion; future table only if query volume grows. |
| 发布、提交、CI 或 follow-through | 延后 | Local tests/type-check/lint passed; commit plan generated but not submitted because user confirmation is required. | Wait for user confirmation before `git add` / `git commit`. |
| SDD validator | 延后 | Validator script is installed outside the repo and resolves root to `/Users/yqg/.agents`, so it cannot see repo `specs/.active`; manual closeout checks and required evidence files are present. | Fix validator invocation/path separately if strict machine validation is required. |
| 文档、阶段说明、模板或验收记录更新 | 已完成 | `docs/automation-contracts.md`, OpenAPI tests, spec/plan/tasks/acceptance updated. | 无 |
| ADR、架构债或演进触发信号 | 已完成 | ADRs retained in `plan.md`; residual risk records external Hermes runtime and future suggestion table trigger. | Future feature if `automation_runs.result_summary` becomes insufficient. |
| Knowledge Capture | 已完成 | Decisions and gotchas recorded below; no external sync performed. | 无 |

---

## Knowledge Capture

| Type | Title | Summary | Evidence | Scope | Sync Status | Follow-up |
|---|---|---|---|---|---|---|
| decision | Admin API remains write boundary | Hermes artifacts are preview-only. Business writes still go through Admin apply/publish contracts and human confirmation. | `plan.md` ADR-001/003; `weekly-suggestions.ts`; tests | Admin automation and Hermes integration | recorded-only | 无 |
| convention | Hermes read model is external | Admin repo must not create hermes-db/PG/pgvector tables. Read-model schema belongs to Hermes/MCPS/NAS side. | `data-model.md`; no Prisma/SQL diff | Future Hermes/read-model work | recorded-only | 无 |
| gotcha | pnpm non-TTY guard | `pnpm type-check` can fail before TypeScript execution due dependency purge confirmation. Local `tsc --noEmit` is the verification fallback in this environment. | Verification Evidence | Local CI/dev verification | recorded-only | Fix pnpm config separately if desired |

---

## Commit Result

| Field | Value |
|---|---|
| Status | not_submitted |
| Commit Hashes | 无 |
| Commit Messages | 无 |
| Included Files | See [commit-plan.md](commit-plan.md) |
| Excluded / Remaining Files | Worktree has many unrelated dirty files from prior features; not submitted. |
| Reason | Commit requires explicit user confirmation; no `git add` / `git commit` performed. |

---

## Completion Record

- **最终结论**: PASS
- **完成依据**: Evidence Table, Verdict Summary, Workflow Replay and Verification Evidence are all PASS.
- **阻塞项**: 无
- **延后项**: External Hermes skill runtime/NAS deployment/PG migrations; future suggestion table if query needs exceed `automation_runs.result_summary`.
- **退役结论**: Admin organizer fallback retained intentionally; no legacy write path remains in Hermes flow.
- **提交结论**: not_submitted; commit plan generated, awaiting user confirmation.
- **后续动作**: `closeout admin-modernization-roadmap`
