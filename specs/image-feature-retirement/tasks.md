# Tasks: Image Feature Retirement

**Workspace**: `image-feature-retirement` | **Date**: 2026-06-06
**Input**: `specs/image-feature-retirement/spec.md` + `plan.md`
**Prerequisites**: spec.md, plan.md, data-model.md

---

## 执行原则

- 先停副作用，再删入口，再清写入和发布输出。
- `weekly_issues.cover` 不再是视觉阻塞；只退役图片 URL 语义，drop 前清跨仓技术读取。
- `favicon_url` 不纳入图片退役，验证它不被误删。
- 本轮不新增 `database/*.sql`；schema drop 只在后续迁移段执行。

---

## Phase 1: 停止图片副作用 API

**目标**: 保证旧图片入口即使被调用，也不会上传、生成、裁剪、写本地文件或调用外部模型。

- [x] T001 [US1] 将 `/api/upload/image` 改为 retired response 或删除 route
  - scope: `src/app/api/upload/image/route.ts`, `src/proxy.ts` 或 auth matcher 相关文件
  - maps_to: US1-5, FR-002, ADR-001, 外部副作用
  - verify: 调用该 API 不触发 `IMAGE_UPLOAD_URL` fetch，不写 `public/uploads`；相关 route 测试或 handler 测试覆盖

- [x] T002 [US1] 将 `/api/ai/image` 改为 retired response 或删除 route
  - scope: `src/app/api/ai/image/route.ts`, `src/lib/ai/client.ts`
  - maps_to: US1-1, US1-5, FR-002, ADR-004
  - verify: 无外部 image model fetch；`rg "/api/ai/image|generateImage"` 无 active client 引用

- [x] T003 [US1] 将 `/api/inbox/[id]/crop-image` 改为 retired response 或删除 route
  - scope: `src/app/api/inbox/[id]/crop-image/route.ts`
  - maps_to: US1-3, US1-5, FR-002
  - verify: handler 不再 fetch remote image，不再 update `image_url` / `image_status`

---

## Phase 2: 移除 Admin 图片 UI Surface

**目标**: 用户常规路径不再看到图片上传、裁剪、主图、图片封面或 AI 图片配置入口。

- [x] T004 [US1] 移除内容编辑器主图上传和主图输入
  - scope: `src/components/content/simplified-editor.tsx`, `src/components/content/ScreenshotPasteUploader.tsx`
  - maps_to: US1-2, FR-001, ADR-001
  - verify: 内容表单不渲染 `image_url` 输入和 `ScreenshotPasteUploader`；submit payload 不含 `image_url`

- [x] T005 [US1] 处理 Blog `cover_image` surface
  - scope: `src/components/content/simplified-editor.tsx`, `src/lib/services/content.ts`, `src/lib/validations/content.ts`
  - maps_to: FR-001, plan risk `cover_image`
  - verify: 若随本轮退役，UI 和 payload 不含 `cover_image`；若保留，tasks/implementation 注释明确它不是周刊图片退役对象并保留测试

- [x] T006 [US1] 移除周刊编辑器封面图片入口
  - scope: `src/app/(dashboard)/weekly/editor/[id]/page.tsx`, `src/app/api/weekly/route.ts`, `src/app/api/weekly/[id]/route.ts`
  - maps_to: US1-1, US2-3, FR-001, FR-004A, ADR-002
  - verify: UI 不提交图片 URL `cover`；API 不再要求 URL 格式；展示端默认 cover 不依赖 Admin 图片 URL

- [x] T007 [US1] 移除 Inbox 图片预览、状态和裁剪 UI
  - scope: `src/app/(dashboard)/inbox/page.tsx`, `src/components/inbox/image-cropper.tsx`
  - maps_to: US1-3, FR-001
  - verify: 页面不渲染 crop 按钮/modal；历史 `image_url` 不阻塞列表和 promote

- [x] T008 [US1] 移除 AI 设置中的图片模型和周刊封面 prompt surface
  - scope: `src/app/(dashboard)/settings/ai/page.tsx`, `src/app/api/ai/config/route.ts`
  - maps_to: US3-6, FR-001, ADR-004
  - verify: settings UI 不显示/提交 `image_model` 或 `weekly_cover`；`/api/ai/config` active response 不暴露图片生成配置，或以 legacy 字段明确隔离

---

## Phase 3: 清理服务写入和发布输出

**目标**: 新数据不再写 legacy 图片字段，周刊输出不再包含图片 Markdown 或图片封面 payload。

- [x] T009 [US3] 停止 sync 写入 `inbox_items.image_url` / `image_status`
  - scope: `src/lib/services/sync-orchestrator.ts`, `src/lib/rss/image-extractor.ts`, `src/lib/validations/rss.ts`, `src/lib/validations/data-source.ts`, `src/hooks/queries/useRssQueries.ts`
  - maps_to: US3-1, US3-5, FR-004, ADR-003
  - verify: Karakeep/RSS sync 忽略 image metadata；`favicon_url` 保留；相关 tests 更新

- [x] T010 [US3] 停止 Karakeep resync 和 promote 传播图片字段
  - scope: `src/lib/services/karakeep-resync.ts`, `src/lib/services/inbox.ts`, `src/app/api/drafts/route.ts`, `src/app/api/drafts/[id]/route.ts`
  - maps_to: US1-3, US3-1, FR-004
  - verify: drafts/promote response 不把 `image_url` 作为 active 字段写入内容；favicon 来源信息不受影响

- [x] T011 [US3] 将 ContentService 图片字段降级为 legacy-readonly
  - scope: `src/lib/services/content.ts`, `src/types/content.ts`, `src/lib/validations/content.ts`
  - maps_to: FR-004, FR-005, data-model.md
  - verify: create/update validation 不接受 active `image_url` 写入；历史读取不导致运行错误

- [x] T012 [US2] 清理周刊预览和列表中的图片渲染
  - scope: `src/components/weekly/WeeklyPreview.tsx`, `src/components/weekly/WeeklyIssueLayout.tsx`, `src/components/weekly/AvailableContentsList.tsx`, `src/components/weekly/SelectedContentsList.tsx`, `src/components/weekly/HoverImagePreview.tsx`
  - maps_to: US2-1, FR-003
  - verify: 周刊 UI 不渲染内容主图；无图内容布局稳定

- [x] T013 [US2] 清理发布 payload 图片输出
  - scope: `src/lib/services/quail.ts`, `src/lib/services/quail-api.ts` types if needed
  - maps_to: US2-2, FR-003, ADR-002
  - verify: Quail payload 不包含由 `content.image_url` 生成的 Markdown 图片，不把 `issue.cover` 当作图片 `cover_image`

---

## Phase 4: 删除死代码和依赖

**目标**: 移除已经无 active consumer 的图片专用模块和依赖，降低构建和维护成本。

- [x] T014 [Cleanup] 删除无引用图片上传/裁剪/处理模块
  - scope: `src/lib/services/image-upload.ts`, `src/lib/services/image-upload-response.ts`, `src/lib/services/image-processor.ts`, `src/components/content/ScreenshotPasteUploader.tsx`, `src/components/inbox/image-cropper.tsx`
  - maps_to: FR-006, 成本质量属性
  - verify: `rg "ImageUploadService|normalizeImageUploadResponse|checkImageStatus|ImageCropper|ScreenshotPasteUploader"` 无 active 引用

- [x] T015 [Cleanup] 清理图片专用依赖
  - scope: `package.json`, `pnpm-lock.yaml`
  - maps_to: FR-006, 成本质量属性
  - verify: 移除 `browser-image-compression`、`react-image-crop`；`sharp` 仅在确认 Admin 无用途且 build 通过时移除，否则记录保留原因

- [x] T016 [Cleanup] 更新配置和健康检查中的图片上传能力
  - scope: `src/lib/config-validation.ts`, `src/app/api/health/startup/route.ts`, docs if needed
  - maps_to: FR-008
  - verify: health/startup 不再提示 image upload configured/not_configured 为 active capability

---

## Phase 5: 验证与收口

**目标**: 用静态、自动化和行为证据证明图片功能已从 Admin active path 退役。

- [x] T017 [Verify] 补充/更新单元测试
  - scope: affected service/API tests near changed files
  - maps_to: US1, US2, US3, Evidence Gate
  - verify: tests 覆盖 retired API、不写图片字段、发布 payload 无图片

- [x] T018 [Verify] 运行静态验证命令
  - scope: full repo
  - maps_to: NFR-001
  - verify: `pnpm lint`, `pnpm type-check`, `pnpm test`

- [x] T019 [Verify] 运行生产构建验证
  - scope: full repo
  - maps_to: NFR-001, 成本质量属性
  - verify: `pnpm build`

- [x] T020 [Verify] 采集 producer-consumer 清零证据
  - scope: `rg` evidence, API smoke if dev server available
  - maps_to: Producer-Consumer Matrix, 三维 Verdict
  - verify: `rg "ImageUploadService|ScreenshotPasteUploader|react-image-crop|browser-image-compression|/api/ai/image|/api/upload/image"` 无 active 引用；`rg "image_url|image_status|cover_image|weekly_cover|image_model"` 结果被分类为 legacy/favicon/明确保留

- [x] T021 [Closeout Prep] 记录后续迁移条件
  - scope: `specs/image-feature-retirement/acceptance.md` 或 closeout notes
  - maps_to: FR-007, ADR-002, data-model.md
  - verify: 明确字段 drop 未执行或已执行；若未执行，列出 Admin/Astro 技术读取清零前置条件

---

## 依赖与顺序

- T001-T003 是关键路径第一步，先切断副作用。
- T004-T008 可在副作用 API 退役后并行处理 UI；T006 只需确保默认 cover 语义不依赖 Admin 图片 URL。
- T009-T013 依赖 UI/API 方向稳定，可与部分 UI 清理并行，但发布输出 T013 需要确认 `cover` 语义。
- T014-T016 依赖引用清零后执行。
- T017-T021 是收口任务，必须在代码改动完成后执行。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 退役 Admin 图片入口与写入路径 | T001-T008, T014-T016 |
| US2 保持无图片周刊发布稳定 | T006, T012, T013, T017-T020 |
| US3 标记并隔离 legacy 图片字段 | T009-T011, T014-T021 |
| FR-001 | T004-T008 |
| FR-002 | T001-T003 |
| FR-003 | T012-T013, T017-T019 |
| FR-004 / FR-004A | T006, T009-T011, T021 |
| FR-005 | T011, T020-T021 |
| FR-006 | T014-T015 |
| FR-007 | T021 |
| FR-008 | T016 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 分阶段退役 | T001-T016 | T020-T021 |
| ADR-002 cover 不直接 drop | T006, T013 | T020-T021 |
| ADR-003 favicon 保留 | T009-T010 | T017, T020 |
| ADR-004 AI image surface 退役 | T002, T008 | T020 |
| 一致性 | T001-T016 | T020 |
| 可用性 | T012-T013 | T017-T019 |
| 可回滚性 | T021 | T021 |
| 成本 | T014-T015 | T019-T020 |

---

## Notes

- `weekly_issues.cover` 字段 drop 不在当前关键路径内；它需要 Astro 展示端移除对 `cover` 列的技术读取。
- 若实现中确认 Blog `cover_image` 需要保留，必须在最终 acceptance 中把它标为非周刊图片退役对象。
- 如果删除 route 而不是返回 retired response，需要同步更新所有 matcher、测试和静态证据。

---

## Stage Readiness

- 推荐下一步：`execute-plan`
- 阻塞项（如有）：无；任务较多且跨 UI/API/service/依赖/验证，建议先走 `execute-plan` 控制节奏。
