# Migration Tooling Baseline - Spec Completeness Assessment

**Date**: 2026-06-03
**Feature**: `migration-tooling-baseline`
**Artifact Reviewed**: `specs/migration-tooling-baseline/spec.md`

## Verdict

**Mostly complete, with targeted updates needed before plan.**

The spec is strong enough to preserve the original product intent and can support planning. It has clear problem framing, user stories, acceptance scenarios, functional requirements, non-functional requirements, key entities, out-of-scope boundaries, and clarified decisions.

However, it was written before the newer SDD template and before the Post-F6 roadmap reassessment. It should be lightly updated before generating `plan.md`, mainly to add Feature Traits and refresh stale sequencing/runtime-risk assumptions.

## Completeness Checklist

| Area | Status | Notes |
|---|---|---|
| Problem statement | PASS | Explains why the repo ended up with custom migration scripts and what F1.5 is meant to fix. |
| Current-state discovery | PARTIAL | Useful 2026-05-23 snapshot, but now stale after later DB/search work and Post-F6 runtime smoke. |
| User stories | PASS | Covers developer migration history, deployment automation, and team rollback/reset workflows. |
| Acceptance scenarios | PASS | Concrete enough for plan/tasks; includes migrate status, migrate dev, deploy, reset, and rollback scenarios. |
| Functional requirements | PASS | FR-001 to FR-010 map clearly to baseline, seed, Docker, CI, deprecation, and docs. |
| Non-functional requirements | PASS | Captures zero downtime, compatibility, rollback, and docs completeness. |
| Key entities | PASS | Identifies `_prisma_migrations`, `prisma/migrations/`, `prisma/seed.ts`, legacy script, and SQL workflow. |
| Out of scope | PASS | Correctly excludes historical backfill, F1 rewrite, schema changes, multi-DB support, and migration test framework. |
| Clarifications | PASS | Q1-Q5 are explicit and enough to avoid another clarify round. |
| Stage readiness | PASS | Correctly recommends `plan` and lists no blockers. |
| Feature Traits | FAIL | Missing the newer SDD-required `Feature Traits` section. |
| Quality attributes | PARTIAL | NFRs exist, but no explicit Quality Attributes table for safety, deployability, consistency, and evolvability. |
| Roadmap alignment | PARTIAL | Still uses old F1/F2 sequencing. Current roadmap places this after `database-and-search-strategy` and before `inbox-ai-scoring-continuation`. |

## Missing Or Stale Items

1. **Feature Traits section is missing**

   Suggested classification:

   | Trait | Suggested | Rationale |
   |---|---|---|
   | `multi-stage-workflow` | Yes | Baseline generation, dev resolve, production resolve, seed extraction, deploy automation, and future migration creation are a workflow. |
   | `external-side-effects` | Yes | Production migration metadata write and deploy-time migration execution affect external DB/runtime state. |
   | `artifact-handoff` | Yes | Baseline SQL, `_prisma_migrations`, seed file, docs, and CI output are consumed by later features and deploys. |
   | `user-visible-output` | Yes | Migration workflow documentation and deploy logs are directly visible to developers/operators. |
   | `prior-closure-failure` | Yes | Post-F6 smoke exposed schema/relation drift risk; this feature exists to prevent repeat closure failure around DB changes. |

2. **Current-state evidence needs refresh**

   The spec says the 2026-05-23 database had 18 tables and no schema drift. That may still be true, but it is stale evidence. Before plan, re-run current drift/status checks and update the spec to say the old snapshot is historical.

3. **Roadmap sequencing is outdated**

   The original text says F1.5 sits after F1 and before F2. Current roadmap says it is next after `database-and-search-strategy` and before `inbox-ai-scoring-continuation`. The spec should keep the historical origin but add a 2026-06-03 update so plan does not inherit stale dependencies.

4. **Post-F6 schema drift lesson is absent**

   The latest roadmap records a production-only Prisma relation-name mismatch during search fallback smoke. The spec should mention this as new motivation and acceptance pressure: generated Prisma client, schema, baseline, and production DB must be checked together.

5. **Deployment rollback semantics are too optimistic**

   The spec says migration failure rolls back and deployment stops. That is acceptable at requirement level, but it should acknowledge that MySQL DDL transaction behavior varies by statement and that rollback may require forward-fix migrations. Full implementation details belong in `plan.md`.

6. **Command naming needs normalization**

   The spec mentions `pnpm migrate`, while current `package.json` uses `pnpm db:migrate`. The requirement should explicitly preserve `pnpm db:migrate` compatibility, or intentionally introduce `pnpm migrate` if that is desired.

## Recommended Spec Patch Scope

Before entering plan, update only the spec-level facts:

1. Add `Feature Traits`.
2. Add a short “2026-06-03 Update” under current-state or clarifications:
   - `database-and-search-strategy` is complete.
   - `migration-tooling-baseline` is now next in the roadmap.
   - Post-F6 smoke exposed a real schema/relation drift risk.
3. Change old F1/F2 sequencing language from a hard dependency to historical origin/current placement.
4. Add one FR or NFR for fresh drift/status verification before applying or resolving baseline.
5. Normalize command names around `pnpm db:migrate`.

## Readiness Decision

**Can proceed to plan after a light spec refresh.**

No major user-intent gaps remain. The missing pieces are not conceptual blockers; they are freshness and SDD-template completeness issues.
