# Commit Plan: Runtime Dependency And Config Batch

**Workspace**: `admin-modernization-roadmap`
**Date**: 2026-06-10
**Status**: Awaiting User Confirmation

> This plan follows the accepted Option B queue. It does not execute `git add` or `git commit`.

---

## Summary

This batch handles mixed runtime files that cannot cleanly belong only to `image-feature-retirement` or only to `redis-job-orchestration`.

It includes:

- image dependency removal from `package.json` / `pnpm-lock.yaml`
- Redis/BullMQ/ioredis dependency addition
- automation worker script
- job queue environment validation
- startup health capability change from image upload to job queue
- `msgpackr-extract` build approval for BullMQ transitive optional native dependency

This batch should be committed after the product-surface batch and before the Redis backend/runtime batch.

---

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `package.json` | Removes retired image dependencies and adds `worker:automation`, `bullmq`, `ioredis`. | `image-feature-retirement` T015; `redis-job-orchestration` FR-001. |
| `pnpm-lock.yaml` | Lockfile update for image dependency removal and Redis/BullMQ/ioredis dependency graph. | Product surface and Redis runtime verification evidence. |
| `pnpm-workspace.yaml` | Adds `msgpackr-extract: true` allowBuild for BullMQ/msgpackr optional native dependency. | `redis-job-orchestration` acceptance tooling note. |
| `src/lib/config-validation.ts` | Removes image upload config validation and adds Redis/job queue environment config validation. | `image-feature-retirement` FR-008; `redis-job-orchestration` NFR-004. |
| `src/lib/config-validation.test.ts` | Tests Redis/job queue config validation. | `redis-job-orchestration` focused tests. |
| `src/app/api/health/startup/route.ts` | Startup capability changes from `imageUpload` to `jobQueue`. | Image upload is retired; Redis job queue is optional/degraded runtime capability. |

---

## Excluded Files

| File | Target Batch | Reason |
|---|---|---|
| `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts` | Redis backend/runtime batch | Health jobQueue runtime summary depends on `src/lib/jobs/health.ts`. |
| `src/lib/jobs/**`, `src/app/api/v1/jobs/**`, `src/workers/**` | Redis backend/runtime batch | Queue/worker/status/retry implementation. |
| `docs/automation-plan-admin.md`, `docs/cron-job-setup.md`, `docs/nas-deployment.md`, `docker/**` | Redis backend/runtime batch | Worker runtime/deployment docs and image support. |
| `docs/automation-contracts.md`, `src/app/api/v1/weekly/suggestions/**`, `src/lib/automation/openapi.ts`, `src/app/api/v1/openapi.json/route.test.ts` | Hermes contract batch | Hermes register/apply/OpenAPI contract. |
| `src/lib/automation/hermes-artifacts*`, `src/lib/automation/weekly-suggestions*` | Product-surface batch | Shared parser/helper files are required by workbench UI/service. |
| Product UI files | Product-surface batch | Already covered by `product-surface-commit-plan.md`. |

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| Mixed dependency intent | One dependency commit covers both image retirement and Redis additions. | Commit message must say runtime dependency/config, not a single feature. |
| Lockfile drift | Lockfile may include transitive optional packages from install environment. | Keep paired with `package.json` and `pnpm-workspace.yaml`; run focused verification before final roadmap closeout. |
| Job queue config before Redis implementation commit | Config can land before full Redis backend batch. | This is acceptable only because Redis is optional/degraded until backend batch lands. |

---

## Commit Batch

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files only | `chore(runtime): update dependencies and job queue config` | Keeps dependency, lockfile, allowBuilds, config validation, and startup capability aligned. |

---

## Execution Rules

- Do not commit until the user says `确认提交 runtime-config`.
- Do not use `git add -A` or `git add .`.
- Before committing, verify staged files match Included Files.
- Run `git diff --cached --check` before commit.
- Do not push.
