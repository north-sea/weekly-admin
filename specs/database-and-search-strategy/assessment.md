# Database And Search Strategy - SDD Assessment

**Date**: 2026-06-03
**Stage**: Pre-spec evaluation / Specify candidate
**Feature**: `database-and-search-strategy`

## SDD Stage Decision

Current stage should be **Specify**, not Plan or Tasks.

Reasoning:

- The feature exists only as F6 inside `specs/admin-modernization-roadmap/spec.md`.
- No dedicated `specs/database-and-search-strategy/spec.md`, `plan.md`, or `tasks.md` exists yet.
- The roadmap already defines enough intent to justify a dedicated feature, but the implementation boundary and acceptance criteria still need to be hardened before planning.
- `specs/.active` currently points to `admin-modernization-roadmap`; do not switch it until a dedicated `spec.md` is created.

Subagent status:

- `sdd-docs-researcher`, `sdd-explorer`, and `sdd-reviewer` are present in the Codex manifest with version `2026-05-23`.
- This assessment was completed in the main thread because the current runtime delegation tool only allows spawning agents when the user explicitly requests parallel agents.

## Existing Upstream Definition

F6 already has a clear product direction:

- Keep **MySQL + Prisma** as the business source of truth.
- Use **Postgres/pgvector/hermes-db** as intelligent read model, vector store, preference memory, and agent run log storage.
- Use **Redis** for job, lock, rate limit, and status concerns.
- Downgrade **Meilisearch** to an optional keyword-search backend.
- If reusing NAS `karakeep-meilisearch`, Admin must use an isolated index namespace and must not mix with Karakeep indexes.

Primary references:

- `specs/admin-modernization-roadmap/spec.md:170`
- `specs/admin-modernization-roadmap/spec.md:176`
- `specs/admin-modernization-roadmap/spec.md:179`
- `specs/admin-modernization-roadmap/spec.md:180`
- `specs/admin-modernization-roadmap/plan.md:359`
- `specs/admin-modernization-roadmap/plan.md:365`
- `specs/admin-modernization-roadmap/plan.md:376`

## Current Code Reality

### Database

- Prisma datasource is MySQL: `prisma/schema.prisma:6`.
- `contents` is the central content table: `prisma/schema.prisma:99`.
- The legacy SQL schema includes a MySQL FULLTEXT index over `title`, `description`, and `content`: `database/schema.sql:83`.
- Current Prisma schema does not model a Prisma `@@fulltext` index, so MySQL fallback search should be verified against actual production schema before relying on FULLTEXT.

### Meilisearch

- `src/lib/search.ts` creates a Meilisearch client at module load and defaults to `http://localhost:7700`: `src/lib/search.ts:4`.
- Search index name is hard-coded as `contents`: `src/lib/search.ts:16`.
- Write-side index sync is already best-effort; failures are logged and swallowed: `src/lib/search.ts:150`, `src/lib/search.ts:179`.
- Read-side search still throws on Meilisearch failure: `src/lib/search.ts:242`, `src/lib/search.ts:318`.
- `/api/search` maps Meilisearch connection failures to HTTP 503 with `searchDisabled: true`: `src/app/api/search/route.ts:145`.

### Health Check

- `/api/health` treats search as a required service in the overall health model: `src/app/api/health/route.ts:17`.
- It calls `client.health()` directly: `src/app/api/health/route.ts:144`.
- Search failure sets `overall = 'unhealthy'`, which returns HTTP 503 for the whole app: `src/app/api/health/route.ts:155`.

This contradicts the roadmap requirement that Meilisearch must not block Admin startup or global health.

## Assessment

Verdict: **Proceed as a dedicated SDD feature before broader UI or Hermes work.**

Why:

- The feature addresses an active reliability bug, not just architecture cleanup.
- The current app already partially treats Meilisearch as optional on writes, but still treats it as required on reads and health checks.
- The roadmap depends on clear database boundaries before Hermes, pgvector, Redis, and search UX work can be safely planned.
- The change can be staged with low blast radius if scoped first to health/search degradation and decision documentation.

Priority: **P1 foundation**.

It should come after or alongside migration-tooling baseline work, but before UI-heavy search improvements and before Hermes semantic retrieval depends on Postgres/pgvector semantics.

## Recommended Scope For Dedicated Spec

### In Scope

- Define service roles:
  - MySQL/Prisma: source of truth.
  - Meilisearch: optional keyword search index.
  - Postgres/pgvector/hermes-db: semantic read model and agent memory, not primary OLTP store.
  - Redis: queue/status/lock/rate-limit infrastructure.
- Make Meilisearch unavailable state degrade search capability without making `/api/health` return global 503.
- Add a MySQL fallback search path for basic content discovery when Meilisearch is unavailable.
- Introduce configurable Meilisearch index prefix/name so Admin does not use a generic `contents` index when sharing infrastructure.
- Define NAS Meilisearch reuse decision criteria:
  - Docker network reachability.
  - index isolation.
  - API key scope.
  - backup/restore and operational ownership.
- Define future Postgres migration triggers, explicitly saying current feature does not migrate Admin's primary database.

### Out Of Scope

- Migrating Admin primary database from MySQL to Postgres.
- Implementing pgvector semantic retrieval.
- Implementing Hermes agent workflows.
- Rebuilding search UI.
- Dropping MySQL tables or changing content ownership semantics.
- Sharing Karakeep's existing Meilisearch indexes.

## Key Risks To Capture In Spec

- **Health semantics drift**: deployment health checks may expect `/api/health` to be binary. The spec should define `healthy`, `degraded`, and `unhealthy` semantics explicitly.
- **Fallback search quality**: MySQL fallback will likely be weaker than Meilisearch. Acceptance should focus on availability and basic matching, not relevance parity.
- **Index namespace collision**: current `CONTENT_INDEX = 'contents'` is unsafe if Admin reuses a shared Meilisearch instance.
- **Schema drift**: `database/schema.sql` has a FULLTEXT index, but Prisma schema does not show one. Fallback implementation must verify actual DB indexes or use conservative `contains` queries first.
- **Secrets in local env**: `.env` contains Meilisearch host/key values. Avoid copying those into specs or docs.

## Suggested Acceptance Criteria

- Given Meilisearch is unavailable, `/api/health` returns an app-level healthy or degraded response, not a global unhealthy response caused only by search.
- Given Meilisearch is unavailable, `/api/search` returns successful fallback results or an explicit degraded response according to the selected spec behavior, not an unhandled 503.
- Given Meilisearch is available, `/api/search` uses the configured Admin-specific index name.
- Given Admin is configured to reuse a NAS Meilisearch instance, the index name cannot be the generic `contents` index.
- Given MySQL remains the source of truth, writes to content tables do not require Meilisearch, Postgres, or Redis to succeed.
- Given pgvector/Hermes is introduced later, its data is treated as a read model or memory layer, not as source-of-truth content.

## Recommended Next Step

Create `specs/database-and-search-strategy/spec.md` from the SDD specify stage, then update `specs/.active` to `database-and-search-strategy`.

After the spec is stable, generate:

- `specs/database-and-search-strategy/plan.md`
- `specs/database-and-search-strategy/data-model.md` if index naming, read-model ownership, or sync state needs formal modeling
- `specs/database-and-search-strategy/tasks.md`

