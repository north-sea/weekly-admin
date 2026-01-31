# Cron Job 配置指南

本文档说明如何配置定时任务来自动化周刊管理流程。

## 概述

周刊自动化系统提供以下 API 端点，可通过 Cron Job 定时调用：

| API | 功能 | 建议执行时间 |
|-----|------|-------------|
| `/api/weekly/auto-create` | 自动创建本周周刊 | 每周一 00:05 |
| `/api/weekly/auto-link` | 自动关联本周内容 | 每周日 23:00 |
| `/api/weekly/backfill` | 回填历史空周刊 | 一次性执行 |

## API 认证

所有 API 需要通过 Bearer Token 认证。在请求头中添加：

```
Authorization: Bearer <YOUR_API_TOKEN>
```

API Token 可在系统设置中生成，或使用环境变量 `CRON_API_TOKEN`。

## Crontab 配置

### 1. 编辑 crontab

```bash
crontab -e
```

### 2. 添加定时任务

```crontab
# 周刊自动化任务
# 环境变量
WEEKLY_API_URL=https://your-domain.com
CRON_API_TOKEN=your-api-token

# 每周一 00:05 自动创建本周周刊
5 0 * * 1 curl -X POST "${WEEKLY_API_URL}/api/weekly/auto-create" \
  -H "Authorization: Bearer ${CRON_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"forceCreate": false}' \
  >> /var/log/weekly-cron.log 2>&1

# 每周日 23:00 自动关联本周内容
0 23 * * 0 curl -X POST "${WEEKLY_API_URL}/api/weekly/auto-link" \
  -H "Authorization: Bearer ${CRON_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"maxItems": 15, "weekOffset": 0}' \
  >> /var/log/weekly-cron.log 2>&1
```

### 3. 使用 Shell 脚本（推荐）

创建脚本 `/usr/local/bin/weekly-cron.sh`：

```bash
#!/bin/bash

# 配置
API_URL="${WEEKLY_API_URL:-https://your-domain.com}"
API_TOKEN="${CRON_API_TOKEN}"
LOG_FILE="/var/log/weekly-cron.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 调用 API
call_api() {
    local endpoint=$1
    local data=$2
    local description=$3

    log "开始执行: $description"

    response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}${endpoint}" \
        -H "Authorization: Bearer ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$data")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        log "成功: $description (HTTP $http_code)"
        log "响应: $body"
    else
        log "失败: $description (HTTP $http_code)"
        log "错误: $body"
    fi
}

# 主逻辑
case "$1" in
    create)
        call_api "/api/weekly/auto-create" '{"forceCreate": false}' "创建本周周刊"
        ;;
    link)
        call_api "/api/weekly/auto-link" '{"maxItems": 15, "weekOffset": 0}' "关联本周内容"
        ;;
    backfill)
        call_api "/api/weekly/backfill" '{"dryRun": false, "maxItemsPerIssue": 15}' "回填历史周刊"
        ;;
    *)
        echo "用法: $0 {create|link|backfill}"
        exit 1
        ;;
esac
```

设置权限：

```bash
chmod +x /usr/local/bin/weekly-cron.sh
```

Crontab 配置：

```crontab
# 每周一 00:05 创建周刊
5 0 * * 1 /usr/local/bin/weekly-cron.sh create

# 每周日 23:00 关联内容
0 23 * * 0 /usr/local/bin/weekly-cron.sh link
```

## API 参数说明

### `/api/weekly/auto-create`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `forceCreate` | boolean | false | 是否强制创建（即使已存在） |
| `weekOffset` | number | 0 | 周偏移量（0=本周，-1=上周） |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "action": "created",
    "issue": {
      "id": 78,
      "issue_number": 78,
      "title": "第 78 期",
      "start_date": "2026-01-27",
      "end_date": "2026-02-02"
    }
  }
}
```

### `/api/weekly/auto-link`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxItems` | number | 15 | 每期最大关联数量 |
| `weekOffset` | number | 0 | 周偏移量 |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "issueId": 78,
    "issueNumber": 78,
    "linkedCount": 12,
    "skippedCount": 3,
    "linkedContents": [
      {"id": 1001, "title": "文章标题1"},
      {"id": 1002, "title": "文章标题2"}
    ],
    "skippedContents": [
      {"id": 1003, "title": "文章标题3", "reason": "已关联到其他周刊"}
    ]
  }
}
```

### `/api/weekly/backfill`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dryRun` | boolean | false | 是否仅预览不执行 |
| `maxItemsPerIssue` | number | 15 | 每期最大关联数量 |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "processedIssues": 5,
    "linkedContents": 45,
    "skippedContents": 10,
    "details": [
      {
        "issueId": 47,
        "issueNumber": 47,
        "linkedCount": 8,
        "linkedContents": [...]
      }
    ]
  }
}
```

## 日志监控

### 查看日志

```bash
# 实时查看
tail -f /var/log/weekly-cron.log

# 查看最近 100 行
tail -n 100 /var/log/weekly-cron.log

# 搜索错误
grep "失败" /var/log/weekly-cron.log
```

### 日志轮转

创建 `/etc/logrotate.d/weekly-cron`：

```
/var/log/weekly-cron.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

## 故障排查

### 常见问题

1. **认证失败 (401)**
   - 检查 API Token 是否正确
   - 确认 Token 未过期

2. **请求超时**
   - 检查网络连接
   - 增加 curl 超时时间：`curl --max-time 60 ...`

3. **周刊已存在**
   - 正常情况，API 会返回已存在的周刊信息
   - 如需强制创建，设置 `forceCreate: true`

4. **无内容可关联**
   - 检查是否有 `ready` 或 `published` 状态的内容
   - 确认内容的 `created_at` 在周刊时间范围内

### 手动测试

```bash
# 测试创建周刊（dry-run 模式不可用，直接测试）
curl -X POST "https://your-domain.com/api/weekly/auto-create" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceCreate": false}'

# 测试回填（使用 dry-run 模式预览）
curl -X POST "https://your-domain.com/api/weekly/backfill" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "maxItemsPerIssue": 15}'
```

## 安全建议

1. **Token 安全**
   - 不要在代码中硬编码 Token
   - 使用环境变量或密钥管理服务
   - 定期轮换 Token

2. **网络安全**
   - 使用 HTTPS
   - 考虑 IP 白名单限制

3. **权限控制**
   - Cron 脚本使用最小权限用户运行
   - 日志文件设置适当权限

## 监控告警

建议配置以下监控：

1. **Cron 执行状态**
   - 监控日志中的错误关键字
   - 设置执行失败告警

2. **API 响应时间**
   - 监控 API 响应延迟
   - 设置超时告警

3. **周刊状态**
   - 监控空周刊数量
   - 设置内容数量异常告警

---

*最后更新: 2026-01-31*
