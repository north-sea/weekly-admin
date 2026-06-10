# Context Manifest: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence`
**Created**: 2026-06-08
**Status**: active

> 本文件记录后续 implement / verify 必须优先读取的高信号上下文。它不是待修改源文件清单，也不替代实现阶段按需阅读代码。

---

## Implement Context

| File / Source | Reason | Phase | Required |
|---|---|---|---|
| `specs/hermes-weekly-intelligence/spec.md` | 定义 Hermes 不直写 MySQL、不直接发布、PG/pgvector 只做读模型的需求边界 | implement | yes |
| `specs/hermes-weekly-intelligence/plan.md` | 包含 Producer-Consumer Matrix、ADR、workbench consumer 和 degraded workflow replay 设计 | implement | yes |
| `specs/hermes-weekly-intelligence/data-model.md` | 定义 suggestion artifact、ops report、preference memory、staleness 和无 Admin DDL 约束 | implement | yes |
| `specs/hermes-weekly-intelligence/tasks.md` | 后续实现的任务边界、依赖顺序和验证点 | implement | yes |
| `docs/automation-contracts.md` | 现有 automation token、scope、idempotency、response envelope 和 endpoint 契约 | implement | yes |
| `src/app/api/v1/weekly/suggestions/route.ts` | 现有 weekly suggestion preview endpoint，需要扩展 register mode 且保持兼容 | implement | yes |
| `src/app/api/v1/weekly/suggestions/[id]/apply/route.ts` | 现有 apply endpoint，路径参数实际是 weekly issue id，写回必须保留 Admin 控制 | implement | yes |
| `src/lib/automation/weekly-suggestions.ts` | 现有 apply 校验和 MySQL 写入边界，Hermes 不能绕过该服务 | implement | yes |
| `src/lib/services/weekly-workbench.ts` | Workbench service 聚合 candidates、runs、suggest/apply wrapper，是 Hermes artifact 的 Admin-side consumer 入口 | implement | yes |
| `src/components/weekly/SuggestionPanel.tsx` | 用户可见建议预览和人工 apply surface | implement | yes |
| `src/components/weekly/AutomationRunTimeline.tsx` | 现有 runs surface，应承载 ops report 摘要而非新增任务中心 | implement | yes |

---

## Check Context

| File / Source | Reason | Phase | Required |
|---|---|---|---|
| `specs/hermes-weekly-intelligence/spec.md` | 验证 P1/P2 scenarios、FR/NFR 和外部边界 | verify | yes |
| `specs/hermes-weekly-intelligence/plan.md` | 检查实现是否漂移出 ADR、矩阵和降级策略 | verify | yes |
| `specs/hermes-weekly-intelligence/data-model.md` | 检查是否误建 Admin PG/Prisma schema，artifact 是否符合 schema/status taxonomy | verify | yes |
| `specs/hermes-weekly-intelligence/tasks.md` | 检查任务是否完成且有验证证据 | verify | yes |
| `docs/automation-contracts.md` | 确认外部 Hermes 调用文档与实现一致 | verify | yes |
| `src/lib/automation/openapi.ts` | 确认 OpenAPI 暴露 register mode、artifact schema 和 apply 语义 | verify | yes |
| `src/app/api/v1/weekly/suggestions/route.test.ts` | API contract regression guard | verify | yes |
| `src/app/api/v1/weekly/suggestions/[id]/apply/route.test.ts` | apply 写回和拒绝路径 regression guard | verify | yes |
| `src/lib/services/weekly-workbench.test.ts` | Workbench service consumer regression guard | verify | yes |
| `src/components/weekly/SuggestionPanel.test.tsx` | Hermes suggestion user-visible output regression guard | verify | yes |
| `src/components/weekly/AutomationRunTimeline.test.tsx` | ops report / history-only user-visible output regression guard | verify | yes |

---

## Research Context

| File / Source | Reason | Phase | Verified |
|---|---|---|---|
| `specs/database-and-search-strategy/data-model.md` | 已固定 PG/pgvector 是可重建读模型，不是事实源 | plan / implement / verify | yes |
| `specs/admin-modernization-roadmap/plan.md` | Roadmap 中 Hermes Intelligence 的上游边界和推荐顺序来源 | plan / verify | yes |
| `specs/admin-modernization-roadmap/tasks.md` | Roadmap current readiness 和 T015 消费闭环状态 | plan / verify | yes |
| `src/lib/jobs/status.ts` | Redis status expired -> history-only 的实际语义 | implement / verify | yes |
| `src/app/api/health/route.ts` | jobQueue degraded 不应让 Admin 整体不可用 | implement / verify | yes |

---

## Rules

- `Required = yes` 的本地文件不存在时，当前阶段必须回退到 `plan` 或 `tasks` 修正 manifest。
- 不要把 Hermes skill 本体、NAS service、PG/pgvector migration 写入本 Admin repo。
- 不复制长文档；只记录路径、用途和短摘要。
- 不引入 `.trellis/`、Trellis CLI、hook、task.py 或自动 context injection。
