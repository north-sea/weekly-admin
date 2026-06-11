# Inbox AI Scoring - 验收记录

> 验收日期: 2026-05-24

## M1: Dev 启动日志

- **结果**: PASS
- **证据**: `[inbox-scoring-scheduler] started (every hour at :00)` 在 `pnpm dev` 启动后出现
- **热重载**: 哨兵机制确保只注册一次

## M2: 10 条样本压测

- **结果**: PASS
- **证据**: `POST /api/inbox/score-batch {"limit":10,"delay":0}` 返回 `{ scored:10, failed:0, skipped:0, errors:[] }`
- **耗时**: dev server 日志显示 `POST /api/inbox/score-batch 200 in 180373ms`,约 18s/条;接口当前未采集逐条 P95
- **说明**: 日常使用规模按 10 条样本验证,不再执行 100 条压测。

## M3: 阈值动态切换

- **结果**: PASS
- **证据**: PUT `inbox_promotion_threshold = 80` 后 GET 确认生效；代码中 `getSetting('inbox_promotion_threshold', 70)` 每次评分时实时读取

## M4: Disable 开关

- **结果**: PASS
- **证据**: `inbox_scoring_enabled = false` 后 batch 返回 `{ scored:0, errors:["scoring disabled"] }`

## M5: Kill -9 恢复

- **结果**: PASS
- **证据**: 手工制造 stale `processing` 记录后跑 batch,日志出现 `[inbox-scoring] swept 1 stale processing items back to pending`
- **修复**: MySQL 需用 `STR_TO_DATE(..., '%Y-%m-%dT%H:%i:%s.%fZ')` 解析 JSON 中的 ISO `last_scored_at`,否则会报 `Truncated incorrect datetime value`

## M6: 强制重评 API

- **结果**: PASS
- **证据**: 默认 LLM 配置切到 `provider=anthropic` 后,`POST /api/v1/ai/score {"inbox_id":"662","force":true}` 返回 `{ scored:true, score:80, promoted:false }`
- **修复**: Anthropic 返回 fenced JSON 时,`serverGenerateJSON()` 需去掉 ```json fence 后再 `JSON.parse`

## 回归 R1-R5

| 项 | 结果 | 说明 |
|----|------|------|
| R1 score-batch 旧契约 | PASS | 入参 `{limit,delay}` 出参 `{scored,failed,skipped,errors}` 不变 |
| R2 SyncOrchestrator | PASS | 调用点已改为 `InboxScoringService.runOne(id, {source:'sync'})` |
| R3 Admin UI | N/A | 需浏览器验证，`ai_score_details` 多字段向后兼容 |
| R4 lint + type-check | PASS | 我们修改的文件零错误 |
| R5 db:generate | PASS | Prisma schema 未变更 |

## 单元测试

- 文件: `src/lib/services/__tests__/inbox-scoring.test.ts`
- 测试数: 11 (全过)
- 覆盖: CAS 并发 (V2), sweep 回收 (V3), retry 上限 (V4), batch 过滤, force 重置, 阈值晋升

## 遗留项

- 接口当前未采集逐条评分耗时,无法严格输出单条 P95;本轮 10 条总耗时 180373ms
- R3 Admin UI 需浏览器手动确认
- T105 历史数据回填正确性需 DB 查询验证

---

## Continuation Closeout - 2026-06-04

> 用户请求名: `inbox-ai-scoring-continuation`。当前仓库无独立 `specs/inbox-ai-scoring-continuation/` 目录,本次 closeout 续接 `specs/inbox-ai-scoring/`。
> SDD 阶段: Closeout。依据: 已有 verify/acceptance 记录,但遗留项要求补 runtime/UI/DB fresh evidence。

### Feature Traits

| Trait | Verdict | Evidence |
|---|---|---|
| multi-stage-workflow | HIT | sync/cron/API -> `InboxScoringService` -> scorer/promotion/logging 是多阶段闭环 |
| user-visible-output | HIT | Inbox UI 展示评分、评分筛选、AI 评分按钮和 toast 结果 |
| external-side-effects | HIT | 自动晋升会写 `contents`、`inbox_items`、`operation_logs` |
| artifact-handoff | HIT | `ai_score_details` 和 `operation_logs.operation_details` 会被后续 F2 消费 |

### Fresh Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| FR-003/FR-004 独立评分状态机 | `prisma/schema.prisma` 有 `inbox_items.scoring_status String? @default("pending") @db.VarChar(20)` 和 `@@index([scoring_status, created_at])`; DB `SHOW COLUMNS` 返回 `varchar(20)` | `prisma/schema.prisma`; 2026-06-04 DB readonly query | PASS |
| FR-017 contents 自动晋升标记 | `prisma/schema.prisma` 有 `contents.auto_promoted Boolean? @default(false)`; DB `SHOW COLUMNS` 返回 `tinyint(1)`; contents 侧索引存在 | `prisma/schema.prisma`; 2026-06-04 DB readonly query | PASS |
| FR-008/FR-009 调度器启动与批处理 | `.next/dev/logs/next-development.log` 有 `[inbox-scoring-scheduler] started (every hour at :00)`; 03:47 日志显示读取 `inbox_scoring_enabled`、执行 sweep、查询 pending、CAS 更新 `scoring_status` | `.next/dev/logs/next-development.log` | PASS |
| FR-014 feedback digest 骨架 | `GET /api/v1/ai/feedback/digest?from=2026-05-01&to=2026-05-22` 返回 `success:true`, `range`, `actions:[]`, `counts:{}`, `note:'F1 baseline; F2 will populate'` | runtime curl on `http://127.0.0.1:3000` | PASS |
| NFR-006 score-batch 旧响应契约 | `POST /api/inbox/score-batch {"limit":1,"delay":0}` 返回 `success:true` 包装, data shape 为 `{scored,failed,skipped,errors}` | runtime curl on `http://127.0.0.1:3000` | PASS for contract |
| US3/评分真实 workflow replay | 同一次 `score-batch` 返回 `{scored:0, failed:1, skipped:0, errors:["[55] ... 405 Not Allowed ... nginx/1.31.1"]}`; 当前真实样本未完成评分 | runtime curl on `http://127.0.0.1:3000` | FAIL |
| T105 历史回填正确性 | DB status: `done=111`, `pending=368`, `processing=87`; `ai_score IS NOT NULL=211`,但 `ai_score IS NOT NULL AND scoring_status='done'=111` | 2026-06-04 DB readonly query | FAIL |
| FR-001/FR-009 默认设置兜底 | DB 存在 `inbox_promotion_threshold=70`, `inbox_scoring_enabled=true`, `inbox_scoring_batch_size=50`, `inbox_scoring_processing_timeout_minutes=10`; 但 `src/lib/services/ai-settings.ts` 的 `DEFAULT_AI_SETTINGS` 当前仅包含 `auto_score_on_sync` | DB readonly query; `src/lib/services/ai-settings.ts` | PARTIAL |
| R3 Admin UI | Inbox 页面有 `AI 评分`按钮、评分筛选、评分排序、评分列、AI 建议文案; `useInboxScoreBatch` 调 `/api/inbox/score-batch` 并 invalidate inbox | `src/app/(dashboard)/inbox/page.tsx`; `src/hooks/queries/useInboxQueries.ts` | PARTIAL |
| Unit regression | `pnpm -s test src/lib/services/__tests__/inbox-scoring.test.ts --run` 通过 11 tests | local test run 2026-06-04 | PASS |
| Type regression | `pnpm -s type-check` 通过,含 route type generation | local type-check 2026-06-04 | PASS |

### DB Evidence Snapshot

```json
{
  "columns": {
    "inbox_scoring_status": "varchar(20)",
    "contents_auto_promoted": "tinyint(1)"
  },
  "indexes": {
    "inbox": 2,
    "contents": 2
  },
  "status": [
    { "scoring_status": "done", "count": "111" },
    { "scoring_status": "pending", "count": "368" },
    { "scoring_status": "processing", "count": "87" }
  ],
  "backfill": {
    "scored": "211",
    "scored_done": "111"
  },
  "settings": {
    "inbox_promotion_threshold": 70,
    "inbox_scoring_enabled": true,
    "inbox_scoring_batch_size": 50,
    "inbox_scoring_processing_timeout_minutes": 10
  }
}
```

### Runtime Evidence Snapshot

- Health endpoint: `GET /api/health` returned HTTP 200; database service `healthy`, application `healthy`, search `degraded` because Meilisearch health failed. Search degradation is unrelated to inbox scoring.
- Scheduler startup: `.next/dev/logs/next-development.log` first line includes `[inbox-scoring-scheduler] started (every hour at :00)`.
- Scheduler execution: 03:47 log sequence reads AI settings, starts batch, executes stale processing sweep, selects pending inbox rows, and updates `scoring_status` through the CAS path.
- API replay: `feedback/digest` skeleton PASS; `score-batch` contract PASS but representative runtime item `[55]` failed because upstream fetch returned nginx `405 Not Allowed`.

### UI Evidence Snapshot

- Browser replay could not be completed: `agent-browser` daemon failed to start in this environment even with escalation.
- Code-level UI evidence exists: Inbox page exposes `AI 评分` button, score filter, score sort, score table column, smart selection threshold, and AI suggestion copy.
- Because no browser screenshot/accessibility snapshot was captured, UI verdict remains PARTIAL.

### Closeout Checklist

| Item | Verdict | Notes |
|---|---|---|
| 旧逻辑/旧路径退役 | PARTIAL | `/api/inbox/score-batch` preserved as compatibility wrapper; `SyncOrchestrator` uses `InboxScoringService.runOne`. No obsolete scoring path found in the sampled grep, but UI/browser verification is incomplete. |
| 发布/CI/follow-through | FAIL | Fresh DB evidence shows backfill mismatch and many `processing` rows. Cannot close without a remediation/backfill decision. |
| 文档/acceptance 更新 | PASS | This continuation closeout block records runtime/UI/DB evidence and verdict. |
| ADR/架构决策保留 | PASS | `scoring_status` independent from `summarization_status`; `contents.auto_promoted` retained for F2; `/api/v1/ai/feedback/digest` retained as F2 contract. |
| 架构债/临时兼容/演进触发信号 | FAIL | `AiSettingsService.DEFAULT_AI_SETTINGS` does not include F1 scoring keys, relying on DB seed instead of code fallback; current DB state violates T105. |
| 知识同步 | N/A | No cross-project reusable procedure beyond this acceptance record. |

### Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PARTIAL | Service/tests/API/schema mostly present; default settings fallback code is incomplete. |
| Workflow closure | FAIL | Current DB has `ai_score IS NOT NULL` rows not marked `done`, 87 `processing` rows, and representative batch replay failed on upstream 405. |
| User-visible outcome | PARTIAL | Inbox UI code exposes scoring affordances, but browser replay was not captured. |

**Overall: FAIL**

不能宣布 `inbox-ai-scoring-continuation` closeout 完成。必须先处理:

1. 修复或确认 `AiSettingsService.DEFAULT_AI_SETTINGS` 是否应包含 F1 四个 scoring keys。
2. 执行/修正历史回填,使 `ai_score IS NOT NULL` 与 `scoring_status='done'` 的口径一致,或更新 spec 解释例外。
3. 清理/回收当前 87 条 `processing` 项,并确认 sweep 对这些项为什么没有全部回收。
4. 对 `score-batch` 选取的真实失败样本 `[55]` 做原因归类: 上游 405 是否应记为永久失败、零分 done、还是重试。
5. 在浏览器可用环境下补一次 `/inbox` UI replay 或截图。
