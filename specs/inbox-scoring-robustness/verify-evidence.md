# Verify Evidence: Inbox Scoring Robustness

**Workspace**: `inbox-scoring-robustness` | **Date**: 2026-06-11/12

本文件记录修复前的复现证据、被证伪的假设(Failed Attempt Ledger)、以及修复后的验证结果，用于跨会话防止重复踩坑。

---

## Before 证据（修复前 DB 诊断）

通过 `scripts/inbox_diag.mjs` / `scripts/doctor-inbox-scoring.js` 与本次清洗脚本 dry-run 采集：

- `scoring_status` 分布：pending 堆积 300+（约 354），failed **0**，处于「永不收敛」状态。
- `ai_score_details.error` 中存在整页 HTML 错误页（被原样写入），样本：
  ```
  <html> <head><title>405 Not Allowed</title></head> <body>
  <center><h1>405 Not Allowed</h1></center> <hr><center>nginx/1.x</center> ...
  ```
  清洗脚本 dry-run 实测 **html_polluted = 27** 条，全部为 `405 Not Allowed` nginx 错误页。
- pending 项的 `retry_count` 始终不增长 → 印证 CAS 抢占（pending→processing）整体覆盖 `ai_score_details`、抹掉了 `retry_count`，使其永远到不了 `>=3` 的 `failed` 终态。
- 现象侧：AI 网关 `sub.100xlabs.space` **每天/每小时被反复调用**（hourly cron 在 NAS 上对 300+ pending 反复重撞不稳定网关）。本地日志为空，因为本地 app 未运行，cron 跑在 NAS 部署里。

---

## Failed Attempt Ledger（被证伪的假设）

### ❌ 假设 1：根因是「内容抓取质量 / 405」

- **原始结论**（上一轮 closeout 标注）：问题是"405 content scraping quality"，即内容抓取环节返回 405、抓取质量差。
- **证伪依据**：
  1. DB 实测 `summarization_status = success` 共 **557/566**，摘要抓取链路健康，不是瓶颈。
  2. `scoreInboxItem` 并不做内容抓取——它复用已有 `summary`/`content`，缺摘要直接返回 0。
  3. 那些 `405 Not Allowed` / Cloudflare HTML **出现在 `ai_score_details.error` 里**，即来自**评分阶段对 AI 网关的调用响应**，而非内容源抓取。
- **结论**：真正根因是 ①AI 网关不稳定（返回 HTML 错误页）②错误无分类、HTML 被当 error message 存储 ③strict JSON 无容错 ④CAS 抹零 retry_count 导致不收敛。已在 spec `inbox-scoring-robustness` 中重新定位并修复。

---

## After 验证（修复后）

### 单测（本地 mock AI 网关，不依赖 NAS runtime）

```
src/lib/ai/server/__tests__/client.test.ts        16 tests  ✓
src/lib/services/__tests__/inbox-scoring.test.ts  13 tests  ✓
---------------------------------------------------------------
Test Files  2 passed (2)
Tests       29 passed (29)
```

覆盖：
- `classifyHttpError`：502/524/403 HTML fixture → `AiCallError(transient/auth)`，message 不含整页 HTML。
- `repairLooseJson`：`.0`→`0.0`、尾逗号修复、合法 JSON 透传。
- 退避重试：前两次 transient + 第三次成功 → 最终成功；persistent transient → maxRetries 后抛出。
- CAS 保留 retry_count：runOne 后 retry_count 不被清零。
- markFailed 分流：transient 不增 retry_count 且回 pending；invalid_response 满 3 → failed。
- 批级熔断：连续 5 次 transient 提前终止整批。

### 类型检查

```
next typegen && tsc --noEmit  → ✓ 通过
```

### Diffusion Check（改动扩散面）

`serverGenerateJSON` / `serverGenerateText` 全部调用点（10 处）均走统一 client 层，改动对调用方透明：

| 文件 | 场景 |
|------|------|
| `inbox-scorer.ts` | inbox 评分（本次主修目标） |
| `summary-scorer.ts` / `summary-generator.ts` | 摘要生成/打分 |
| `tag-recommender.ts` / `category-recommender.ts` | 打标签 / 分类推荐 |
| `content-scorer.ts` | 内容评分 |
| `weekly-organizer.ts` | 周刊组织 |
| `api/ai/chat`、`api/ai/test`、`api/tags/detect-similar` | API 路由 |

确认：无任何调用点依赖具体 error message 做控制流（grep 验证）；`AiCallError extends Error`，原 `catch (error)` 逻辑兼容。transient 重试 / 不存 HTML / 宽松 JSON 对所有场景都是「改善而非破坏」。

### 清洗脚本

`scripts/cleanup-inbox-scoring-pollution.ts` dry-run 实测：
```
html_polluted: 27, zombie_processing: 0, stuck_retry: 0
```
`--apply` 属 external-side-effect，执行前需用户确认。
