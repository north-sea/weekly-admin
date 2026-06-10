# Implementation Plan: Image Feature Retirement

**Workspace**: `image-feature-retirement` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/image-feature-retirement/spec.md`

---

## Summary

推荐采用分阶段退役：先停止图片副作用 API 和 Admin 用户入口，再清理 active 写入/发布输出，最后把跨仓 Astro 技术读取和数据库字段 drop 放入受控迁移段。用户已确认展示端目前使用默认 cover，因此 `weekly_issues.cover` 不再是视觉阻塞点；它只是字段删除前需要清理的技术读取点。

方案讨论跳过：当前只有一个合理方向。只隐藏 UI 会留下后台写入和外部副作用；直接 drop 字段仍可能破坏跨仓代码读取；因此必须走分阶段清理。

---

## Architecture Overview

```text
Admin UI
  content editor / weekly editor / inbox / settings
    -> remove image upload, crop, cover generation, image model surfaces

Admin APIs and services
  /api/upload/image          -> retired response, no external/local write
  /api/ai/image              -> retired response, no model call
  /api/inbox/[id]/crop-image -> retired response, no fetch/crop/update
  content / weekly / sync    -> stop active image field writes
  quail publisher            -> stop image markdown and image cover payload

Data layer
  image fields -> legacy-readonly / transitional
  schema drop  -> only after Admin + Astro technical reads are cleared

Astro display (/Users/yqg/personal/weekly/weekly)
  default cover is currently used -> clear cover column reads before drop
```

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| Strangler Fig / 分阶段遗留系统替换 | UNVERIFIED | 先切断新入口和新写入，再逐步迁移/删除旧字段 | 不需要新 facade 或复杂路由层；本仓库是单体 + 跨仓展示端 | 成长期 |
| 分层单体 | UNVERIFIED | UI、API、service、data model 分层清理，减少跨层遗漏 | 不引入微服务、事件总线或新后台任务 | 成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `src/components/content/ScreenshotPasteUploader.tsx` + `ImageUploadService` | Uploaded image URL | `simplified-editor` -> `contents.image_url` | UI 中主图上传入口消失；保存 payload 不含 `image_url` |
| `src/app/api/upload/image/route.ts` | 外部图床 URL / `public/uploads` 文件 | 内容主图、封面上传 | API 不再调用 `IMAGE_UPLOAD_URL`，开发环境不再写 `public/uploads` |
| `src/app/api/ai/image/route.ts` + `src/lib/ai/client.ts` | AI generated image URL/base64 | 周刊封面/图片生成 UI | API 返回 retired/404；无 `/api/ai/image` client 引用 |
| `src/app/api/inbox/[id]/crop-image/route.ts` + `ImageCropper` | Cropped `inbox_items.image_url` + `image_status=ok` | inbox 列表/promote | crop UI 和 API 均退役；不再更新 `image_status` |
| Karakeep/RSS sync | `inbox_items.image_url` | inbox preview、crop、promote 到 content | sync 停止写主图；promote 不再传播图片 |
| Karakeep/RSS sync | `inbox_items.favicon_url` | draft/source identification | 保留；不列入图片退役，验证 favicon 仍可正常透传或展示 |
| Content editor/service | `contents.image_url` / image metadata | weekly lists, preview, Quail publisher | 新写入清零；Quail payload 不插入图片 Markdown |
| Weekly editor/API | `weekly_issues.cover` as URL | Admin preview / Quail `cover_image` | Admin 不再按 URL 输入/校验/发布图片 cover |
| Astro display `weekly` repo | `weekly_issues.cover` column read | `LatestWeeklyList`, `AllWeeklyList`, OG image code paths | 展示端当前用默认 cover；字段 drop 前移除 `cover` 列读取并验证默认 cover 正常 |
| AI config/settings | `image_model`, `weekly_cover` prompt | `/api/ai/config`, settings UI, image API | active image config surface 移除；字段/seed 暂留 |

**孤儿 artifact 处理**: `contents.image_url`、`inbox_items.image_url`、`image_status` 目标是成为无 consumer 的 legacy artifact 后 drop。`weekly_issues.cover` 不再承担图片视觉语义；它的剩余 consumer 是跨仓技术读取，清掉后可进入 drop 迁移。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 一致性 | 图片入口、API、写入、发布全部同向退役 | 按 producer/consumer 清单逐层处理 | `rg` 无 active 图片入口/写入引用；相关测试通过 |
| 可用性 | 周刊主流程无图片可创建、预览、发布 | 保留文本、摘要、分类、标签和链接路径 | 周刊 API/页面 smoke 或组件测试 |
| 可回滚性 | DB drop 不抢跑 | 字段先 legacy-readonly，drop 独立迁移段 | `data-model.md` 和 plan 记录迁移前置条件 |
| 成本 | 移除无用图片依赖和外部调用 | 清理 `browser-image-compression`、`react-image-crop`；`sharp` 需确认 Next/Astro用途 | package/lockfile diff + build |
| 可演进性 | 新 workbench 不继承图片模型 | Admin active surface 清零 | Closeout 三维 Verdict |

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 分阶段退役 | 图片字段跨 Admin 与 Astro，且含外部副作用 | 立即 drop / 只隐藏 UI / 分阶段退役 | 选择分阶段退役 | 需要更多验证轮次，但避免跨仓代码读取和数据回归 | `specs/admin-modernization-roadmap/plan.md`, UNVERIFIED pattern |
| ADR-002 `weekly_issues.cover` 不作为视觉阻塞 | 用户确认展示端当前使用默认 cover，`parseCover()` 也支持空值默认 | 立即 drop / 保留 transitional / 先清技术读取后 drop | 先退役 URL 语义，后续清技术读取再 drop | 字段名短期仍有歧义 | 用户确认, `/Users/yqg/personal/weekly/weekly/src/utils/contents/cover.ts` |
| ADR-003 favicon 不纳入图片退役 | favicon 是来源标识，不触发上传/裁剪/AI | 一起删除 / 保留 active | 保留 active | 后续字段清单需明确排除它 | `src/lib/services/sync-orchestrator.ts` |
| ADR-004 AI image config active surface 退役 | image API 与 weekly_cover prompt 属于图片生成能力 | 删除字段 / 只停 API / UI+API surface 退役字段暂留 | UI+API surface 退役字段暂留 | settings UI 需要调整，字段仍在 schema | `src/app/api/ai/config/route.ts`, `src/lib/services/ai-prompt.ts` |

---

## Module Design

### Module: Admin UI Surfaces

**职责**: 移除用户可见图片入口。

**改动概述**:

- 内容编辑器删除 `image_url` 主图输入、`ScreenshotPasteUploader` 和预览中对主图的优先渲染。
- Blog 专用 `cover_image` 属于内容封面语义，若当前产品目标是整体去图片，则同批隐藏；若后续确认 blog 仍保留封面，应在 tasks 中拆分为保留项。
- 周刊编辑器删除 cover URL、上传、AI 封面生成入口；保存时不提交 `cover` 图片 URL。
- Inbox 删除图片预览状态、裁剪按钮、crop modal。
- AI settings 删除 image model 和 weekly_cover prompt 的用户可见编辑 surface，保留 text model 和 weekly_desc 等非图片配置。

**注意事项**:

- 删除 UI 入口不能只做 CSS 隐藏；表单默认值和 submit payload 也要清理。
- 历史图片值不得阻塞页面加载。

### Module: Side-effect APIs

**职责**: 停止外部图床、本地上传、AI 图片生成和图片裁剪副作用。

**改动概述**:

- `/api/upload/image` 返回明确 retired response 或删除 route；不得继续写 `public/uploads`。
- `/api/ai/image` 返回明确 retired response 或删除 route；不得调用外部模型。
- `/api/inbox/[id]/crop-image` 返回明确 retired response 或删除 route；不得 fetch 图片或 update `image_url`。

**注意事项**:

- 若删除 route，需同步移除 auth public matcher 中的例外项。
- 推荐在第一版保留 route 但返回 `410 Gone`/业务 retired code，降低旧前端缓存或外部误调用的排障成本；后续 closeout 再决定是否删除。

### Module: Sync / Promote / Content Services

**职责**: 停止新写入图片字段。

**改动概述**:

- Karakeep/RSS sync 不再写 `inbox_items.image_url` 和 `image_status`，但保留 `favicon_url`。
- Promote/draft/content create/update 不再传播 `image_url`。
- `ContentService` 不再将 `contents.image_url` 作为 active output 给新 UI 消费；只在兼容边界保留。
- 图片检查服务 `image-processor` 若无其他用途，应退役。

**注意事项**:

- 不要让同步因为上游 image metadata 存在而失败；直接忽略即可。

### Module: Weekly Publish / Preview

**职责**: 保证周刊无图片仍可预览和发布。

**改动概述**:

- `QuailService` 不再基于 `content.image_url` 插入 Markdown 图片。
- `cover_image` 不再来自 `issue.cover`，因为该字段不是图片 URL，且展示端当前走默认 cover。
- 周刊预览组件不再渲染内容图片或 cover URL。

**注意事项**:

- `weekly_issues.cover` 不再作为图片或视觉 cover 来源；展示端默认 cover 不依赖 Admin 图片 URL。

### Module: Data / Migration Governance

**职责**: 管理 legacy 字段生命周期。

**改动概述**:

- 按 [data-model.md](data-model.md) 标记字段状态。
- 本阶段先实现 legacy-readonly，不直接 drop。
- 若同一轮要 drop，必须先完成 Astro 对 `cover` 列的技术读取清理，再用 Prisma Migrate 生成 migration。

**注意事项**:

- 不新增 `database/*.sql`。
- drop 前需要快照/备份和回滚说明。

---

## Project Structure

```text
src/components/content/
  simplified-editor.tsx
  ScreenshotPasteUploader.tsx       # candidate delete

src/components/inbox/
  image-cropper.tsx                 # candidate delete

src/components/weekly/
  WeeklyPreview.tsx
  WeeklyIssueLayout.tsx
  AvailableContentsList.tsx
  SelectedContentsList.tsx

src/app/(dashboard)/
  content/list/page.tsx
  inbox/page.tsx
  settings/ai/page.tsx
  weekly/editor/[id]/page.tsx

src/app/api/
  upload/image/route.ts
  ai/image/route.ts
  ai/config/route.ts
  inbox/[id]/crop-image/route.ts
  weekly/route.ts
  weekly/[id]/route.ts

src/lib/services/
  image-upload.ts                   # candidate delete
  image-upload-response.ts          # candidate delete if no route consumer
  image-processor.ts                # candidate delete if no scheduler/ops use
  sync-orchestrator.ts
  karakeep-resync.ts
  content.ts
  quail.ts

package.json / pnpm-lock.yaml       # remove dead image dependencies
prisma/schema.prisma                # no first-step drop; possible later migration
```

---

## Risks and Tradeoffs

- `weekly_issues.cover` 字段名误导：Admin 当前按 URL 校验，但展示端实际使用默认 cover。实现必须先修正 Admin 图片语义，同时把字段 drop 依赖限定为跨仓技术读取清理。
- `sharp` 可能被 Next build 或其他图像/OG 路径使用；只能在引用清零并 build 通过后删除。
- 删除 API route 会让旧客户端得到 404；保留 `410 Gone` 更利于过渡，但会短期保留 route 文件。
- `cover_image` attribute 在 ContentService 中存在 blog 语义；若产品仍需要 blog 封面，必须从“周刊去图片”范围中排除。当前 spec 倾向整体 Admin 图片退役，tasks 阶段需确认实际删除范围。
- 跨仓 Astro 修改不在当前仓库写权限内；若需要同步修改，应作为独立任务或后续 migration slice 处理。

---

## Evolution Path

- **MVP**: Admin 图片入口、副作用 API、新写入和发布输出清零；字段保留 legacy-readonly。
- **成长期**: Astro 展示端移除对 `weekly.cover` 列的读取；Admin schema 清理准备 migration。
- **成熟期**: Prisma Migrate drop legacy 图片字段，移除所有兼容分支和过渡 route。

---

## Verification Strategy

- Static evidence:
  - `rg "ImageUploadService|ScreenshotPasteUploader|react-image-crop|browser-image-compression|/api/ai/image|/api/upload/image"` 无 active 引用。
  - `rg "image_url|image_status|cover_image|weekly_cover|image_model"` 仅剩 legacy-readonly、favicon 或明确保留项。
- Automated:
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm test`
  - `pnpm build`
- Behavioral:
  - 内容创建/编辑不提交图片字段。
  - Inbox sync/promote 不写 `image_url`，favicon 不受影响。
  - 周刊预览和发布 payload 无图片 Markdown 和图片 `cover_image`。
  - 图片 API 不产生外部调用或本地写入。
- Migration:
  - 若 drop 字段，必须补充 Prisma migration、备份/回滚说明和 `pnpm db:status` 证据。

---

## Stage Readiness

- 是否需要 `data-model.md`：需要。原因是本 feature 涉及既有字段状态、跨仓 consumer 和后续 drop 边界。
- 下一步建议：`tasks`
- 阻塞项（如有）：无阻塞任务拆解的歧义；`cover_image` 是否保留 blog 语义可在 tasks 中作为分支任务明确。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 主实现计划 |
| data-model.md | 已生成 | legacy 字段和 transitional 字段状态 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Prisma Migrate 约束 | [docs/migration-workflow.md](../../docs/migration-workflow.md) | 本仓库迁移治理 |
| Roadmap 图片退役顺序 | [specs/admin-modernization-roadmap/plan.md](../admin-modernization-roadmap/plan.md) | F5 顺序和字段 drop 后置 |
| Astro default cover behavior | 用户确认 + `/Users/yqg/personal/weekly/weekly/src/utils/contents/cover.ts` | 展示端当前使用默认 cover；跨仓文件不是当前仓库文件 |
| Admin sync image/favicons | [src/lib/services/sync-orchestrator.ts](../../src/lib/services/sync-orchestrator.ts) | favicon 与 image_url 来源 |
| AI image config surface | [src/app/api/ai/config/route.ts](../../src/app/api/ai/config/route.ts) | imageModel / weeklyCoverPrompt response |
