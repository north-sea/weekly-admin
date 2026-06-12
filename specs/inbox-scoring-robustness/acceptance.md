# Acceptance: Inbox AI 评分鲁棒性闭环

**Workspace**: `inbox-scoring-robustness`
**Closeout Date**: 2026-06-12
**Verdict**: **PASS**
**Verify 方式**: 单测 + 本地 mock（NFR-003，不依赖 NAS runtime）；清洗脚本本地 dry-run 取证。

---

## 1. 验收总览

| 维度 | 结果 |
|---|---|
| 全量单测 | ✅ 65 files / 276 tests 全绿（`vitest run`） |
| 类型检查 | ✅ `next typegen && tsc --noEmit` 通过 |
| 新增针对性单测 | ✅ client 16 + inbox-scoring 增量（transient 不计 retry、熔断） |
| 清洗脚本 dry-run | ✅ 命中 27 条 HTML 污染，与 DB 取证一致 |
| Diffusion check | ✅ 10 个 `serverGenerate*` 调用点全部向后兼容 |
| 契约不破坏 | ✅ `score-batch` 响应契约未变（FR-008） |

---

## 2. Functional Requirements 映射

| FR | 实现 | 证据 |
|---|---|---|
| FR-001 错误分类 | `AiCallError` + `AiCallErrorKind`（transient/invalid_response/auth/unknown）；`classifyHttpError` 识别 HTML/Cloudflare/5xx/429/408→transient，401→auth | `client.test.ts` classifyHttpError 用例 |
| FR-002 退避 | `serverGenerateText` 对 transient 指数退避（base 250ms + 25% jitter，默认 2 retry），auth/invalid_response 不重试 | `client.test.ts` 「retries transient then succeeds」「gives up after maxRetries」 |
| FR-003 收敛终态 | `markFailed` 非 transient 累加 retry_count，满 3 落 `failed`；CAS 用 `JSON_SET` 保留 retry_count（修复抹零 bug） | `inbox-scoring.test.ts` retry>=3→failed、CAS 保留 retry_count |
| FR-004 不存 HTML 整页 | `summarizeBody` 截断至 `MAX_DETAIL_CHARS=300`，仅存归一化摘要 | `client.test.ts` 断言 message 不含整页 HTML |
| FR-005 schema 即时容错 | `serverGenerateJSON` 解析失败先 `repairLooseJson`（`.5`→`0.5`、去尾逗号）再解析，仍失败抛 `invalid_response` | `client.test.ts` repairLooseJson 三种输入 |
| FR-006 清洗脚本 | `scripts/cleanup-inbox-scoring-pollution.ts`，dry-run 默认 / `--apply`，幂等可重跑 | 本地 dry-run 输出（27 HTML 污染 / 0 僵尸 / 0 异常 retry） |
| FR-007 参数可配 | `inbox_scoring_transient_circuit_limit`（默认 5）走 `getSetting`；maxRetries 走 options | `inbox-scoring.test.ts` 熔断用例 |
| FR-008 契约不变 | 未改 `runBatch` 返回结构，仅增 `errorKind` 内部字段 | 全量单测 + 契约测试通过 |

---

## 3. User Story 验收

| 场景 | 结果 | 说明 |
|---|---|---|
| US1-1 Cloudflare HTML→transient 且不存整页 | ✅ | classifyHttpError + summarizeBody |
| US1-2 retry 达上限→failed 终态 | ✅ | markFailed 非 transient 满 3 落 failed |
| US1-3 pending 单调收敛 | ✅（逻辑）| CAS 保留 retry_count + 真实失败累加，消除永久重试；生产收敛待 `--apply` 后观测 |
| US1-4 429→transient 退避 | ✅ | classifyHttpError 429→transient |
| US1-5 孤儿 processing 受 retry 约束 | ✅ | 既有 sweepStaleProcessing + retry 过滤 |
| US1-6 CAS 抢占不被破坏 | ✅ | CAS 改 `$executeRaw` 仍 pending→processing 原子抢占 |
| US2-1 非法 JSON 宽松解析 | ✅ | repairLooseJson |
| US2-2 重试后仍失败记分类 | ✅ | invalid_response 计入 retry |
| US3-1/US3-2/US3-3 清洗 dry-run 幂等 | ✅ | 脚本 dry-run 预览、`--apply` 才写、可重跑 |

---

## 4. Failed Attempt Ledger（防回环）

| 被证伪假设 | 证伪依据 | 真实结论 |
|---|---|---|
| 根因是「内容抓取 405」 | 2026-06-11 DB 取证：summarization success 557、pending 99% 有摘要 | 405/HTML 来自 **AI 网关响应**被原样写入 `ai_score_details.error`，非抓取 |
| 「每天都在调用」属异常外部访问 | cron 为每小时一次，本地 app 未运行故本地无日志 | 是 354 pending 在 NAS 上每小时重撞不稳定网关，修复重试收敛即止 |

详见 `verify-evidence.md`。

---

## 5. 遗留与后续

- **待执行（external-side-effect）**: 在 NAS 生产库跑 `pnpm tsx scripts/cleanup-inbox-scoring-pollution.ts --apply` 清洗 27 条 HTML 污染，使存量从干净状态收敛。需用户在生产环境确认后执行。
- **观测建议**: apply 后隔日复查 `scoring_status` 分布，确认 pending 下降、failed 出现非零终态。
- **Out of scope**（spec 已声明）: 更换网关、抓取链路改造、评分业务调优、worker 化迁移。

---

## Stage Readiness

| 检查项 | 状态 |
|---|---|
| 代码改动全部完成（T001-T011） | ✅ |
| 全量单测 + 类型检查通过 | ✅ |
| 清洗脚本 dry-run 取证一致 | ✅ |
| Diffusion check 无破坏 | ✅ |
| Failed Attempt Ledger 已记录 | ✅ |
| 唯一遗留为生产侧 `--apply`（需用户确认） | ✅ 已登记 |

**结论**: PASS。代码闭环完成，唯一待办是生产库一次性清洗，已作为 external-side-effect 显式登记待用户确认。
