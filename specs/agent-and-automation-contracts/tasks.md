# Tasks: Agent And Automation Contracts

**Workspace**: `agent-and-automation-contracts` | **Date**: 2026-06-04  
**Input**: `specs/agent-and-automation-contracts/spec.md` + `plan.md`  
**Prerequisites**: spec.md, plan.md, data-model.md

---

## 执行原则

- 先落 token/run/idempotency 基础，再接 `/api/v1` route，最后做 OpenAPI、文档和验证。
- 保持旧 human-admin API 兼容，不把现有 `/api/weekly/*` 静默切换为 automation-only。
- 所有 schema change 只能通过 Prisma Migrate。
- 每个写入类 v1 endpoint 必须明确 scope、idempotency、run status 和错误分类。

---

## Phase 1: Data Model And Migration

**目标**: 建立 automation token 与 run/idempotency 的持久化基础。

- [x] T001 [FR-018] 新增 Prisma data model
  - scope: `prisma/schema.prisma`
  - maps_to: FR-002b / FR-005 / FR-013 / ADR-001 / ADR-002 / data-model.md
  - verify: schema 中存在 `automation_tokens`、`automation_runs` 及必要 relation/index；不修改无关表。

- [x] T002 [FR-018] 生成 Prisma migration
  - scope: `prisma/migrations/*_agent_and_automation_contracts/`
  - maps_to: FR-018 / migration baseline 约束
  - verify: migration 由 Prisma Migrate 生成；无新增 `database/*.sql` schema 入口。

- [x] T003 [FR-002b] 提供 token bootstrap/fixture 路径
  - scope: `prisma/seed.ts` 或 `scripts/*`，按现有 seed/script 模式选择
  - maps_to: CL-001 / NFR-003
  - verify: dev/test 能创建 disabled/example token 或一次性生成 token；明文只输出一次，不写入数据库。

---

## Phase 2: Automation Auth And Run Foundation

**目标**: 提供可复用的 automation 鉴权、scope guard、run wrapper 和 idempotency 行为。

- [x] T004 [US1] 实现 automation token 鉴权
  - scope: `src/lib/automation/auth.ts`
  - maps_to: FR-001 / FR-002 / FR-002a / FR-002b / ADR-001 / 安全
  - verify: 单测覆盖 missing token、invalid token、disabled/revoked/expired token、valid token。

- [x] T005 [US1] 实现 scope guard
  - scope: `src/lib/automation/auth.ts`
  - maps_to: FR-001 / NFR-003
  - verify: scope 不足返回 403；scope 满足时返回 caller context；错误响应不泄漏 token。

- [x] T006 [US4] 实现 automation run lifecycle
  - scope: `src/lib/automation/run.ts`
  - maps_to: FR-005 / FR-013 / ADR-002 / 可观测性
  - verify: 单测覆盖 running -> succeeded / failed / skipped / empty / partial_success。

- [x] T007 [US3] 实现 idempotency wrapper
  - scope: `src/lib/automation/run.ts`
  - maps_to: FR-006 / FR-007 / FR-011 / NFR-001 / 幂等性
  - verify: 同 key 同 digest 返回 replay；同 key 不同 digest 返回 conflict；running 状态重复请求不重复执行 handler。

- [x] T008 [US4] 实现 operation log mirror
  - scope: `src/lib/automation/run.ts`, `src/lib/services/operation-log.ts` 或现有 logger wrapper
  - maps_to: FR-013 / CL-002
  - verify: run 完成后 best-effort 写入脱敏摘要；operation log 失败不改变 run terminal status。

- [x] T009 [US1] 统一 v1 automation response helpers
  - scope: `src/lib/automation/contracts.ts`, `src/lib/utils/serialization.ts` 仅按需复用不破坏现有 helper
  - maps_to: FR-003 / FR-004 / NFR-004
  - verify: response 保持 `success/data/error/meta` envelope，并包含 `meta.runId`、`meta.status` 等 automation metadata。

---

## Phase 3: Agent-Friendly API Endpoints

**目标**: 新增或稳定 `/api/v1` contract，并复用现有 domain service。

- [x] T010 [US1] 实现 `/api/v1/jobs/sync`
  - scope: `src/app/api/v1/jobs/sync/route.ts`, `src/lib/services/sync-orchestrator.ts`
  - maps_to: FR-003 / FR-008 / ADR-003 / Producer-Consumer Matrix
  - verify: route test 覆盖 auth/scope/validation/success/partial failure/idempotency replay。

- [x] T011 [US1] 实现 `/api/v1/jobs/score`
  - scope: `src/app/api/v1/jobs/score/route.ts`, inbox scoring services
  - maps_to: FR-003 / FR-008 / score workflow artifact
  - verify: route test 覆盖空队列、成功评分、失败分类和 run record。

- [x] T012 [US2] 实现 `/api/v1/weekly/candidates`
  - scope: `src/app/api/v1/weekly/candidates/route.ts`
  - maps_to: FR-016 / ADR-004 / Producer-Consumer Matrix
  - verify: 返回候选内容、score/summary/weekly range；无候选返回 `empty` 而不是 500。

- [x] T013 [US2] 实现 `/api/v1/weekly/suggestions`
  - scope: `src/app/api/v1/weekly/suggestions/route.ts`, `src/lib/ai/server/weekly-organizer.ts`
  - maps_to: FR-009 / CL-005 / ADR-004
  - verify: schema 校验失败返回稳定错误；成功返回 preview artifact 和 runId，不写入 `weekly_content_items`。

- [x] T014 [US2] 设计并实现 suggestion apply contract（若首版纳入）
  - scope: `src/app/api/v1/weekly/suggestions/[id]/apply/route.ts` 或 equivalent
  - maps_to: CL-005 / FR-007 / FR-016
  - verify: apply 写入 `weekly_content_items`；重复 apply 不重复插入；invalid content id 被拒绝。

- [x] T015 [US3] 实现 `/api/v1/weekly/publish`
  - scope: `src/app/api/v1/weekly/publish/route.ts`, `src/lib/services/quail.ts`
  - maps_to: FR-010 / FR-011 / external-side-effects / weekly:publish scope
  - verify: 已发布无 `forceRepublish` 返回 conflict；Quail 失败不标记本地成功；idempotency replay 不重复投递。

- [x] T016 [US4] 扩展 `/api/v1/ai/feedback/digest`
  - scope: `src/app/api/v1/ai/feedback/digest/route.ts`, operation log / scoring data reads
  - maps_to: US4 / roadmap F2 / ops:read scope
  - verify: 不再只返回 baseline note；按日期范围返回 actions/counts；无数据返回空集合成功。

- [x] T017 [US1] 明确现有 `/api/v1/ai/score` 的 auth 归属
  - scope: `src/app/api/v1/ai/score/route.ts`
  - maps_to: ADR-003 / NFR-004
  - verify: 选择保留 human JWT 或迁移到 automation wrapper；测试覆盖所选行为，文档记录兼容策略。

---

## Phase 4: OpenAPI, Docs, And Compatibility

**目标**: 让外部调用方能读取契约，并修正 cron 文档与实际认证模型不一致的问题。

- [x] T018 [US1] 新增 `/api/v1/openapi.json`
  - scope: `src/app/api/v1/openapi.json/route.ts`, optional `src/lib/automation/openapi.ts`
  - maps_to: FR-017 / ADR-003
  - verify: snapshot 覆盖 security scheme、scopes、Idempotency-Key、response envelope、主要 endpoint。

- [x] T019 [US1] 更新 cron 文档
  - scope: `docs/cron-job-setup.md`
  - maps_to: KR-001 / CL-001 / CL-004
  - verify: 文档使用 automation token 语义和 `/api/v1` 示例；旧路径被标记为 legacy 或兼容。

- [x] T020 [US1] 添加 automation contract usage note
  - scope: `docs/` 或 `specs/agent-and-automation-contracts/`，按项目文档习惯选择
  - maps_to: FR-017 / NFR-003
  - verify: 文档说明 token 创建、scope、idempotency header、错误分类、secret redaction。

---

## Phase 5: Verification And Closure Prep

**目标**: 覆盖安全、幂等、兼容、contract 和 workflow replay 的验证证据。

- [x] T021 [Quality] Auth/run/idempotency 单元测试
  - scope: `src/lib/automation/*.test.ts`
  - maps_to: 安全 / 幂等性 / 可观测性
  - verify: `pnpm test src/lib/automation/*.test.ts`

- [x] T022 [Quality] `/api/v1` route 测试矩阵
  - scope: `src/app/api/v1/**/*.test.ts`
  - maps_to: US1-US4 / FR-003 / FR-004 / FR-008
  - verify: auth failure、scope failure、validation failure、success、empty/skipped、dependency failure、idempotency replay。

- [x] T023 [Quality] 旧路径兼容回归测试
  - scope: existing weekly/source route tests or new focused tests
  - maps_to: NFR-004 / ADR-003
  - verify: `/api/weekly/*` 和 `/api/sources/sync-all` 未因 automation token 改造破坏 human JWT 行为。

- [x] T024 [Quality] OpenAPI contract snapshot
  - scope: `/api/v1/openapi.json` test
  - maps_to: FR-017
  - verify: snapshot 或 semantic assertions 覆盖 scopes、schemas、errors。

- [x] T025 [Quality] Static checks
  - scope: whole repo
  - maps_to: delivery baseline
  - verify: `pnpm prisma generate`, `pnpm type-check`, focused `pnpm test` pass。

- [x] T026 [Verify Prep] Runtime smoke script or checklist
  - scope: scripts or `acceptance.md` draft notes
  - maps_to: Evidence Gate / Workflow Replay
  - verify: 创建 automation token，调用一个 read endpoint 和一个 idempotent write endpoint 两次，确认 business fact 不重复、run record 存在。

---

## 依赖与顺序

- T001-T003 是所有实现的基础，必须先完成。
- T004-T009 是 `/api/v1` endpoint 的共享基础，必须先于 T010-T017。
- T010-T017 可按 endpoint 分批实现，但 publish 和 apply 必须等 idempotency wrapper 完成。
- T018-T020 依赖 endpoint contract 稳定后完成。
- T021-T026 随实现同步补充，但最终必须全部通过后才能进入 verify。

关键路径：

```text
T001 -> T002 -> T004/T006/T007 -> T009 -> T010/T012/T013/T015 -> T018 -> T021-T026
```

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 外部自动化稳定触发 | T004, T005, T009, T010, T011, T018, T019 |
| US2 端到端状态与产物交接 | T006, T012, T013, T014, T016 |
| US3 外部副作用隔离确认 | T007, T015, T022, T026 |
| US4 run 审计复盘 | T006, T008, T016, T021, T026 |
| FR-018 Prisma Migrate | T001, T002, T025 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 automation token | T001, T003, T004, T005 | T021, T022 |
| ADR-002 run/idempotency | T001, T006, T007, T008 | T021, T026 |
| ADR-003 v1 + legacy compatibility | T010-T020 | T022, T023, T024 |
| ADR-004 preview-first suggestions | T012, T013, T014 | T022, T026 |
| ADR-005 no Redis job | T006, T010, T011 | T026 |
| 安全 | T004, T005, T020 | T021, T022 |
| 幂等性 | T006, T007, T014, T015 | T021, T022, T026 |
| 可观测性 | T006, T008, T016 | T021, T026 |

---

## Notes

- T002 migration 文件已写入 `prisma/migrations/20260604000000_agent_and_automation_contracts/migration.sql`。由于当前 `DATABASE_URL` 指向的 MySQL 不可达，未能用 `prisma migrate dev --create-only` 自动生成；后续 verify 必须在数据库可达环境跑 `pnpm db:migrate` 或等价 deploy 检查。
- T022 已覆盖 T010-T016、T014、T015 的 focused route tests，包括 auth wrapper 参数、validation/idempotency、empty/skipped、dependency failure、publish conflict。
- T017 选择保留 `/api/v1/ai/score` 为 human-admin JWT 手动单条重评分入口；automation 批量评分入口是 `/api/v1/jobs/score`，已在代码注释、OpenAPI 和文档记录。
- T023 已用 focused tests 覆盖 `/api/sources/sync-all` 与 `/api/weekly/[id]/contents` 仍走 human JWT/auth middleware，不要求 automation token 或 idempotency header。
- T025 evidence: `pnpm db:migrate`, `pnpm prisma generate`, `pnpm lint`, `pnpm build`, `pnpm type-check`, focused `pnpm test ...` passed on 2026-06-04. `pnpm lint` has existing warnings but no errors.
- T026 evidence 已写入 `specs/agent-and-automation-contracts/acceptance.md`；live smoke covered `/api/v1/openapi.json`, `/weekly/candidates`, idempotent `/jobs/score`, idempotency conflict, and `/ai/feedback/digest`.
- `T014` 可在 execute-plan 时决定是否纳入首个实现批次；若跳过，必须在 acceptance 中明确 suggestion 是 preview-only，不能宣称 apply workflow 已闭环。
- OpenAPI 首版建议静态或轻量 TS object，不为生成 OpenAPI 引入新重型工具。
- `automation_runs` 不应变成 job queue；长任务、锁和重试留给后续 `redis-job-orchestration`。

---

## Stage Readiness

- 推荐下一步：`execute-plan`
- 阻塞项：无。任务数量较多且含 migration/auth/API/docs/tests，建议先用 execute-plan 控制实现批次和检查点。
