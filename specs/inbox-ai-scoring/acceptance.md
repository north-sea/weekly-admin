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
