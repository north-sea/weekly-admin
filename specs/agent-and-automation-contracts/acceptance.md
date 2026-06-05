# Acceptance: Agent And Automation Contracts

**Date**: 2026-06-04  
**Status**: Accepted in local/deployment-connected smoke on 2026-06-04.

## Implemented Contract

- Automation tokens are separate from human JWT and use `wa_` bearer tokens stored as hashes.
- `/api/v1` endpoints use automation scope checks, run records, idempotency keys, and the `success/data/error/meta` envelope.
- Legacy human-admin routes remain on human JWT/auth middleware.
- OpenAPI is available at `GET /api/v1/openapi.json`.
- Cron and external caller docs now use automation token semantics.

## Runtime Smoke Checklist

Run this in an environment where `DATABASE_URL` points to the deployed MySQL database and migrations have been applied.

1. Apply migration and generate client:

```bash
pnpm db:migrate
pnpm prisma generate
```

2. Create a minimum-scope automation token:

```bash
pnpm tsx scripts/create-automation-token.ts \
  --name smoke-automation \
  --caller-type smoke \
  --scopes sync:run,score:run,weekly:read,weekly:suggest,weekly:publish,ops:read
```

3. Read endpoint smoke:

```bash
curl -sS "$WEEKLY_API_URL/api/v1/weekly/candidates?weekOffset=0&limit=5" \
  -H "Authorization: Bearer $AUTOMATION_TOKEN"
```

Expected:

- HTTP 200.
- `success: true`.
- `meta.runId` exists.
- `meta.status` is `succeeded` or `empty`.

4. Idempotent write endpoint smoke:

```bash
curl -sS -X POST "$WEEKLY_API_URL/api/v1/jobs/score" \
  -H "Authorization: Bearer $AUTOMATION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: smoke-score-$(date +%Y-%m-%d)" \
  -d '{"limit":1,"delay":0}'
```

Repeat the same command with the same body and key.

Expected:

- First call returns `success: true` with `meta.runId`.
- Second call returns the same `runId` or recorded result with `meta.idempotentReplay: true`.
- `automation_runs` has one row for the token/workflow/step/idempotency key.
- No duplicate business fact is created by the replay.

5. Conflict smoke:

Repeat step 4 with the same `Idempotency-Key` and a different body, for example `{"limit":2,"delay":0}`.

Expected:

- HTTP 409.
- `error.code: IDEMPOTENCY_PAYLOAD_CONFLICT`.

6. Feedback digest smoke:

```bash
curl -sS "$WEEKLY_API_URL/api/v1/ai/feedback/digest?from=2026-06-01&to=2026-06-04" \
  -H "Authorization: Bearer $AUTOMATION_TOKEN"
```

Expected:

- HTTP 200.
- `data.actions` is an array.
- `data.counts` is an object.
- Empty data is reported as success with `meta.status: empty`.

## Verification Evidence

Commands run locally:

```bash
pnpm db:migrate
pnpm prisma generate
pnpm lint
pnpm build
pnpm type-check
pnpm test src/proxy.test.ts src/lib/automation/auth.test.ts src/lib/automation/run.test.ts src/lib/automation/contracts.test.ts src/lib/automation/weekly-candidates.test.ts src/lib/automation/weekly-suggestions.test.ts src/app/api/v1/jobs/sync/route.test.ts src/app/api/v1/jobs/score/route.test.ts src/app/api/v1/weekly/candidates/route.test.ts src/app/api/v1/weekly/suggestions/route.test.ts 'src/app/api/v1/weekly/suggestions/[id]/apply/route.test.ts' src/app/api/v1/weekly/publish/route.test.ts src/app/api/v1/ai/feedback/digest/route.test.ts src/app/api/v1/openapi.json/route.test.ts src/app/api/sources/sync-all/route.test.ts 'src/app/api/weekly/[id]/contents/route.test.ts'
```

Results:

- Prisma migration `20260604000000_agent_and_automation_contracts` applied successfully to MySQL `weekly_blog`.
- Prisma Client generated successfully.
- Lint passed with existing warnings only.
- Production build passed.
- TypeScript check passed.
- Focused test matrix passed: 16 files, 48 tests.

Live smoke:

- Created temporary automation token `smoke-automation-20260604`.
- Started local production server on port `3025`.
- `GET /api/v1/openapi.json` returned HTTP 200 after adding `/api/v1` proxy pass-through.
- `GET /api/v1/weekly/candidates?weekOffset=0&limit=5` returned `success: true`, `meta.status: empty`, and `meta.runId`.
- Two identical `POST /api/v1/jobs/score` calls returned the same runId; second response had `meta.idempotentReplay: true`.
- Same idempotency key with different payload returned HTTP 409 and `IDEMPOTENCY_PAYLOAD_CONFLICT`.
- `GET /api/v1/ai/feedback/digest` returned `success: true`, actions array, counts object, and `meta.runId`.
- Temporary smoke token was revoked after verification.
