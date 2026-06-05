# Cron Job 配置指南

本文档说明如何用 automation token 调用 Admin `/api/v1` 契约，完成定时同步、评分和周刊候选预览。

## 概述

推荐 Cron 只调用 agent-friendly `/api/v1` endpoint。旧 `/api/sources/sync-all`、`/api/weekly/auto-create`、`/api/weekly/auto-link`、`/api/weekly/backfill` 仍作为 legacy human-admin/API 兼容路径保留，不再作为新自动化接入首选。

| API | Scope | 功能 | 建议执行时间 |
|-----|-------|------|-------------|
| `POST /api/v1/jobs/sync` | `sync:run` | 同步数据源到收件箱 | 每天 08:00 |
| `POST /api/v1/jobs/score` | `score:run` | 批量执行 inbox AI 评分 | 每天 08:20 |
| `GET /api/v1/weekly/candidates` | `weekly:read` | 查询本周候选内容 | 每周日 22:30 |
| `POST /api/v1/weekly/suggestions` | `weekly:suggest` | 生成周刊组织建议预览，不直接写入周刊内容 | 每周日 22:45 或人工触发 |
| `GET /api/v1/ai/feedback/digest` | `ops:read` | 汇总人工反馈动作 | 每周或排障时 |

OpenAPI 契约可从 `GET /api/v1/openapi.json` 获取。

## API 认证

`CRON_API_TOKEN` 必须是 automation token，不是后台用户 JWT，也不依赖浏览器 cookie。创建 token：

```bash
pnpm tsx scripts/create-automation-token.ts \
  --name cron-prod \
  --caller-type cron \
  --scopes sync:run,score:run,weekly:read,weekly:suggest,ops:read
```

脚本只保存 token hash，明文 token 只输出一次。将输出的 `wa_...` token 放入密钥管理或环境变量：

```bash
Authorization: Bearer ${CRON_API_TOKEN}
```

写入类 endpoint 必须提供 `Idempotency-Key` header。重复使用相同 key 和相同 payload 会返回 replay，不重复执行业务副作用；相同 key 搭配不同 payload 会返回 conflict。

## Crontab 配置

```crontab
WEEKLY_API_URL=https://your-domain.com
CRON_API_TOKEN=wa_xxx

# 每天 08:00 同步 Karakeep 新增内容
0 8 * * * curl -sS -X POST "${WEEKLY_API_URL}/api/v1/jobs/sync" \
  -H "Authorization: Bearer ${CRON_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sync-karakeep-$(date +\%Y-\%m-\%d)" \
  -d '{"type":"karakeep","incremental":true,"auto_preprocess":true,"max_items":100}' \
  >> /var/log/weekly-cron.log 2>&1

# 每天 08:20 批量评分
20 8 * * * curl -sS -X POST "${WEEKLY_API_URL}/api/v1/jobs/score" \
  -H "Authorization: Bearer ${CRON_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: score-inbox-$(date +\%Y-\%m-\%d)" \
  -d '{"limit":50,"delay":0}' \
  >> /var/log/weekly-cron.log 2>&1

# 每周日 22:30 记录候选内容摘要
30 22 * * 0 curl -sS "${WEEKLY_API_URL}/api/v1/weekly/candidates?weekOffset=0&limit=30" \
  -H "Authorization: Bearer ${CRON_API_TOKEN}" \
  >> /var/log/weekly-cron.log 2>&1
```

## Shell 脚本示例

创建脚本 `/usr/local/bin/weekly-cron.sh`：

```bash
#!/bin/bash
set -euo pipefail

API_URL="${WEEKLY_API_URL:-https://your-domain.com}"
API_TOKEN="${CRON_API_TOKEN:?CRON_API_TOKEN is required}"
LOG_FILE="${WEEKLY_CRON_LOG:-/var/log/weekly-cron.log}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

call_post() {
  local endpoint="$1"
  local idempotency_key="$2"
  local data="$3"
  local description="$4"

  log "开始执行: $description"

  response=$(curl -sS -w "\n%{http_code}" -X POST "${API_URL}${endpoint}" \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: ${idempotency_key}" \
    -d "$data")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  log "HTTP ${http_code}: ${body}"
}

case "${1:-}" in
  sync-inbox)
    call_post "/api/v1/jobs/sync" "sync-karakeep-$(date +%Y-%m-%d)" \
      '{"type":"karakeep","incremental":true,"auto_preprocess":true,"max_items":100}' \
      "同步 Karakeep"
    ;;
  score)
    call_post "/api/v1/jobs/score" "score-inbox-$(date +%Y-%m-%d)" \
      '{"limit":50,"delay":0}' \
      "批量评分"
    ;;
  candidates)
    curl -sS "${API_URL}/api/v1/weekly/candidates?weekOffset=0&limit=30" \
      -H "Authorization: Bearer ${API_TOKEN}" >> "$LOG_FILE"
    ;;
  *)
    echo "用法: $0 {sync-inbox|score|candidates}"
    exit 1
    ;;
esac
```

## 响应判断

所有 automation endpoint 使用统一 envelope：

```json
{
  "success": true,
  "data": {
    "status": "succeeded"
  },
  "meta": {
    "timestamp": "2026-06-04T00:00:00.000Z",
    "runId": "auto_...",
    "status": "succeeded",
    "idempotentReplay": false
  }
}
```

Cron 告警应优先判断：

- `success: false`：认证、参数、幂等冲突或内部错误。
- `meta.status: partial_success`：部分条目失败，需要查看 `data.errors` 或 `data.results`。
- `meta.status: empty`：没有可处理数据，通常不是故障。
- `error.code: AUTOMATION_SCOPE_FORBIDDEN`：token scope 不足。
- `error.code: IDEMPOTENCY_PAYLOAD_CONFLICT`：同一个 `Idempotency-Key` 被不同 payload 复用。

## Legacy 兼容路径

以下路径仍可能被旧脚本或后台页面使用，但新 cron 不应优先接入：

| Legacy API | 推荐替代 |
|------------|----------|
| `POST /api/sources/sync-all` | `POST /api/v1/jobs/sync` |
| `POST /api/weekly/auto-create` | 继续由后台创建，或由后续 weekly create contract 接管 |
| `POST /api/weekly/auto-link` | `GET /api/v1/weekly/candidates` + `POST /api/v1/weekly/suggestions` + `POST /api/v1/weekly/suggestions/{id}/apply` |
| `POST /api/weekly/backfill` | 保留人工维护用途 |

`POST /api/v1/ai/score` 是 human-admin JWT 手动单条重评分入口；automation 批量评分使用 `POST /api/v1/jobs/score`。
发布到 Quail 使用 `POST /api/v1/weekly/publish`，该 endpoint 需要 `weekly:publish` scope 和 `Idempotency-Key`。

## 故障排查

1. **401**
   - 检查 `CRON_API_TOKEN` 是否为 `wa_` automation token。
   - 确认 token 未过期、未禁用、未撤销。

2. **403**
   - 检查 token 是否包含 endpoint 所需 scope。

3. **409**
   - 检查 `Idempotency-Key` 是否被不同 payload 复用。
   - 若旧 run 仍在 `running`，等待完成后再重试。

4. **空结果**
   - `empty` 是有效状态。同步、评分或候选查询没有数据时不应直接告警。

5. **数据库迁移未应用**
   - automation token/run 依赖 `automation_tokens` 和 `automation_runs` 表。
   - 部署前运行 `pnpm db:migrate`。

## 安全建议

- 不要把 token 写入仓库、日志或截图。
- 为 cron、n8n、Hermes 分配不同 token 和最小 scope。
- 发布/投递类 scope 不要和普通同步/评分 token 混用。
- 定期轮换 token；撤销旧 token 后确认外部任务已切换。

*最后更新: 2026-06-04*
