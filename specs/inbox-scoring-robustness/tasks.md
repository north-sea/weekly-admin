# Tasks: Inbox Scoring Robustness

**Workspace**: `inbox-scoring-robustness` | **Date**: 2026-06-11
**Input**: `specs/inbox-scoring-robustness/spec.md` + `plan.md`
**Prerequisites**: spec.md (✅), plan.md (✅)

---

## 执行原则

- 任务按依赖顺序组织：错误分类底座 → JSON 容错 → 退避/熔断 → service 收敛修复 → 清洗脚本 → 回归守护。
- 每个改动点都先写/改单测（本地 mock AI 网关），不依赖 NAS runtime。
- 关键路径：T001 → T002 → T004 → T005（错误分类是其余一切的底座）。

---

## Phase 1: AI Client 错误分类与重试底座

**目标**: 让 `client.ts` 能区分瞬时网关错误、非法响应和真实模型输出，并对瞬时错误做退避重试。

- [x] T001 [Bugfix] 新增 `AiCallError` 错误分类类型
  - scope: `src/lib/ai/server/client.ts`（新增 `AiCallError` class / `AiErrorKind` 联合类型：`transient` | `invalid_response` | `auth` | `unknown`）
  - maps_to: FR-001 / Bugfix Root Cause（错误无分类）
  - verify: 单测断言不同输入构造出正确 kind

- [x] T002 [Bugfix] `openaiGenerateText` 识别网关 HTML 错误页
  - scope: `src/lib/ai/server/client.ts`：`!response.ok` 与非 JSON 分支检测 `text/html` / Cloudflare 错误页（`<title>...Cloudflare</title>`、`error code: 5xx`、`Bad gateway`、`A timeout occurred`、`Attention Required`），归类 `transient`；401/403 真实鉴权归 `auth`；不再把整页 HTML 当 error message，仅保留简短摘要（状态码 + 简短标识）
  - maps_to: FR-001 / FR-002
  - verify: 单测喂 502/524/403 HTML fixture，断言抛 `AiCallError(transient)` 且 message 不含整页 HTML

- [x] T003 [Bugfix] `serverGenerateJSON` 宽松 JSON 解析
  - scope: `src/lib/ai/server/client.ts`：解析前修复常见非法 JSON（前导 `.0`→`0.0`、尾逗号），裸 `JSON.parse` 失败时尝试一次 sanitize 再解析；仍失败抛 `AiCallError(invalid_response)`
  - maps_to: FR-004 / Bugfix（`.0` 非法数字、JSON parse 54+ 失败）
  - verify: 单测覆盖 `"content": .0`、尾逗号、合法 JSON 三种输入

- [x] T004 [Bugfix] `serverGenerateText` 对 transient 做指数退避重试
  - scope: `src/lib/ai/server/client.ts`：transient 错误指数退避（如 3 次，base+jitter，可注入 sleep 以便测试）；`auth`/`invalid_response` 不重试直接抛
  - maps_to: FR-003 / NFR 可用性
  - verify: 单测 mock fetch 前两次 transient、第三次成功 → 最终成功且调用 3 次；auth 错误 → 只调用 1 次

---

## Phase 2: Scoring Service 重试收敛修复

**目标**: 修复 retry_count 被抹零导致永不收敛的根因，并区分瞬时错误与真实失败。

- [x] T005 [Bugfix] 修复 CAS 抢占覆盖 retry_count
  - scope: `src/lib/services/inbox-scoring.ts:75-86`（`runOne` 的 pending→processing CAS 更新）：改为只更新 `last_scored_at`，保留已有 `ai_score_details`（含 retry_count、error_kind），不再整体覆盖
  - maps_to: FR-005 / Bugfix Root Cause（CAS 覆盖 retry_count）
  - verify: 单测 mock 一条已有 retry_count=2 的 item，跑 runOne 后断言 retry_count 未被清零

- [x] T006 [Bugfix] `markFailed` 区分 transient 与真实失败
  - scope: `src/lib/services/inbox-scoring.ts:195-216`：捕获到 `AiCallError(transient)` 时不计 retry_count（回 pending 等下轮），其余错误计 retry_count，满 3 落 `failed` 终态并记录 `error_kind`
  - maps_to: FR-005 / FR-006
  - verify: 单测：transient 错误 N 次后仍是 pending 且 retry 不增；invalid_response 满 3 次 → status=failed

- [x] T007 [Bugfix] `runBatch` 加 batch 级熔断
  - scope: `src/lib/services/inbox-scoring.ts:142-193`：单批内连续 transient 达阈值（如 5）即提前终止整批并记录原因，避免无谓重撞网关
  - maps_to: FR-003 / NFR 成本
  - verify: 单测：mock 连续 transient，断言批在阈值处提前停止、未遍历完所有 item

---

## Phase 3: 污染数据一次性清洗

**目标**: 清理已被 Cloudflare HTML、卡死 retry/processing 污染的 300+ pending 项。

- [x] T008 一次性清洗脚本（dry-run 优先）
  - scope: `scripts/cleanup-inbox-scoring-pollution.ts`（沿用 `drop-legacy-tables.js` 的 dry-run 风格）：默认只读预演打印将处理的行数与样本；`--apply` 才执行。清洗动作：① 清空 `ai_score_details.error` 中的 HTML 错误页、归类为 transient；② 复位超时僵尸 `processing`→`pending`；③ 卡死的异常 retry 归一
  - maps_to: FR-007 / 用户决策「一次性清洗脚本」
  - verify: 本地 `--dry-run` 输出与 DB 诊断数据一致（pending 354 / processing 1 / HTML error 多条）；`--apply` 在确认后执行

---

## Bugfix Loop Breaker Tasks

- [x] T009 [Bugfix] 记录复现证据
  - scope: `specs/inbox-scoring-robustness/verify-evidence.md`（新建）：记录修复前 DB 诊断（pending 354、failed 0、HTML error 多条、retry 不收敛）作为 before 证据
  - maps_to: Bugfix Context / FR-007
  - verify: before 证据已落盘，可与修复后对比

- [x] T010 [Bugfix] 维护 Failed Attempt Ledger
  - scope: `tasks.md` / `verify-evidence.md`：若某假设被证伪（如"根因是内容抓取 405"已证伪），记录排除依据
  - maps_to: Failed Attempt Ledger
  - verify: ledger 至少记录"内容抓取 405"假设的证伪（实测 summarization 557 success、错误来自 AI 网关）

- [x] T011 [Bugfix] Regression Guard + Diffusion Check
  - scope: 单测套件 + 扫描所有 `serverGenerateJSON`/`serverGenerateText` 调用点（摘要、打标签、评分）确认改动不破坏其他场景
  - maps_to: FR-008
  - verify: 全量受影响单测通过；diffusion check 列出所有调用点并确认兼容

---

## 依赖与顺序

- **必须先完成**: T001（错误类型）→ T002/T003/T004（client 各能力依赖该类型）
- **关键路径**: T001 → T002 → T004 → T005 → T006
- **可相对独立**: T008 清洗脚本只依赖错误分类语义（T001/T002），可与 Phase 2 并行
- **收尾**: T011 必须在所有代码改动后执行

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| FR-001 错误分类 | T001, T002 |
| FR-002 不存 HTML | T002 |
| FR-003 退避+熔断 | T004, T007 |
| FR-004 schema 容错 | T003 |
| FR-005 重试收敛 | T005, T006 |
| FR-006 失败终态 | T006 |
| FR-007 清洗脚本 | T008, T009 |
| FR-008 回归守护 | T011 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| 错误分类底座 | T001 | T011 |
| 重试收敛（CAS bug） | T005, T006 | T011 |
| 成本（熔断） | T007 | T007 |

---

## Notes

- 所有单测以本地 mock fetch 为主（注入 sleep / fetch），不依赖 NAS runtime。
- 清洗脚本 `--apply` 属于 external-side-effect，执行前需用户确认。

---

## Stage Readiness

- 推荐下一步：`implement`（从 T001 开始）
- 阻塞项：无。三个范围决策已定，client.ts / inbox-scoring.ts 关键行号已确认。
