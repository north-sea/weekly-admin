# Database And Search Strategy - SDD Assessment

**Date**: 2026-06-03
**Stage**: Verify / Closeout follow-through
**Feature**: `database-and-search-strategy`

## SDD Stage Decision

Current stage is **Verify with Closeout follow-through**, not Specify/Plan/Tasks.

Reasoning:

- Dedicated SDD artifacts now exist: `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, and `acceptance.md`.
- `tasks.md` marks the implementation and verification tasks complete.
- `acceptance.md` contains an evidence table for the P0/P1 requirements.
- Closeout runtime smoke found a production-only fallback issue, so implementation was briefly reopened and fixed locally.

Workspace note:

- `specs/.active` now points to `database-and-search-strategy`.

Subagent status:

- `sdd-docs-researcher`, `sdd-explorer`, and `sdd-reviewer` are present in the Codex manifest with version `2026-05-23`.
- This assessment was completed in the main thread because the available delegation policy only allows spawning agents when the user explicitly asks for parallel agents.

## Evidence Reviewed

SDD artifacts:

- `specs/database-and-search-strategy/spec.md`
- `specs/database-and-search-strategy/plan.md`
- `specs/database-and-search-strategy/data-model.md`
- `specs/database-and-search-strategy/tasks.md`
- `specs/database-and-search-strategy/acceptance.md`

Implementation files:

- `src/lib/search.ts`
- `src/app/api/search/route.ts`
- `src/app/api/health/route.ts`
- `src/lib/search.test.ts`
- `src/app/api/search/route.test.ts`
- `src/app/api/health/route.test.ts`
- `docs/nas-deployment.md`

Fresh verification:

- `pnpm test src/lib/search.test.ts src/app/api/health/route.test.ts src/app/api/search/route.test.ts`
  - Result: PASS, 3 files / 12 tests.
- `pnpm type-check`
  - Result: PASS, `next typegen && tsc --noEmit`.
- `pnpm lint`
  - Result: PASS with warnings only.
  - Warning count: 482 existing warnings across the repo, including `any` warnings in `src/lib/search.ts` and `src/lib/search.test.ts`.
- `pnpm lint --quiet`
  - Result: PASS.
- `pnpm build`
  - Result: PASS.
- NAS runtime smoke before redeploy:
  - `/api/health`: PASS, HTTP 200 with `overall = "degraded"`, database/startup healthy, search degraded.
  - `/api/search`: FAIL on old deployed image, authenticated request reached fallback but returned HTTP 500 because Prisma include used stale relation name `category`.

## Requirement Assessment

| Requirement Area | Evidence | Verdict |
|---|---|---|
| Health degraded semantics | `/api/health` now supports `healthy`, `degraded`, and `unhealthy`; Meilisearch failure returns HTTP 200 when DB/startup are healthy. | PASS |
| Critical dependency failure | Database failure still returns `overall = "unhealthy"` and HTTP 503. | PASS |
| Search fallback | `/api/search` GET/POST call `searchContentsWithFallback`; service falls back to MySQL when Meilisearch search fails. Local tests pass after fixing fallback include to use Prisma relation `categories`. | PASS pending redeploy smoke |
| Fallback metadata | Search responses expose `meta.mode`, `meta.degraded`, `meta.reason`, and unsupported filters where applicable. | PASS |
| Conservative MySQL fallback | Fallback searches `title`, `description`, `summary`, `content`, `source`, and `source_url`, caps limit at 100, and avoids unsupported tag filtering. | PASS |
| Admin index isolation | Default index is `weekly_admin_contents`; `MEILISEARCH_CONTENT_INDEX` is configurable; shared instance with generic `contents` is rejected for writes and routes reads to fallback. | PASS |
| Optional write-side index | Search sync failures remain best-effort and do not block MySQL writes. | PASS |
| Database boundary | MySQL/Prisma remains source of truth; no primary DB migration was added; PG/pgvector and Redis are documented as future read/runtime layers. | PASS |
| Documentation | NAS docs describe Meilisearch as optional and require an Admin-specific index for shared infrastructure. | PASS |

## Architecture Drift Check

Verdict: **No blocking architecture drift found after local fix.**

The implementation matches the plan's CQRS-lite boundary:

- MySQL/Prisma remains the required write and source-of-truth path.
- Meilisearch is now treated as an optional keyword index.
- MySQL fallback exists for availability, not relevance parity.
- Postgres/pgvector and Redis were not introduced in this feature.
- No database migration was added, consistent with the declared scope.

Minor caveat:

- Search suggestions still use Meilisearch directly and degrade to an empty array on failure. This matches `tasks.md` T013, but it does not provide the same machine-readable degraded metadata as main search. Treat this as acceptable because the spec centers fallback metadata on `/api/search` main results, not suggestions.
- Runtime smoke exposed schema drift between the fallback mapper assumption and generated Prisma relation names. The local fix now uses `include.categories` and keeps mapper compatibility with both `categories` and legacy `category` shapes.

## Risks And Follow-ups

- `pnpm lint` passes, but the repository still has many warnings. This feature did not create a clean lint baseline.
- `assessment.md` had previously contained a stale pre-spec evaluation; this file now supersedes it.
- The old deployed NAS image still fails authenticated `/api/search` fallback until the local fix is deployed.
- During smoke investigation, container environment values were exposed in tool output. Production secrets/API keys should be rotated.

## Verdict

**CONDITIONAL PASS pending redeploy smoke**

The local code and SDD evidence are sufficient for redeploy, but not yet sufficient for final Closeout.

Closeout condition:

1. Deploy the fallback relation-name fix.
2. Rerun NAS `/api/health` and authenticated `/api/search` smoke.
3. Update `acceptance.md` with the final runtime result.

Recommended next stage: **Deploy and verify**.
