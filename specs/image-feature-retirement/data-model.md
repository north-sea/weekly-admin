# Data Model: Image Feature Retirement

**Workspace**: `image-feature-retirement` | **Date**: 2026-06-06

> 本 feature 不新增实体。数据模型重点是把既有图片字段从 active 写入模型降级为 legacy / transitional，并明确哪些字段不属于本次图片退役。

---

## Entities

### Content (表名: `contents`)

**描述**: 内容主体。当前包含内容主图和截图来源字段。

| 字段 | 当前类型 | 退役状态 | 说明 |
|------|----------|----------|------|
| `image_url` | `String? @db.VarChar(500)` | legacy-readonly | 停止 Admin 表单、同步、发布流程新写入；历史值只能兼容读取或忽略。 |
| `image_source` | `String? @db.VarChar(50)` | legacy-readonly | 停止新写入；跟随 `image_url` 后续 drop。 |
| `image_width` | `Int?` | legacy-readonly | 停止新写入；跟随 `image_url` 后续 drop。 |
| `image_height` | `Int?` | legacy-readonly | 停止新写入；跟随 `image_url` 后续 drop。 |
| `screenshot_api` | enum nullable/default | transitional | 与截图来源/手动图片相关；先停止新图片语义写入，是否 drop 取决于 consumer 清零。 |

### Weekly Issue (表名: `weekly_issues`)

**描述**: 周刊期次。`cover` 当前存在语义分裂。

| 字段 | 当前类型 | 退役状态 | 说明 |
|------|----------|----------|------|
| `cover` | `String? @db.VarChar(500)` | transitional | Admin API 当前按 URL 校验；展示端当前使用默认 cover 模板，空值可降级默认。先退役图片 URL 语义；drop 前只需清掉跨仓技术读取。 |

### Inbox Item (表名: `inbox_items`)

**描述**: 来源同步后的候选内容。

| 字段 | 当前类型 | 退役状态 | 说明 |
|------|----------|----------|------|
| `image_url` | `String? @db.VarChar(2048)` | legacy-readonly | 停止 Karakeep/RSS/promote/crop 新写入；历史值不阻塞列表或 promote。 |
| `image_status` | `String? @db.VarChar(20)` | legacy-readonly | 停止图片检查和裁剪状态更新；后续跟随 `image_url` drop。 |
| `favicon_url` | `String? @db.VarChar(500)` | active | 来源标识，不属于主图/上传/裁剪/AI 图片退役范围。 |

### AI Config / Prompt (表名: `ai_configs`, `ai_prompts`)

**描述**: AI provider 与 prompt 配置。

| 字段 / 记录 | 当前状态 | 退役状态 | 说明 |
|-------------|----------|----------|------|
| `ai_configs.image_model` | 可配置 | legacy-config | 从用户可见配置和 `/api/ai/config` active response 中移除，字段暂留。 |
| `ai_prompts.scene = weekly_cover` | seeded prompt | legacy-config | 停止作为封面生成入口消费，记录暂留到后续迁移。 |

---

## State Semantics

```text
active image field
  -> legacy-readonly: 不再新写入，只允许历史兼容读取/忽略
  -> dropped: Admin + Astro 技术读取清零后，通过 Prisma Migrate 删除

weekly_issues.cover
  -> transitional: 图片 URL 语义退役，展示端使用默认 cover
  -> dropped: 展示端移除对 cover 列的读取后可删除
```

---

## Migration Notes

- 本 feature 首阶段不要求立即 drop 字段。
- 所有 schema change 必须走 `prisma/migrations/`，不得新增 `database/*.sql`。
- drop 前必须完成：
  - Admin producer/consumer 清单清零。
  - Astro 展示端 `/Users/yqg/personal/weekly/weekly` 对 `cover` 列的技术读取清零。
  - 数据快照/备份和回滚说明。
  - `pnpm db:status` / `pnpm db:migrate` 路径验证。
