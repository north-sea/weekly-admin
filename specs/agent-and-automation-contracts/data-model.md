# Data Model: Agent And Automation Contracts

**Workspace**: `agent-and-automation-contracts` | **Date**: 2026-06-04

> 本文件描述 plan 阶段确认需要新增的持久化模型。最终字段名和 Prisma 类型可在实现时微调，但语义和约束应保持一致。所有 schema changes 必须通过 Prisma Migrate 生成。

---

## Entities

### Automation Token (表名: `automation_tokens`)

**描述**: 面向 n8n、cron、Hermes、MCP 等无人值守调用方的 service token。只保存 token hash，不保存明文。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Int | PK, AUTO_INCREMENT | 主键 |
| name | String(100) | NOT NULL | 便于人类识别，如 `n8n-prod` |
| token_hash | String(255) | NOT NULL, UNIQUE | token 的安全 hash |
| token_prefix | String(16) | NOT NULL, INDEX | 脱敏展示和快速定位，例如 `wa_abc123` |
| caller_type | String(50) | NOT NULL, INDEX | `cron` / `n8n` / `hermes` / `mcp` / `other` |
| scopes | Json 或 Text | NOT NULL | scope 列表，如 `["weekly:read","weekly:suggest"]` |
| status | String(20) | NOT NULL, DEFAULT `active`, INDEX | `active` / `disabled` / `revoked` |
| created_by_user_id | Int? | FK users.id, nullable | 创建者；seed/bootstrap token 可为空或系统用户 |
| last_used_at | DateTime? | INDEX | 最近使用时间 |
| expires_at | DateTime? | INDEX | 过期时间，空表示不过期 |
| revoked_at | DateTime? | nullable | 撤销时间 |
| created_at | DateTime | DEFAULT now | 创建时间 |
| updated_at | DateTime | DEFAULT now | 更新时间 |

**索引**:

- `uniq_automation_tokens_token_hash` on (`token_hash`)
- `idx_automation_tokens_prefix` on (`token_prefix`)
- `idx_automation_tokens_status` on (`status`)
- `idx_automation_tokens_caller_type` on (`caller_type`)
- `idx_automation_tokens_expires_at` on (`expires_at`)

**状态转换**:

```text
active -> disabled -> active
active -> revoked
disabled -> revoked
revoked -> terminal
```

**安全约束**:

- Token 明文只在创建时返回一次。
- 日志、operation details、OpenAPI 示例和测试快照不得包含真实 token。
- `CRON_API_TOKEN` 可作为部署注入的 token 明文，但数据库仍只保存 hash。

### Automation Run (表名: `automation_runs`)

**描述**: 每次 automation contract 调用的 run lifecycle 和 idempotency 记录。它不是业务事实源，而是调用追踪、重复请求保护和可恢复审计记录。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) 或 String(64) | PK | runId，例如 uuid/cuid |
| token_id | Int | FK automation_tokens.id, INDEX | 调用 token |
| caller_type | String(50) | NOT NULL, INDEX | 冗余调用方类型，便于查询 |
| workflow | String(80) | NOT NULL, INDEX | `weekly`, `sync`, `score`, `publish`, `feedback` |
| step | String(80) | NOT NULL, INDEX | `create`, `link`, `suggest`, `apply`, `publish` |
| target_type | String(80)? | INDEX | `weekly_issue`, `source`, `inbox_item` 等 |
| target_id | String(80)? | INDEX | 目标资源 id，统一字符串 |
| idempotency_key | String(160)? | nullable | 来自 `Idempotency-Key` header 或 body |
| request_digest | String(128) | NOT NULL | 规范化请求摘要 hash，用于发现 key 复用但 payload 变化 |
| status | String(30) | NOT NULL, DEFAULT `running`, INDEX | `running` / `succeeded` / `partial_success` / `skipped` / `empty` / `failed` |
| result_summary | Json 或 Text? | nullable | 可安全返回的结果摘要，不含 secret |
| error_code | String(80)? | INDEX | 稳定错误码 |
| error_message | String(500)? | nullable | 脱敏错误摘要 |
| external_side_effect | Boolean | DEFAULT false | 是否尝试外部副作用 |
| external_ref | String(200)? | nullable | Quail post id/slug 等外部标识 |
| started_at | DateTime | DEFAULT now, INDEX | 开始时间 |
| finished_at | DateTime? | nullable | 完成时间 |
| created_at | DateTime | DEFAULT now | 创建时间 |
| updated_at | DateTime | DEFAULT now | 更新时间 |

**索引**:

- `idx_automation_runs_token` on (`token_id`)
- `idx_automation_runs_workflow_step` on (`workflow`, `step`)
- `idx_automation_runs_target` on (`target_type`, `target_id`)
- `idx_automation_runs_status` on (`status`)
- `idx_automation_runs_started_at` on (`started_at`)
- `uniq_automation_runs_idempotency` on (`token_id`, `workflow`, `step`, `idempotency_key`) where supported; if MySQL/Prisma cannot express partial unique index, use nullable-safe application guard plus generated fallback key.

**状态转换**:

```text
running -> succeeded
running -> partial_success
running -> skipped
running -> empty
running -> failed

succeeded / partial_success / skipped / empty / failed -> terminal
```

**Idempotency 规则**:

- 对写入类 contract，推荐要求 `Idempotency-Key`。
- 同一 token + workflow + step + idempotency key 重复请求：
  - 若 `request_digest` 相同且 terminal，返回 stored `result_summary`，不重复执行副作用。
  - 若 `request_digest` 不同，返回 conflict error。
  - 若 existing run still `running`，返回 running/conflict，避免并发重复执行。
- 没有 idempotency key 的只读请求仍可生成 run；高风险写入不得 silent non-idempotent。

### Operation Log Mirror (既有表: `operation_logs`)

**描述**: 继续作为后台可见审计表，不承载 idempotency 或完整 run lifecycle。

**使用方式**:

- automation run 完成后，可 best-effort 写入 `operation_logs`。
- `operation_details` 只保存 runId、workflow、step、status、counts、error code、token prefix/caller type 等脱敏摘要。
- 如果写入 operation log 失败，不回滚已成功业务写入，但 `automation_runs` 必须保留状态。

---

## Relationships

```text
users 1:N automation_tokens (created_by_user_id, optional)
automation_tokens 1:N automation_runs
automation_runs N:1 business target (polymorphic via target_type + target_id)
automation_runs 0:N operation_logs mirror (by runId in operation_details)
```

Business fact tables remain unchanged:

```text
weekly_issues 1:N weekly_content_items
contents 1:N weekly_content_items
```

`weekly_issues.status` remains:

```text
draft -> published
draft -> archived
published -> archived
```

Automation-generated draft state is expressed through run metadata and audit details, not a new weekly status.

---

## Prisma Notes

Prisma model names can follow existing lowercase table style or project conventions. Suggested shape:

```prisma
model automation_tokens {
  id                 Int       @id @default(autoincrement())
  name               String    @db.VarChar(100)
  token_hash         String    @unique @db.VarChar(255)
  token_prefix       String    @db.VarChar(16)
  caller_type        String    @db.VarChar(50)
  scopes             Json
  status             String    @default("active") @db.VarChar(20)
  created_by_user_id Int?
  last_used_at       DateTime? @db.Timestamp(0)
  expires_at         DateTime? @db.Timestamp(0)
  revoked_at         DateTime? @db.Timestamp(0)
  created_at         DateTime? @default(now()) @db.Timestamp(0)
  updated_at         DateTime? @default(now()) @db.Timestamp(0)

  creator users? @relation(fields: [created_by_user_id], references: [id])
  runs    automation_runs[]

  @@index([token_prefix])
  @@index([caller_type])
  @@index([status])
  @@index([expires_at])
}

model automation_runs {
  id                   String   @id @db.VarChar(64)
  token_id             Int
  caller_type          String   @db.VarChar(50)
  workflow             String   @db.VarChar(80)
  step                 String   @db.VarChar(80)
  target_type          String?  @db.VarChar(80)
  target_id            String?  @db.VarChar(80)
  idempotency_key      String?  @db.VarChar(160)
  request_digest       String   @db.VarChar(128)
  status               String   @default("running") @db.VarChar(30)
  result_summary       Json?
  error_code           String?  @db.VarChar(80)
  error_message        String?  @db.VarChar(500)
  external_side_effect Boolean  @default(false)
  external_ref         String?  @db.VarChar(200)
  started_at           DateTime? @default(now()) @db.Timestamp(0)
  finished_at          DateTime? @db.Timestamp(0)
  created_at           DateTime? @default(now()) @db.Timestamp(0)
  updated_at           DateTime? @default(now()) @db.Timestamp(0)

  token automation_tokens @relation(fields: [token_id], references: [id])

  @@index([token_id])
  @@index([workflow, step])
  @@index([target_type, target_id])
  @@index([status])
  @@index([started_at])
  @@unique([token_id, workflow, step, idempotency_key])
}
```

**注意**: MySQL unique index allows multiple NULL values. If nullable `idempotency_key` is used, application code must not rely on the unique constraint for null keys. Safer implementation is to require keys for write endpoints or store a generated non-null key for non-idempotent runs.

---

## Migration Notes

- 使用 Prisma Migrate 生成 migration directory。
- 不新增 `database/*.sql` 作为 schema 入口。
- Migration should be forward-only; rollback uses standard database backup/deploy rollback procedure.
- Seed/bootstrap strategy:
  - Development can seed a disabled example token or create token via script.
  - Production token should be generated explicitly and displayed once.
- After migration:
  - run `pnpm prisma generate`
  - run focused tests for auth/run/idempotency
  - include NAS/deploy smoke only in verify/acceptance stage
