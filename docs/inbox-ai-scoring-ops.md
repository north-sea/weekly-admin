# Inbox AI Scoring - 运维说明

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DISABLE_INBOX_SCORING_CRON` | (未设置) | 设为 `1` 禁用进程内 cron 调度器 |
| `NODE_ENV` | `development` | `test` 时不启动调度器 |
| `NEXT_PHASE` | (未设置) | `phase-production-build` 时不启动调度器 |

## Cron 调度

- 频率：每小时整点 (`0 * * * *`)
- 实现：`src/lib/scheduling/inbox-scoring-scheduler.ts`，使用 `croner` 库
- 启动入口：`src/instrumentation.ts` (Next.js register hook)
- 防重复：`globalThis.__inboxScoringSchedulerStarted` 哨兵，热重载不会重复注册

### 调整频率

修改 `inbox-scoring-scheduler.ts` 中 `new Cron('0 * * * *', ...)` 的 cron 表达式。

## 数据库设置 (ai_settings 表)

| key | 默认值 | 说明 |
|-----|--------|------|
| `inbox_scoring_enabled` | `true` | 全局开关，关闭后 cron 和 batch 均跳过 |
| `inbox_scoring_batch_size` | `50` | 每批处理上限 |
| `inbox_promotion_threshold` | `70` | 自动晋升阈值 (0-100) |
| `inbox_scoring_processing_timeout_minutes` | `10` | processing 状态超时回收时间 |

## 状态机

```
pending → processing → done
                    → failed (retry_count >= 3)
```

- CAS 抢占：`updateMany WHERE scoring_status='pending'` 返回 count=1 才继续
- 超时回收：`sweepStaleProcessing()` 在每次 batch 开始时执行
- 重试上限：3 次失败后标记 `failed`，不再被 batch 拾取

## 排查 `scoring_status='failed'` 的记录

```sql
SELECT id, title, ai_score_details
FROM inbox_items
WHERE scoring_status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;
```

`ai_score_details.error` 字段包含最后一次失败的错误信息，`ai_score_details.retry_count` 显示重试次数。

### 手动重评

```bash
curl -X POST http://localhost:3000/api/v1/ai/score \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"inbox_id": "123", "force": true}'
```

`force: true` 会将状态重置为 pending 再执行评分。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai/score` | 单条手动评分/重评 |
| POST | `/api/inbox/score-batch` | 批量评分 (旧接口，内部转发) |
| GET | `/api/v1/ai/feedback/digest` | 反馈摘要 (F1 骨架) |

## 自动晋升

评分 >= `inbox_promotion_threshold` 的条目自动创建 content 记录：
- 使用 `$transaction` 保证原子性
- 双重检查 `content_id` 防止并发重复创建
- 操作日志记录 `action='promote', source='cron'|'sync'|'api'`
