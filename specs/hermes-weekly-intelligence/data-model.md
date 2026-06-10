# Data Model: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence` | **Date**: 2026-06-08

> 本文件定义 Admin 与 Hermes/PG/pgvector 之间的逻辑数据契约。MVP 不在 Admin repo 新增 Prisma model、SQL migration 或 `database/*.sql`；外部 hermes-db/PG/pgvector schema 由 Hermes/MCPS/NAS 侧独立管理。

---

## Ownership Rules

| 数据 | Owner | 存储 | 是否事实源 | 可重建来源 |
|------|-------|------|------------|------------|
| 周刊 issue、content、weekly_content_items | Admin | MySQL/Prisma | 是 | 不适用 |
| automation token / automation_runs | Admin | MySQL/Prisma | Admin automation evidence | Admin API / run execution |
| suggestion preview summary | Admin | `automation_runs.result_summary` | 否，preview only | Hermes artifact 或 Admin organizer |
| preference memory | Hermes | hermes-db/PG | 否，派生偏好 | Admin feedback digest |
| embeddings | Hermes | PG/pgvector | 否，派生索引 | Admin content/candidates API |
| Hermes agent run log | Hermes | hermes-db/PG | Hermes 运行证据 | Hermes runtime |
| ops report | Hermes + Admin preview | hermes-db/PG + Admin result summary | 否，解释层 | Admin jobs/runs/health |

---

## Admin-Owned Existing Entities

### `automation_runs`

**描述**: Admin 已有自动化运行记录。MVP 用它保存 Hermes register/preview 的脱敏 result summary，不新增 suggestion table。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string | PK | Admin run id，可作为 suggestion source run id |
| workflow | string | existing | Hermes weekly 建议使用 `weekly` |
| step | string | existing | 建议使用 `suggest` / `suggestion_apply` / `hermes_ops_report` |
| status | string | existing | `succeeded` / `empty` / `skipped` / `failed` 等 |
| target_type | string | nullable | weekly suggestion 使用 `weekly_issue` |
| target_id | string | nullable | weekly issue id |
| result_summary | Json | nullable | 保存脱敏 preview artifact 或 ops report summary |
| error_code | string | nullable | dependency unavailable / schema invalid 等错误码 |
| error_message | string | nullable | 脱敏错误摘要 |

**Admin 约束**:

- `result_summary` 不保存 automation token、token hash、DB URL、Redis password、LLM provider key。
- `result_summary` 不保存完整私密正文；只保存 title/summary excerpt/source id/evidence ref。
- `workflow + step + target_id + idempotency_key` 继续由现有 automation run 逻辑治理。

---

## Artifact Schemas

### Feedback Digest Artifact

**Producer**: `GET /api/v1/ai/feedback/digest`
**Consumer**: Hermes `weekly_preference_learning`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| range.from | string \| null | ISO date-ish | digest 时间窗起点 |
| range.to | string \| null | ISO date-ish | digest 时间窗终点 |
| actions | array | required | Admin operation log 转换后的人工反馈动作 |
| counts | object | required | action -> count |
| format | `json` \| `markdown` | optional | Hermes 应使用 json 为主 |
| meta.runId | string | response meta | Admin automation run id |

**状态语义**:

```text
actions.length === 0 -> empty
digest unavailable -> dependency unavailable
conflicting samples -> lower confidence or needs_review
```

### Preference Memory (external: `hermes_preference_memories`)

**Owner**: Hermes / hermes-db / PG
**描述**: 从 feedback digest 中提炼的可审计偏好。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string | PK | Hermes memory id |
| scope | string | required | weekly/global/topic/source 等适用范围 |
| title | string | required | 偏好标题 |
| summary | string | required | 偏好描述 |
| confidence | number | 0..1 | 样本越少或冲突越多越低 |
| evidence_samples | array | bounded | 脱敏样本引用，不保存完整私密正文 |
| source_digest_run_id | string | optional | Admin feedback digest run id |
| source_range_from | string \| null | optional | 来源窗口 |
| source_range_to | string \| null | optional | 来源窗口 |
| sample_count | number | >=0 | 使用的样本数 |
| status | string | required | `active` / `needs_review` / `skipped` / `superseded` |
| version | number | required | 防多 agent 覆盖 |
| updated_at | string | required | 更新时间 |

**状态转换**:

```text
new digest -> active
conflicting digest -> needs_review
newer version replaces old -> superseded
empty digest -> skipped, no overwrite
```

### Weekly Suggestion Artifact

**Producer**: Hermes `weekly_issue_planner` or Admin organizer
**Consumer**: Admin workbench + apply contract

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| artifactVersion | string | required | MVP 使用 `weekly-suggestion.v1` |
| provider | `hermes` \| `admin` | required | UI 用于区分来源 |
| weeklyIssueId | number | required | Admin weekly issue id |
| agentRunId | string | required for Hermes | Hermes run id |
| sourceRunId | string | optional | Admin automation run id |
| status | string | required | `preview` / `empty` / `stale` / `rejected` |
| intro | string | optional | 建议摘要 |
| items | array | max 30 | 可传给 apply contract 的条目 |
| confidence | number | 0..1 optional | 整体置信度 |
| evidenceRefs | array | optional bounded | digest/candidate/memory/job refs |
| preferenceRefs | array | optional bounded | preference memory ids |
| generatedAt | string | required | 生成时间 |
| expiresAt | string | optional | stale 判断参考 |

**Item fields**:

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| content_id | number | positive | Apply contract 使用 |
| section | string | 1..100 | 周刊分组 |
| featured | boolean | optional | 是否精选 |
| reason | string | max 200 | 人类可读推荐理由 |
| confidence | number | 0..1 optional | 条目级置信度 |
| evidenceRefs | array | optional | 条目级证据 |

**Apply payload projection**:

```json
{
  "replaceExisting": false,
  "items": [
    {
      "content_id": 1001,
      "section": "AI",
      "featured": true,
      "reason": "代表性强"
    }
  ]
}
```

### Ops Report Artifact

**Producer**: Hermes `weekly_ops_report`
**Consumer**: Workbench runs/job health surface

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| artifactVersion | string | required | MVP 使用 `weekly-ops-report.v1` |
| weeklyIssueId | number | optional | 可按期复盘 |
| agentRunId | string | required | Hermes run id |
| status | string | required | `succeeded` / `empty` / `dependency_unavailable` / `history_only` |
| summary | string | required | 复盘摘要 |
| risks | array | optional | 关键风险 |
| nextActions | array | optional | 建议下一步 |
| runRefs | array | optional | Admin automation run ids |
| jobRefs | array | optional | Redis/job ids |
| healthRefs | array | optional | health snapshot refs |
| generatedAt | string | required | 生成时间 |

**Status taxonomy**:

```text
empty                 -> 没有可复盘输入，不是故障
skipped               -> 业务条件跳过
failed                -> Hermes 执行失败
dependency_unavailable -> Admin API / PG / Redis / worker health 不可用
history_only          -> Redis runtime status 过期，只能使用 durable automation_runs
stale_data            -> artifact 引用的 content/run/job 已不是当前状态
```

### Embedding Reference (external: `hermes_content_embeddings`)

**Owner**: Hermes / PG / pgvector
**描述**: 面向未来语义召回的向量引用。MVP 不要求 Admin 直接读取。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string | PK | embedding row id |
| content_id | number | required | Admin content id |
| source_updated_at | string | optional | Admin content 更新时间或候选快照时间 |
| embedding_model | string | required | 模型名，不保存 provider secret |
| vector | vector | PG/pgvector | 外部存储 |
| source_hash | string | optional | 用于判断是否需要重建 |
| created_at | string | required | 创建时间 |

---

## Relationships

```text
Admin contents
  1:N external hermes_content_embeddings
  1:N weekly_suggestion_artifact.items

Admin automation_runs
  1:N suggestion preview summaries
  1:N ops report summaries

Feedback digest run
  1:N preference memories

Preference memories
  N:M weekly suggestion artifacts through preferenceRefs

Weekly suggestion artifact
  1:N apply payload items
  0:1 apply result
```

---

## Staleness and Rebuild Rules

- Admin current MySQL/API state wins over Hermes artifact.
- Suggestion artifact is stale if any referenced `content_id` no longer exists, is not weekly content type, is linked to another issue, or falls outside the current apply rules.
- Redis runtime snapshot missing but durable `automation_runs` exists means `history_only`, not missing evidence.
- Preference memory can be rebuilt from feedback digest windows and source run ids.
- Embeddings can be rebuilt from Admin content/candidates snapshots.
- Ops report can be rebuilt from job status, health snapshots and automation run history when available.

---

## DDL Scripts

```sql
-- No Admin DDL in this feature.
-- Do not add Prisma models, Prisma migrations, or database/*.sql for hermes-db/PG/pgvector here.
-- External Hermes/MCPS/NAS repo owns PG/pgvector schema and migrations.
```

---

## Migration Notes

- Admin MySQL schema change: none for MVP.
- If later `automation_runs.result_summary` is insufficient for querying suggestion history, create a separate Admin feature for a first-class `weekly_suggestion_artifacts` table through Prisma Migrate.
- If Hermes external read model schema is required, create it in the Hermes/MCPS/NAS repo and record rebuild scripts there.
- Do not use `database/*.sql` in this Admin repo for external read model DDL.
