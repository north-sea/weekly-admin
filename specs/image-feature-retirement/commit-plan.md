# Commit Plan: Image Feature Retirement

**Workspace**: `image-feature-retirement`
**Date**: 2026-06-09
**Status**: Superseded For Shared UI By Product-Surface Combined Plan

> Commit plan 是提交前的用户确认 gate。未获得用户明确确认前，不得执行 `git add` 或 `git commit`。

---

## Summary

`image-feature-retirement` 已完成 PASS closeout，但当前工作树同时包含 workbench、Redis job、Hermes 和 roadmap closeout 的未提交改动。图片退役与后续 UI 工作台在若干周刊组件中有交叉，`package.json` / `pnpm-lock.yaml` 也同时包含图片依赖删除和 Redis 依赖新增。

用户已确认采用 Option B。共享 UI/service 文件由 [../admin-modernization-roadmap/product-surface-commit-plan.md](../admin-modernization-roadmap/product-surface-commit-plan.md) 统一处理；本文件保留为 image feature 的归属依据。

---

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `specs/image-feature-retirement/spec.md` | 当前 feature 规格。 | Requirements / Feature Traits。 |
| `specs/image-feature-retirement/plan.md` | 当前 feature 方案和 ADR。 | Producer-Consumer classification。 |
| `specs/image-feature-retirement/data-model.md` | legacy image fields 与 drop 前置条件。 | Follow-Up Migration Conditions。 |
| `specs/image-feature-retirement/tasks.md` | T001-T021 执行任务。 | 全部任务已完成。 |
| `specs/image-feature-retirement/acceptance.md` | 持久验收记录。 | Evidence Table / Verdict Summary / Workflow Replay。 |
| `specs/image-feature-retirement/commit-plan.md` | 当前提交计划。 | SDD closeout commit gate。 |
| `src/app/api/upload/image/route.ts`, `src/app/api/upload/image/route.test.ts` | 图片上传 API 退役为 410，无外部上传副作用。 | FR-002 / acceptance。 |
| `src/app/api/ai/image/route.ts`, `src/app/api/ai/image/route.test.ts` | AI 图片生成 API 退役为 410，无外部模型调用。 | FR-002 / acceptance。 |
| `src/app/api/inbox/[id]/crop-image/route.ts`, `src/app/api/inbox/[id]/crop-image/route.test.ts` | Inbox crop API 退役为 410，无 fetch、sharp、DB 写入。 | FR-002 / acceptance。 |
| `src/app/api/ai/config/route.ts` | active AI config response 不再暴露 image model / weekly cover prompt。 | FR-001 / FR-008。 |
| `src/app/(dashboard)/settings/ai/page.tsx` | AI 设置页移除图片模型和 `weekly_cover` prompt surface。 | T008。 |
| `src/app/(dashboard)/inbox/page.tsx` | Inbox 移除图片列、裁剪按钮和图片预览。 | T007。 |
| `src/app/(dashboard)/content/list/page.tsx` | 内容列表移除 hover 图片预览。 | FR-001。 |
| `src/components/content/simplified-editor.tsx` | 内容编辑器移除主图上传/输入。 | T004 / T005。 |
| `src/components/content/ScreenshotPasteUploader.tsx` | 删除截图粘贴上传组件。 | T014。 |
| `src/components/inbox/image-cropper.tsx` | 删除图片裁剪组件。 | T014。 |
| `src/components/weekly/HoverImagePreview.tsx` | 删除周刊 hover 图片预览组件。 | T012 / T014。 |
| `src/lib/services/image-upload.ts` | 删除图床上传服务。 | T014。 |
| `src/lib/services/image-upload-response.ts`, `src/lib/services/image-upload-response.test.ts` | 删除图片上传 response normalizer 和测试。 | T014。 |
| `src/lib/services/image-processor.ts` | 删除图片处理服务。 | T014。 |
| `src/lib/ai/client.ts` | 移除图片模型调用 helper，保留 text model path。 | T002。 |
| `src/lib/services/content.ts` | `image_url` / `cover_image` active write 降级。 | FR-004 / FR-005。 |
| `src/lib/services/inbox.ts` | promote 不再传播 `image_url`。 | T010。 |
| `src/lib/services/sync-orchestrator.ts` | Karakeep/RSS 新数据不再写来源图片。 | T009。 |
| `src/lib/services/quail.ts`, `src/lib/services/quail.test.ts` | Quail payload 不再输出 Markdown 图片或 `cover_image`。 | T013 / Workflow Replay。 |
| `src/lib/validations/content.ts` | create/update active schema 不再接受图片字段。 | T011。 |
| `src/app/api/weekly/route.ts`, `src/app/api/weekly/[id]/route.ts` | 周刊 create/update 不再写图片 cover。 | FR-004A。 |
| `scripts/README.md` | 删除图片上传测试脚本说明，标记 Karakeep 图片回写脚本退役。 | T014 / T020。 |
| `scripts/test-image-upload-config.ts`, `scripts/test-image-upload-integration.ts` | 删除图片上传配置/集成测试脚本。 | T014。 |
| `scripts/迁移/sync-weekly-from-karakeep.ts` | 退役会写 `contents.image_url` 的历史迁移脚本。 | Producer-Consumer Classification。 |

---

## Mixed / Needs User Decision

| File | Why Uncertain | Question |
|---|---|---|
| `package.json` | 同时删除图片依赖 `browser-image-compression`、`react-image-crop`、`sharp`，并新增 Redis `worker:automation`、`bullmq`、`ioredis`。 | 是否允许在 image 提交中包含完整当前 `package.json`，还是后续用 hunk 拆分？ |
| `pnpm-lock.yaml` | 同时包含图片依赖删除和 Redis/BullMQ/ioredis 依赖新增。 | 是否允许做混合依赖批次，还是必须拆成 image lock 和 Redis lock？ |
| `pnpm-workspace.yaml` | `msgpackr-extract` allowBuilds 属于 Redis/BullMQ 依赖，不属于图片退役。 | 是否排除到 Redis batch？ |
| `src/lib/config-validation.ts` | 同时删除 image upload config，并新增 Redis/job queue config。 | 是否用 hunk 拆分，或放入 Redis/config 综合批次？ |
| `src/lib/config-validation.test.ts` | Redis job queue config tests，依赖上面的混合 config 文件。 | 是否归入 Redis batch？ |
| `src/app/api/health/startup/route.ts` | 从 `imageUpload` capability 改为 `jobQueue` capability，横跨 image retirement 和 Redis job。 | 是否归入 image、Redis，还是综合 config batch？ |
| `src/app/(dashboard)/weekly/editor/[id]/page.tsx` | 同时移除封面图/上传/AI cover，并接入 workbench、suggestion、publish、runs。 | 是否归入 workbench 综合提交，还是 hunk 拆分出 image 部分？ |
| `src/components/weekly/AvailableContentsList.tsx` | 同时移除 image preview，并新增候选池评分/来源/状态 UX。 | 是否归入 workbench 综合提交，还是 hunk 拆分？ |
| `src/components/weekly/SelectedContentsList.tsx` | 同时移除 hover image，并新增 section/featured 编排控件。 | 是否归入 workbench 综合提交，还是 hunk 拆分？ |
| `src/components/weekly/WeeklyPreview.tsx`, `src/components/weekly/WeeklyIssueLayout.tsx` | no-image 回归属于 image retirement，也被 workbench preview 消费。 | 是否归入 image，还是 workbench/product-surface 综合提交？ |

> 只要存在 Needs User Decision 项，就不得执行提交。

---

## Excluded Files

| File | Reason |
|---|---|
| `specs/.active` | 当前 final active 指向 roadmap closeout，不属于 image feature commit。 |
| `specs/admin-modernization-roadmap/**` | Roadmap closeout 和状态回写另行提交。 |
| `specs/admin-shell-and-weekly-workbench/**` | Workbench 子 feature 产物，另有 commit plan。 |
| `specs/redis-job-orchestration/**` | Redis 子 feature 产物，另有 commit plan。 |
| `specs/hermes-weekly-intelligence/**` | Hermes 子 feature 产物，另有 commit plan。 |
| `src/app/api/v1/jobs/**`, `src/lib/jobs/**`, `src/workers/**` | Redis job orchestration。 |
| `src/lib/automation/hermes-artifacts*` | Hermes weekly intelligence。 |
| `docs/automation-contracts.md`, `docs/automation-plan-admin.md`, `docs/nas-deployment.md`, `docker/**` | Automation/Redis/Hermes 文档或部署。 |

---

## Recommended Handling

推荐顺序：

1. 先决定 mixed files 策略。
2. 如果允许综合 product-surface 提交：把 image retirement + admin-shell/workbench 的共享 UI 文件放同一批。
3. 如果要求严格子 feature 拆分：提交前必须用精确 patch/hunk staging 拆 `package.json`、lockfile、config 和 weekly UI 文件。
4. Redis 和 Hermes 提交必须排在相关 shared workbench 文件归属确定之后。

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| Mixed dependency files | 直接提交会把 Redis 依赖带进 image feature。 | 用户先确认是否接受综合依赖批次。 |
| Shared weekly UI files | image 与 workbench 变更交织，单文件提交会混合两个 feature。 | 选择综合 product-surface batch，或进行 hunk staging。 |
| Deletions | 删除图片服务和组件风险高于普通 patch。 | acceptance 已记录 lint/type-check/test/build 和静态引用清零。 |
| Dirty worktree | 宽泛 add 会混入 Redis/Hermes/roadmap 文件。 | 只允许 add Included Files 和用户确认的 mixed files；禁止 `git add -A`。 |

---

## Commit Batches

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files + 用户确认的 mixed image files | `feat(images): retire admin image workflows` | 停副作用、删入口、清写入、发布无图片和验收记录需要保持一致。 |

---

## User Confirmation

用户已确认：

- `product-surface 合并`: image + workbench 共享 UI 文件按综合批次处理。
- 提交前仍需用户明确说 `确认提交 product-surface`。
