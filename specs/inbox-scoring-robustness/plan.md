# Implementation Plan: Inbox Scoring Robustness

**Workspace**: `inbox-scoring-robustness` | **Date**: 2026-06-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/inbox-scoring-robustness/spec.md`

---

## Summary

修复 inbox AI 评分链路的三类不收敛问题：① AI 网关返回的 Cloudflare HTML 错误页（502/524/403）被当作真实错误整页写入 DB；② 模型返回的轻微非法 JSON（如 `.0`）被裸 `JSON.parse` 直接判死；③ CAS 抢占覆盖 `ai_score_details` 导致 `retry_count` 每轮清零、永不进 `failed` 终态。配套一个一次性清洗脚本回收已污染的 300+ pending 项。所有改动以单测 + 本地 mock 验证，不依赖 NAS runtime。

---

## Architecture Overview

```text
cron (hourly) ──> InboxScoringService.runBatch
                    │
                    ├─ sweepStaleProcessing  (processing 超时 → pending)
                    ├─ findMany pending       (取 batch)
                    ├─ filter retry_count<3   (← retry_count 被 CAS 抹零，过滤失效)
                    └─ runOne(id)
                         ├─ CAS pending→processing  (← 覆盖 ai_score_details，BUG)
                         ├─ scoreInboxItem
                         │    └─ serverGenerateJSON
                         │         └─ openaiGenerateText ──fetch──> AI 网关 (100xlabs)
                         │              ↑ 网关 502/524/403 HTML 被 throw 成 error
                         └─ markFailed / promote / done
```

本次改动集中在两个文件 + 一个新脚本：

- `src/lib/ai/server/client.ts`：错误分类、退避重试、宽松 JSON 解析
- `src/lib/services/inbox-scoring.ts`：CAS 不再清零 retry_count、收敛到 failed、batch 内熔断
- `scripts/cleanup-inbox-scoring.ts`（新增）：一次性清洗已污染数据

---

## Bugfix Strategy *(bugfix-loop-breaker 命中)*

| Field | Value |
|---|---|
| Observed Behavior | pending 354 项长期不收敛，failed=0，cron 每小时反复重撞不稳定网关；`ai_score_details.error` 存了整页 Cloudflare HTML；54 条 `AI 返回不符合预期的评分结构`；个别 `Failed to parse JSON: ... '.'` |
| Expected Behavior | 网关瞬时错误退避重试而非每条硬撞；轻微非法 JSON 能宽松解析或重试一次；重试满 3 次的项落 `failed` 终态，pending 池单调收敛 |
| Reproduction Status | reproducible（DB 取证 + 错误样本明确，可在单测用 mock 复现各分支） |
| Root Cause Hypothesis | **已验证**：三个独立根因——(1) `openaiGenerateText` 对 `!response.ok` / 非 JSON 响应直接 `throw new Error(整页HTML)`，无分类无退避；(2) `serverGenerateJSON` 用裸 `JSON.parse`，模型偶发 `.0` 这类非法 token 即判死；(3) `runOne` CAS 抢占（`inbox-scoring.ts:82-86`）整体覆盖 `ai_score_details` 为 `{last_scored_at}`，抹掉 `retry_count`，导致永远累积不到 3、永不进 failed、filter 形同虚设 |
| Fix Boundary | 改 `client.ts` 错误分类/退避/JSON 容错、`inbox-scoring.ts` CAS 保留 retry_count + 收敛 + batch 熔断、新增清洗脚本。**不改**评分维度权重算法、prompt 模板、scheduler cron 频率、AI 配置 UI |
| Failed Attempt Handling | 之前 closeout 把根因误定为"内容抓取质量/405"，已被 DB 取证推翻（summarization 557 success，无摘要仅 9 条，错误实为网关 5xx HTML）。本 plan 以取证数据为准，旧定性记录在 spec 血缘 |
| Regression Guard Strategy | 新增单测覆盖：网关 HTML→瞬时错误分类、退避调用次数、宽松 JSON 解析 `.0`、CAS 后 retry_count 保留、retry≥3→failed、batch 熔断提前终止 |
| Diffusion Check Strategy | 检查 `serverGenerateJSON` 的其他调用方（summarization/tagging 等）是否受 JSON 容错改动影响；检查 `ai_score_details` 覆盖写的其他位置 |
| Verification Path | 单测全绿 + 本地 mock 网关脚本演示 before/after 错误分类；清洗脚本 dry-run 输出受影响行数 |

---

## Key Design Decisions

### Decision 1: 错误分类放在 client.ts，向上抛结构化错误

- **背景**: 网关 HTML 错误页和真实模型错误必须区分，否则无法决定"退避重试"还是"计 retry"
- **选项**:
  - A: 在 `inbox-scorer.ts` 用字符串匹配 HTML — 脆弱，且其他调用方无保护
  - B: 在 `client.ts` 源头分类，抛带 `kind` 的结构化错误 — 所有调用方受益
- **结论**: B。新增 `AiGatewayError`（瞬时，可退避）vs 普通 `Error`（真实失败）。判定依据：HTTP 5xx/403 + `content-type: text/html` + 响应体含 Cloudflare 特征（`cf-error-details` / `Error code 5` / `Attention Required`）
- **影响**: `serverGenerateText/JSON` 内部对 `AiGatewayError` 做指数退避（默认 3 次：0/1s/2s + jitter）；超过仍失败才向上抛
- **来源**: UNVERIFIED（基于 DB 错误样本归纳，非官方文档）

### Decision 2: 宽松 JSON 解析 — 先清洗再 parse，仍失败重试一次

- **背景**: 54 条 schema 失败 + `.0` 非法 token，模型输出基本正确只是边角不规范
- **选项**:
  - A: 引入 JSON 修复库 — 新依赖，超出范围
  - B: 轻量清洗（`.0`→`0.0`、去尾逗号、提取首个 `{...}` 块）+ 失败时重试一次请求 — 无新依赖
- **结论**: B。`serverGenerateJSON` 先 `tryParseLenient`，失败则重发一次请求（让模型重答），再失败才抛
- **影响**: 单次评分最坏 2 次模型请求；与退避叠加要设总次数上限避免放大
- **来源**: UNVERIFIED

### Decision 3: CAS 抢占保留 retry_count，收敛到 failed

- **背景**: CAS 覆盖 `ai_score_details` 抹零 retry_count 是不收敛的核心
- **选项**:
  - A: CAS 时用 `JSON_MERGE_PATCH` 只更新 `last_scored_at`，保留其余字段
  - B: CAS 不动 `ai_score_details`，仅改 `scoring_status`；`last_scored_at` 单独时间戳列或写入时再 merge
- **结论**: A。Prisma `updateMany` 的 data 改为读取后 merge，或用 `$executeRaw` + `JSON_MERGE_PATCH`。保证 retry_count 跨轮累积。配合 `markFailed` 已有的 `retryCount>=3 → 'failed'` 逻辑即可收敛
- **影响**: filter `retry_count<3` 恢复有效；retry 满的项进 failed，pending 单调下降
- **来源**: MySQL JSON_MERGE_PATCH（UNVERIFIED 具体语法，实现时核对）

### Decision 4: batch 内网关熔断

- **背景**: 网关挂掉时，一个 batch 50 项会连撞 50 次
- **结论**: `runBatch` 记录连续 `AiGatewayError` 计数，达阈值（默认 3）提前 break，剩余项保持 pending 待下轮。避免雪崩式重撞
- **影响**: 网关恢复后下个 cron 周期自然继续

---

## Module Design

### Module: client.ts

**职责**: AI 文本/JSON 生成，错误分类与重试的唯一收口

**改动概述**:
- 新增 `export class AiGatewayError extends Error { status?: number }`，标记瞬时网关错误
- `openaiGenerateText` / `anthropicGenerateText`：`!response.ok` 或非 JSON 响应时，先判定是否为网关错误页（5xx/403 + html + CF 特征），是则抛 `AiGatewayError`，否则抛原 Error（截断长度，不再整页写入）
- `serverGenerateText`：包一层 `withRetry`，仅对 `AiGatewayError` 指数退避
- `serverGenerateJSON`：`tryParseLenient(text)` → 失败重发一次 → 再失败抛

**关键行为**:
```text
withRetry(fn, {retries:3, baseDelayMs:1000}):
  for attempt in 0..retries:
    try return await fn()
    catch e:
      if e is AiGatewayError and attempt<retries: sleep(base*2^attempt + jitter); continue
      throw e

tryParseLenient(text):
  s = strip code fences
  s = extract first balanced {...}
  s = s.replace(/([:,\[]\s*)\.(\d)/g, '$1 0.$2')   # .0 → 0.0
  s = s.replace(/,(\s*[}\]])/g, '$1')              # trailing comma
  return JSON.parse(s)
```

**注意事项**: 错误体截断到 ~500 字符再入 message，杜绝整页 HTML 落库。

### Module: inbox-scoring.ts

**职责**: 评分编排、状态机、批处理

**改动概述**:
- `runOne` CAS 抢占：不再用对象字面量覆盖 `ai_score_details`，改为保留既有字段只更新 `last_scored_at`（`$executeRaw` + `JSON_MERGE_PATCH` 或先读后 merge）
- `runBatch`：捕获 `AiGatewayError` 单独计数，连续达阈值 break；区分 gateway-skip 与真实 failed
- `markFailed`：保持 `retryCount>=3 → 'failed'`，确认 merge 不再被抹零后即收敛

**关键行为**:
```text
runOne CAS:
  UPDATE inbox_items
  SET scoring_status='processing',
      ai_score_details = JSON_MERGE_PATCH(
        COALESCE(ai_score_details,'{}'),
        JSON_OBJECT('last_scored_at', :now))
  WHERE id=:id AND scoring_status='pending'

runBatch:
  gatewayStreak=0
  for item in eligible:
    res = runOne(item)
    if res.error is gateway: gatewayStreak++; if gatewayStreak>=3: break
    else gatewayStreak=0
```

### Module: scripts/cleanup-inbox-scoring.ts (新增)

**职责**: 一次性清洗已污染数据，dry-run 默认

**改动概述**: 参考 `scripts/drop-legacy-tables.js` / `migrate-to-unified-sources.ts` 的 dry-run 约定（默认只读预演，`--apply` 才写）

**关键行为**:
```text
默认 dry-run 输出:
  - error 含 Cloudflare/<!DOCTYPE html> 特征的项数  → 计划清空 error 字段
  - scoring_status='processing' 僵尸项数            → 计划复位 pending
  - retry_count>=3 仍 pending 的项数               → 计划落 failed
  - 受影响总行数
--apply: 在事务中执行上述三类修正，打印实际影响行数
```

**注意事项**: 只读预演必须先跑；`--apply` 需显式确认（execute 阶段由用户触发，不自动 run）。

---

## Producer-Consumer Matrix *(multi-stage-workflow + artifact-handoff 命中)*

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `client.ts` | `AiGatewayError` 分类 | `inbox-scoring.ts` 熔断/退避决策 | 单测：mock 网关 HTML → runBatch 在第 3 连续错误 break |
| `runOne` CAS | 保留的 `retry_count` | `runBatch` filter + `markFailed` | 单测：连续失败 3 次后 status=failed，retry_count=3 |
| 清洗脚本 | 修正后的 `scoring_status` / 清空 error | 下一轮 cron runBatch | dry-run 行数报告 + apply 后复查分布 |

孤儿 artifact：无。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可用性 | 网关不稳时不雪崩重撞 | batch 熔断 + 退避 | 单测 mock 连续 5xx |
| 一致性 | pending 池单调收敛，无僵尸 | CAS 保留 retry_count + failed 终态 | 单测 + 清洗脚本前后分布对比 |
| 成本 | 减少对 100xlabs 的无效调用 | 熔断 + retry 收敛后 pending 不再反复重试 | 收敛后 pending 数下降（NAS 侧后续观测） |

---

## Capacity / Scale Notes

- **规模假设**: inbox 千级条目，pending 当前 354，cron 每小时 batch 50
- **读写特征**: 写多读少的批处理，外部 AI 调用是瓶颈
- **失败代价**: 重复（无效重试烧额度）+ 不可用（网关挂时雪崩）。本次主要消除"重复"

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| `JSON_MERGE_PATCH` MySQL 版本/语法差异 | CAS 改动失效 | 实现时核对 MySQL 版本；退路用先读后 merge 的两步写 |
| 宽松解析掩盖真实模型质量问题 | 错误评分入库 | 仍走 zod 校验，清洗只修语法不改语义；解析后 schema 不过照样失败 |
| 退避 × 重发叠加放大调用 | 单条最坏 N 次请求 | 设总请求上限（退避3 + JSON重发1，互斥计数） |
| 清洗脚本误清有效 error | 丢失诊断信息 | 仅匹配 CF/HTML 特征；dry-run 先确认；事务可回滚 |

---

## Stage Readiness

- [x] Spec 稳定，三个范围决策已确认
- [x] 根因已用 DB 取证验证（非假设）
- [x] 改动边界清晰（2 文件 + 1 脚本）
- [ ] tasks.md 待拆

**下一步**: 进入 `tasks` 阶段，按"client.ts 错误分类/退避 → JSON 容错 → inbox-scoring CAS/收敛/熔断 → 清洗脚本 → 单测"拆可执行任务并标依赖。
