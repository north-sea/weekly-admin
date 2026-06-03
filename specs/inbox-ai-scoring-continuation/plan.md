# Implementation Plan: Inbox AI Scoring Continuation

**Workspace**: `inbox-ai-scoring-continuation` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/inbox-ai-scoring-continuation/spec.md`

---

## Summary

本计划以最小改动收口 F1 `inbox-ai-scoring`:补齐评分设置默认值、增强 `processing` 回收、提供幂等 doctor/backfill,并重新采集 runtime/UI/DB evidence。当前不做 schema change,因此不需要 Prisma Migrate。

---

## Architecture Overview

```text
ai_settings DEFAULTS
        |
        v
AiSettingsService.get/list
        |
        v
InboxScoringService.runBatch
        |
        +--> sweepStaleProcessing
        |      - timeout processing
        |      - missing last_scored_at
        |      - invalid last_scored_at
        |
        +--> runOne / scoreInboxItem / promoteAtomic

scripts/doctor-inbox-scoring.js
        |
        +--> dry-run report
        +--> apply backfill
               - scored rows -> done
               - recoverable processing -> pending
```

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `AiSettingsService` | F1 scoring defaults | `InboxScoringService`, settings UI/API | Unit tests prove missing DB keys still return defaults |
| `InboxScoringService.sweepStaleProcessing` | recovered `pending` rows | `runBatch` scorer | Unit tests and doctor report show affected count |
| doctor/backfill script | DB evidence JSON | `acceptance.md`, roadmap T016 | Acceptance records before/after status distribution |
| `/api/inbox/score-batch` | runtime payload | UI toast, acceptance | curl evidence preserves old contract |
| Inbox UI code/browser | user-visible scoring controls | closeout | screenshot/snapshot or code evidence |

**孤儿 artifact 处理**: doctor report 仅用于验收和运维排查,不是长期业务数据。

---

## Key Design Decisions

### Decision 1: continuation 不重写 F1

- **背景**: `docs/automation-plan-admin.md` 和 `specs/inbox-ai-scoring/*` 已完整定义并实现 F1 主体。
- **选项**:
  - A: 重写评分系统。
  - B: 仅修复 closeout blockers。
- **结论**: 选择 B。roadmap Post-F7 明确要求"小迭代后 closeout"。
- **影响**: 代码改动集中在 settings、sweep、doctor/backfill 和 tests。
- **来源**: `specs/admin-modernization-roadmap/plan.md` Post-F7 Reassessment。

### Decision 2: 当前不做 schema change

- **背景**: 现有 schema 已有 `scoring_status` 和 `contents.auto_promoted`。
- **结论**: 不创建 Prisma migration。若实现中发现必须变更 schema,先回到 plan 更新。
- **影响**: doctor/backfill 只更新数据,不改结构。
- **来源**: `prisma/schema.prisma`, `migration-tooling-baseline` 完成约束。

### Decision 3: doctor 默认 dry-run

- **背景**: 本 feature 可能触达真实 MySQL 数据。
- **结论**: doctor/backfill 脚本默认只读输出,必须传 `--apply` 才写入。
- **影响**: 验收可先 dry-run,再由用户明确允许 apply。
- **来源**: 安全约束和本 feature NFR-003。

---

## Module Design

### Module: `src/lib/services/ai-settings.ts`

**职责**: 提供 AI settings 的 DB 读取和默认兜底。

**改动概述**:

- 在 `DEFAULT_AI_SETTINGS` 加 F1 四个 scoring keys。
- 保持 `auto_score_on_sync` 的 `{ enabled }` shape。
- 让 `{ value }` shape 直接透传,无需复杂 normalize。

### Module: `src/lib/services/inbox-scoring.ts`

**职责**: 评分状态机、batch 入口、stale processing 回收。

**改动概述**:

- 把 sweep SQL 扩展为:
  - `last_scored_at IS NULL`
  - `STR_TO_DATE(...) IS NULL`
  - parsed timestamp < timeout
- 保留已有 `ai_score_details` 内容,只改 `scoring_status='pending'`。

### Module: `scripts/doctor-inbox-scoring.js`

**职责**: 输出并按需修复 inbox scoring DB 状态。

**关键行为**:

```text
node scripts/doctor-inbox-scoring.js
  -> dry-run JSON report

node scripts/doctor-inbox-scoring.js --apply
  -> repair scored rows to done
  -> recover missing/invalid/timed-out processing rows to pending
  -> print before/after report and affected counts
```

**注意事项**:

- 使用 Prisma Client。
- 不写文件。
- 不改 schema。

---

## Data Model

不新增实体或字段。仅修复现有 `ai_settings.value` 默认兜底和 `inbox_items.scoring_status` 数据状态。

---

## Project Structure

```text
specs/inbox-ai-scoring-continuation/
  spec.md
  plan.md
  tasks.md
  acceptance.md
scripts/
  doctor-inbox-scoring.js
src/lib/services/
  ai-settings.ts
  inbox-scoring.ts
  __tests__/ai-settings.test.ts
  __tests__/inbox-scoring.test.ts
```

---

## Risks and Tradeoffs

- DB apply 会修改真实数据;通过默认 dry-run 和显式 `--apply` 降低误操作风险。
- `ai_score IS NOT NULL -> done` 可能覆盖某些历史异常状态;本 feature 将其定义为 T105 收口口径。如果发现业务例外,必须写入 acceptance。
- Browser evidence 可能受 agent-browser 环境限制;若工具不可用,记录代码级 UI evidence 和失败原因。

---

## Verification Strategy

- Unit:
  - `ai-settings` 默认值和 shape。
  - `sweepStaleProcessing` SQL 覆盖缺失/非法/超时条件。
  - `runBatch` 旧契约保持。
- Type:
  - `pnpm -s type-check`
- DB:
  - `node scripts/doctor-inbox-scoring.js`
  - 用户允许时 `node scripts/doctor-inbox-scoring.js --apply`
- Runtime:
  - `GET /api/health`
  - `GET /api/v1/ai/feedback/digest`
  - `POST /api/inbox/score-batch`
- UI:
  - agent-browser replay `/inbox`;失败时使用 code evidence。

---

## Stage Readiness

- 是否需要 `data-model.md`: 不需要。没有 schema/entity 新增。
- 下一步建议: `tasks`
- 阻塞项: DB apply 需要用户批准或显式命令执行许可。
