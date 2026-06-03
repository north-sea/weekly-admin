# Acceptance Record: Inbox AI Scoring Continuation

**Workspace**: `inbox-ai-scoring-continuation` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)

---

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| FR-001/FR-002 scoring settings 默认兜底 | `DEFAULT_AI_SETTINGS` 已包含 `inbox_promotion_threshold`, `inbox_scoring_enabled`, `inbox_scoring_batch_size`, `inbox_scoring_processing_timeout_minutes`; `auto_score_on_sync` 仍保持 `{ enabled: true }` | `src/lib/services/ai-settings.ts`; `pnpm -s test src/lib/services/__tests__/ai-settings.test.ts --run` | PASS |
| FR-003 processing 回收增强 | sweep SQL 覆盖 `last_scored_at` 缺失、`STR_TO_DATE(...) IS NULL` 和超时三类条件 | `src/lib/services/inbox-scoring.ts`; `pnpm -s test src/lib/services/__tests__/inbox-scoring.test.ts --run` | PASS |
| FR-004/FR-005 doctor 默认 dry-run | `node scripts/doctor-inbox-scoring.js` 输出 JSON report,含 status、scored consistency、processing 分类和 instructions | `scripts/doctor-inbox-scoring.js`; dry-run output | PASS |
| FR-006 backfill 修复历史状态 | `--apply` 前: `scored_total=211`, `scored_done=111`, `scored_not_done=100`, `processing.total=87`; `--apply` 后: `scored_total=211`, `scored_done=211`, `scored_not_done=0`, `processing.total=0` | `node scripts/doctor-inbox-scoring.js --apply` | PASS |
| FR-006 幂等确认 | apply 后重跑 dry-run: `changes.scored_to_done=0`, `changes.processing_to_pending=0`, `processing.recoverable=0` | `node scripts/doctor-inbox-scoring.js` | PASS |
| FR-007 score-batch 旧契约 | `POST /api/inbox/score-batch {"limit":1,"delay":0}` 返回 `success:true` 且 data shape 为 `{scored,failed,skipped,errors}` | runtime curl on `http://127.0.0.1:3000` | PASS |
| FR-008 feedback digest runtime | `GET /api/v1/ai/feedback/digest?from=2026-05-01&to=2026-05-22` 返回 `success:true`, `range`, `actions:[]`, `counts:{}`, `note:'F1 baseline; F2 will populate'` | runtime curl on `http://127.0.0.1:3000` | PASS |
| Runtime health | `GET /api/health` 返回 HTTP 200; database/application/startup healthy; search degraded because Meilisearch health failed | runtime curl on `http://127.0.0.1:3000` | PASS |
| UI evidence | agent-browser `/inbox` snapshot 显示 `收件箱`, `AI 评分` button, `全部评分` combobox, `时间 旧→新` sort, `评分` column header | agent-browser snapshot | PASS |
| Type regression | `pnpm -s type-check` 通过 | local command | PASS |

---

## DB Evidence

### Dry Run Before Apply

```json
{
  "status": [
    { "scoring_status": "done", "count": 111 },
    { "scoring_status": "pending", "count": 368 },
    { "scoring_status": "processing", "count": 87 }
  ],
  "scoring_consistency": {
    "scored_total": 211,
    "scored_done": 111,
    "scored_not_done": 100
  },
  "processing": {
    "total": 87,
    "missing_last_scored_at": 87,
    "invalid_last_scored_at": 0,
    "recoverable": 87
  }
}
```

### Apply Result

```json
{
  "changes": {
    "scored_to_done": 100,
    "processing_to_pending": 0
  },
  "after": {
    "status": [
      { "scoring_status": "done", "count": 211 },
      { "scoring_status": "pending", "count": 355 }
    ],
    "scoring_consistency": {
      "scored_total": 211,
      "scored_done": 211,
      "scored_not_done": 0
    },
    "processing": {
      "total": 0,
      "missing_last_scored_at": 0,
      "invalid_last_scored_at": 0,
      "recoverable": 0
    }
  }
}
```

`processing_to_pending=0` 是预期结果: 这 87 条同时满足 `ai_score IS NOT NULL AND scoring_status <> 'done'`,先被 `scored_to_done` 修正为 `done`。

### Idempotency Confirmation

```json
{
  "scoring_consistency": {
    "scored_total": 211,
    "scored_done": 211,
    "scored_not_done": 0
  },
  "processing": {
    "total": 0,
    "recoverable": 0
  },
  "changes": {
    "scored_to_done": 0,
    "processing_to_pending": 0
  }
}
```

---

## Workflow Replay

- **输入摘要**: `POST /api/inbox/score-batch` with `{ "limit": 1, "delay": 0 }`
- **最终 payload 摘要**: `success:true`, `data:{ scored:0, failed:1, skipped:0, errors:["[207] ... 405 Not Allowed ... nginx/1.31.1"] }`
- **用户可见结果断言**: Inbox UI 有 `AI 评分` 按钮;该 payload 会按旧 UI toast 逻辑显示失败计数,不破坏 contract。
- **Replay 类型**: 真实 runtime replay。

说明: 本次 representative item `[207]` 的上游内容抓取返回 nginx `405 Not Allowed`,属于外部内容可用性/抓取输入问题,不是 continuation 的配置、状态机或 DB evidence 修复范围。contract 和失败承载能力通过;真实评分成功样本仍建议在后续 F7 Karakeep summary quality 或内容抓取治理中补充。

---

## Closeout Checklist

| Item | Verdict | Notes |
|---|---|---|
| 旧逻辑/旧路径退役 | PASS | 未重写 F1; `/api/inbox/score-batch` 继续作为兼容 wrapper。 |
| 发布/CI/follow-through | PASS | 本 feature 无 schema change,无需 Prisma migration; tests/type-check 通过。 |
| 文档/acceptance 更新 | PASS | 新建 continuation spec/plan/tasks/acceptance。 |
| ADR/架构决策保留 | PASS | 不重写 F1、不改 schema、doctor dry-run 默认已记录在 plan。 |
| 架构债/临时兼容/演进触发信号 | CONDITIONAL | 上游 405 真实样本仍存在,但归属内容抓取/摘要质量后续治理,不阻塞本 continuation。 |
| 知识同步 | N/A | 本次记录在 SDD acceptance 中即可。 |

---

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | settings 默认、sweep 增强、doctor/backfill、tests/type-check 均通过。 |
| Workflow closure | CONDITIONAL PASS | DB 状态闭环已修复; score-batch contract 和失败承载通过;代表性真实样本仍因外部 405 失败。 |
| User-visible outcome | PASS | agent-browser snapshot 证明 `/inbox` 有 AI 评分按钮、评分筛选/排序和评分列。 |

**Overall: CONDITIONAL PASS**

`inbox-ai-scoring-continuation` 可宣布完成,条件是把 `[207] 405 Not Allowed` 作为外部内容抓取质量问题转入后续跟进,不作为本 feature 的阻塞项。
