# Acceptance Record: Image Feature Retirement

**Workspace**: `image-feature-retirement` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

---

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| FR-001 Admin 常规图片入口退役 | 周刊封面上传/AI 生成/URL 输入、内容主图上传、Inbox 图片列/裁剪、AI 图片模型设置均已从 UI 删除；内容列表和周刊列表不再使用 hover 图片预览。 | `src/app/(dashboard)/weekly/editor/[id]/page.tsx`, `src/components/content/simplified-editor.tsx`, `src/app/(dashboard)/inbox/page.tsx`, `src/app/(dashboard)/settings/ai/page.tsx`, `src/app/(dashboard)/content/list/page.tsx` | PASS |
| FR-002 图片副作用 API 停止副作用 | `/api/upload/image`、`/api/ai/image`、`/api/inbox/[id]/crop-image` 保留 route 但只返回 410 retired response；handler 不再上传、生成、裁剪、fetch 远端图片或写文件/数据库。 | `src/app/api/upload/image/route.test.ts`, `src/app/api/ai/image/route.test.ts`, `src/app/api/inbox/[id]/crop-image/route.test.ts` | PASS |
| FR-003 无图片周刊预览/发布稳定 | 周刊 preview/share/layout/list 不渲染 `content.image_url` 或 `issue.cover`；Quail payload 不再由 `content.image_url` 注入 Markdown 图片，也不再发送 `cover_image`。 | `src/components/weekly/WeeklyPreview.tsx`, `src/components/weekly/WeeklyIssueLayout.tsx`, `src/lib/services/quail.test.ts` | PASS |
| FR-004 新数据不再写 legacy 图片字段 | sync/promote/content create/update 不再主动传播图片字段；Karakeep/RSS 新写入使用 `image_url: null` 或忽略图片字段；`favicon_url` 保留。 | `src/lib/services/sync-orchestrator.ts`, `src/lib/services/inbox.ts`, `src/lib/services/content.ts`, `src/lib/validations/content.ts` | PASS |
| FR-004A `weekly_issues.cover` 退役图片 URL 语义 | 周刊 UI 不提交 `cover`，weekly create/update API 不再写入 `cover`，Quail 不把 `issue.cover` 当图片封面发送。字段暂不 drop。 | `src/app/api/weekly/route.ts`, `src/app/api/weekly/[id]/route.ts`, `src/lib/services/quail.ts` | PASS |
| FR-005 legacy 图片字段只读兼容 | `ContentService` 仍可读出历史 `image_url`/`cover_image`，但 validation 和 create/update active path 不接受图片写入。 | `src/lib/services/content.ts`, `src/lib/validations/content.ts` | PASS |
| FR-006 图片专用组件/服务/依赖清理 | 删除上传/裁剪/处理组件和服务；`browser-image-compression`、`react-image-crop`、项目直接依赖 `sharp` 已从 `package.json` 移除。`sharp` 仍在 lockfile 中作为 Next 16 optional dependency。 | `package.json`, `pnpm-lock.yaml`, `rg "ImageUploadService|ScreenshotPasteUploader|react-image-crop|browser-image-compression"` | PASS |
| FR-008 配置/健康检查去除图片上传能力 | 启动配置不再校验 `IMAGE_UPLOAD_URL` / `IMAGE_UPLOAD_TOKEN`；startup health response 不再暴露 `imageUpload` capability。 | `src/lib/config-validation.ts`, `src/app/api/health/startup/route.ts` | PASS |

---

## Verification Commands

| Command | Result | Notes |
|---|---|---|
| `pnpm lint` | PASS | 0 errors，仓库仍有既有 warnings。 |
| `pnpm type-check` | PASS | `next typegen && tsc --noEmit` 通过。 |
| `pnpm test` | PASS | 30 files / 113 tests passed。 |
| `pnpm build` | PASS | Next 16.2.7 production build 通过；有既有 Cache-Control warning 和 resource monitoring 日志。 |
| `rg "ImageUploadService|normalizeImageUploadResponse|checkImageStatus|ImageCropper|ScreenshotPasteUploader|HoverImagePreview|browser-image-compression|react-image-crop"` | PASS | 无 active app/package 引用。 |

---

## Producer-Consumer Classification

| Pattern | Classification | Notes |
|---|---|---|
| `/api/upload/image`, `/api/ai/image`, `/api/inbox/[id]/crop-image` | retired route | 仅保留 410 response 和对应测试。 |
| `image_url`, `cover_image` in `ContentService` / types / drafts response | legacy-readonly | 用于历史读取或 API 兼容，不作为 active write 或 UI 阻塞条件。 |
| `image_url` in `sync-orchestrator` | active neutralization | 新建数据显式写 `null`，避免来源图片 metadata 进入 active model。 |
| `favicon_url` | retained | 来源标识，不属于本 feature 退役对象。 |
| `image_model`, `weekly_cover` | db/prompt legacy | 用户可见设置和 `/api/ai/config` active response 已移除；DB 字段与 prompt seed 待 schema migration slice 处理。 |
| `sharp` in `pnpm-lock.yaml` | transitive optional | 项目直接依赖已移除；lockfile 残留来自 `next@16.2.7` optional dependency。 |
| `scripts/迁移/sync-weekly-from-karakeep.ts image_url / IMAGE_UPLOAD_*` | retired migration script | 文件保留为退役提示，运行即非零退出；不再调用图床或写入图片字段。 |
| Markdown body `<img>` rendering | retained content rendering | 用户手写 Markdown 图片不在本 feature 清理范围；自动主图/封面图已清理。 |

---

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | UI/API/service/publish/dependency 层面的 active 图片能力已退役。 |
| Workflow closure | PASS | 上传/生成/裁剪入口、同步写入、promote、内容编辑、周刊保存、预览和 Quail 发布链路均已闭环验证。 |
| User-visible outcome | PASS | Admin 常规路径不再显示图片上传、裁剪、封面、主图、hover 图片预览或 AI 图片配置。 |

**Overall**: PASS

---

## Workflow Replay

- **输入摘要**: 一个历史内容含 `image_url=https://cdn.example.com/a.png`，周刊含 `cover=https://cdn.example.com/cover.png`，发布到 Quail。
- **最终 payload 摘要**: `QuailService.generateQuailContent()` 输出正文包含标题、链接、描述、摘要、标签；不包含 `![title](image_url)`，不包含 `cover_image`。
- **用户可见结果断言**: 周刊预览和列表以标题、摘要、分类、标签、来源链接为主，不渲染内容主图或封面图片。
- **Replay 类型**: fixture，覆盖于 `src/lib/services/quail.test.ts`；UI 层通过静态引用清零与构建验证。

---

## Follow-Up Migration Conditions

本 feature 不 drop 数据库字段。后续删除 `contents.image_url`、`contents.image_source`、`contents.image_width`、`contents.image_height`、`weekly_issues.cover`、`inbox_items.image_url`、`inbox_items.image_status` 或 AI image config 字段前，必须满足：

1. 审计其余历史 schema/data migration 脚本，确认不需要在字段 drop 后继续读取 `image_url` / `image_status`；当前 Karakeep 图片回写脚本已退役为提示文件。
2. 清掉 Astro 展示端对 `weekly_issues.cover` 的技术读取；用户已确认展示端视觉上使用默认 cover。
3. 生成数据快照/备份与 Prisma Migrate migration，不新增 `database/*.sql`。
4. 明确回滚路径：字段 drop 失败时恢复 schema 与快照数据；外部已发布内容不回写。
