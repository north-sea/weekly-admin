# Commit Plan: Product Surface Combined Batch

**Workspace**: `admin-modernization-roadmap`
**Date**: 2026-06-09
**Status**: Awaiting User Confirmation

> This is a cross-feature commit plan created after the user accepted Option B. It does not execute `git add` or `git commit`.

---

## Summary

This batch combines the product-surface files that are already interleaved across:

- `image-feature-retirement`
- `admin-shell-and-weekly-workbench`
- shared workbench UI/service surfaces later consumed by `redis-job-orchestration` and `hermes-weekly-intelligence`

Reason: the current worktree has single files that contain image retirement, workbench, job status, and Hermes display changes together. Splitting these into strict feature commits would require fragile hunk staging. This batch keeps the shared UI surface coherent, then later Redis and Hermes batches can focus on backend/contract/runtime files.

---

## Included Files

### SDD Artifacts

| File | Reason |
|---|---|
| `specs/image-feature-retirement/spec.md` | Image retirement feature spec. |
| `specs/image-feature-retirement/plan.md` | Image retirement plan and ADRs. |
| `specs/image-feature-retirement/data-model.md` | Legacy image-field classification and drop conditions. |
| `specs/image-feature-retirement/tasks.md` | Image retirement execution tasks. |
| `specs/image-feature-retirement/acceptance.md` | Image retirement PASS acceptance. |
| `specs/image-feature-retirement/commit-plan.md` | Image retirement commit planning gate. |
| `specs/admin-shell-and-weekly-workbench/spec.md` | Workbench feature spec. |
| `specs/admin-shell-and-weekly-workbench/plan.md` | Workbench implementation plan and ADRs. |
| `specs/admin-shell-and-weekly-workbench/tasks.md` | Workbench execution tasks. |
| `specs/admin-shell-and-weekly-workbench/acceptance.md` | Workbench PASS acceptance. |
| `specs/admin-shell-and-weekly-workbench/commit-plan.md` | Workbench commit planning gate. |

### Image Retirement Active Path

| File | Reason |
|---|---|
| `src/app/api/upload/image/route.ts`, `src/app/api/upload/image/route.test.ts` | Retire upload side-effect route. |
| `src/app/api/ai/image/route.ts`, `src/app/api/ai/image/route.test.ts` | Retire AI image-generation side-effect route. |
| `src/app/api/inbox/[id]/crop-image/route.ts`, `src/app/api/inbox/[id]/crop-image/route.test.ts` | Retire crop side-effect route. |
| `src/app/api/ai/config/route.ts` | Remove active image model / weekly cover config response. |
| `src/app/(dashboard)/settings/ai/page.tsx` | Remove image model and weekly cover prompt UI. |
| `src/app/(dashboard)/inbox/page.tsx` | Remove inbox image column, crop button, and preview surface. |
| `src/app/(dashboard)/content/list/page.tsx` | Remove content-list hover image preview. |
| `src/components/content/simplified-editor.tsx` | Remove main image upload/input surface. |
| `src/components/content/ScreenshotPasteUploader.tsx` | Delete screenshot/image upload component. |
| `src/components/inbox/image-cropper.tsx` | Delete image cropper component. |
| `src/components/weekly/HoverImagePreview.tsx` | Delete hover image preview component. |
| `src/lib/services/image-upload.ts` | Delete image upload service. |
| `src/lib/services/image-upload-response.ts`, `src/lib/services/image-upload-response.test.ts` | Delete image upload response normalizer and tests. |
| `src/lib/services/image-processor.ts` | Delete image processor service. |
| `src/lib/ai/client.ts` | Remove image model client helper; keep text model helper. |
| `src/lib/services/content.ts` | Stop active image/cover writes while retaining historical reads. |
| `src/lib/services/inbox.ts` | Stop promotion from propagating image fields. |
| `src/lib/services/sync-orchestrator.ts` | Stop new Karakeep/RSS image propagation. |
| `src/lib/services/quail.ts`, `src/lib/services/quail.test.ts` | Remove Quail markdown image and cover image output. |
| `src/lib/validations/content.ts` | Remove active image field validation. |
| `src/app/api/weekly/route.ts`, `src/app/api/weekly/[id]/route.ts` | Stop weekly cover image writes. |
| `scripts/README.md` | Remove image-upload scripts docs and mark Karakeep image sync retired. |
| `scripts/test-image-upload-config.ts`, `scripts/test-image-upload-integration.ts` | Delete image upload test scripts. |
| `scripts/迁移/sync-weekly-from-karakeep.ts` | Retire image-writing migration script. |

### Workbench And Shared Product Surface

| File | Reason |
|---|---|
| `src/app/(dashboard)/dashboard/page.tsx` | Replace dashboard with weekly production dashboard. |
| `src/app/(dashboard)/weekly/page.tsx` | Reduce legacy weekly automation surface and add dashboard path. |
| `src/app/(dashboard)/weekly/editor/[id]/page.tsx` | Integrate workbench, suggestion panel, publish checklist, timeline, and no-image editor flow. |
| `src/app/api/weekly/[id]/contents/route.ts`, `src/app/api/weekly/[id]/contents/route.test.ts` | Support manual arrangement save semantics. |
| `src/app/api/weekly/workbench/summary/route.ts`, `src/app/api/weekly/workbench/summary/route.test.ts` | Cookie-auth workbench summary wrapper. |
| `src/app/api/weekly/workbench/candidates/route.ts`, `src/app/api/weekly/workbench/candidates/route.test.ts` | Cookie-auth workbench candidates wrapper. |
| `src/app/api/weekly/workbench/runs/route.ts`, `src/app/api/weekly/workbench/runs/route.test.ts` | Cookie-auth automation run history wrapper. |
| `src/app/api/weekly/workbench/[id]/suggest/route.ts`, `src/app/api/weekly/workbench/[id]/suggest/route.test.ts` | Cookie-auth suggestion preview wrapper. |
| `src/app/api/weekly/workbench/[id]/apply/route.ts`, `src/app/api/weekly/workbench/[id]/apply/route.test.ts` | Cookie-auth suggestion apply wrapper. |
| `src/app/api/weekly/workbench/[id]/publish/route.ts`, `src/app/api/weekly/workbench/[id]/publish/route.test.ts` | Cookie-auth publish wrapper. |
| `src/app/api/weekly/workbench/[id]/ops-report/route.ts` | Cookie-auth Hermes ops report wrapper for workbench display. |
| `src/components/dashboard/weekly-production-dashboard.tsx`, `src/components/dashboard/weekly-production-dashboard.test.tsx` | Weekly production dashboard UI and tests. |
| `src/components/layout/MenuConfig.tsx`, `src/components/layout/MenuConfig.test.ts` | Production-line navigation. |
| `src/components/weekly/AvailableContentsList.tsx`, `src/components/weekly/AvailableContentsList.test.tsx` | Candidate pool UI with no-image display, scoring, source links, selected state. |
| `src/components/weekly/SelectedContentsList.tsx`, `src/components/weekly/SelectedContentsList.test.tsx` | Selected-content arrangement controls. |
| `src/components/weekly/WeeklyEditor.tsx` | Editor responsive/no-image integration. |
| `src/components/weekly/WeeklyIssueLayout.tsx`, `src/components/weekly/WeeklyIssueLayout.test.tsx` | No-image issue layout regression. |
| `src/components/weekly/WeeklyPreview.tsx`, `src/components/weekly/WeeklyPreview.test.tsx` | No-image preview regression. |
| `src/components/weekly/WeeklyWorkbench.tsx`, `src/components/weekly/WeeklyWorkbench.test.tsx` | Workbench container and shared status surfaces. |
| `src/components/weekly/PublishChecklist.tsx`, `src/components/weekly/PublishChecklist.test.tsx` | Publish gate and confirmation UI. |
| `src/components/weekly/SuggestionPanel.tsx`, `src/components/weekly/SuggestionPanel.test.tsx` | Suggestion preview/apply UI. Hermes-specific display fields are included here as shared UI surface. |
| `src/components/weekly/AutomationRunTimeline.tsx`, `src/components/weekly/AutomationRunTimeline.test.tsx` | Runs/job/Hermes ops timeline UI. |
| `src/lib/services/weekly-workbench.ts`, `src/lib/services/weekly-workbench.test.ts` | Workbench aggregation service shared by dashboard, jobs, and Hermes UI. |
| `src/lib/automation/weekly-suggestions.ts`, `src/lib/automation/weekly-suggestions.test.ts` | Shared suggestion apply behavior, item validation, and source metadata used by workbench and apply wrappers. |
| `src/lib/automation/hermes-artifacts.ts`, `src/lib/automation/hermes-artifacts.test.ts` | Shared preview/report parser used by workbench service and Hermes-ready UI; `/api/v1` register contract stays in the Hermes contract batch. |

---

## Deferred To Later Batches

| File | Target Batch | Reason |
|---|---|---|
| `package.json` | runtime/dependency or Redis batch | Full file mixes image dependency removal with Redis worker/dependency additions. |
| `pnpm-lock.yaml` | runtime/dependency or Redis batch | Full lockfile mixes image dependency deletion and Redis dependency addition. |
| `pnpm-workspace.yaml` | Redis batch | `msgpackr-extract` allowBuild belongs to BullMQ/Redis dependency handling. |
| `src/lib/config-validation.ts` | Redis/runtime config batch | Full file mixes image upload config removal and Redis job queue config. |
| `src/lib/config-validation.test.ts` | Redis/runtime config batch | Job queue config tests. |
| `src/app/api/health/startup/route.ts` | Redis/runtime config batch | Replaces `imageUpload` capability with `jobQueue`. |
| `docs/automation-plan-admin.md`, `docs/cron-job-setup.md`, `docs/nas-deployment.md`, `docker/**` | Redis batch | Worker/runtime/deployment documentation. |
| `src/app/api/weekly/workbench/jobs/route.ts`, `src/app/api/weekly/workbench/jobs/route.test.ts` | Redis batch | Cookie-auth job queue health wrapper depends on `src/lib/jobs/health.ts`. |
| `docs/automation-contracts.md` | Hermes contract batch | Hermes register mode and scopes. |
| `src/app/api/v1/weekly/suggestions/**`, `src/lib/automation/openapi.ts`, `src/app/api/v1/openapi.json/route.test.ts` | Hermes contract batch | Automation-facing register/apply/OpenAPI contract. |
| `src/app/api/v1/jobs/**`, `src/lib/jobs/**`, `src/workers/**` | Redis batch | Queue, worker, status, retry, health. |
| `specs/redis-job-orchestration/**` | Redis batch | Redis SDD artifacts. |
| `specs/hermes-weekly-intelligence/**` | Hermes batch | Hermes SDD artifacts. |
| `specs/admin-modernization-roadmap/**` except this file | Roadmap batch | Roadmap closeout docs. |
| `specs/inbox-ai-scoring/acceptance.md` | unresolved | Older FAIL closeout residue conflicts with later continuation acceptance; decide separately. |

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| Cross-feature commit | One commit spans image retirement, workbench, and shared status/Hermes-ready UI. | Commit message and description must state it is a combined product-surface batch. |
| Deferred dependency cleanup | Product surface commit may not include package/lock image dependency cleanup. | Runtime/dependency batch must follow before final roadmap closeout. |
| Shared UI includes future fields | Suggestion/timeline UI includes Hermes/job-ready display before Hermes backend batch. | Backend contract commits follow later; tests already cover fixture/UI behavior. |
| Dirty worktree | Wide add would include Redis/Hermes/roadmap files. | Add only exact files from Included Files after explicit submit confirmation. |

---

## Commit Batch

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files only | `feat(weekly): ship product surface and retire image workflows` | Keeps already-interleaved product UI, no-image workflow, workbench wrappers, and shared status/suggestion surfaces together. |

---

## Execution Rules

- Do not commit until the user says `确认提交 product-surface`.
- Do not use `git add -A` or `git add .`.
- Before committing, run `git diff --cached --name-only` and verify only included files are staged.
- Run `git diff --cached --check` before commit.
- Do not push.
