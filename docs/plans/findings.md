# Findings: Docker CI/CD 部署优化

**Task**: Docker CI/CD 部署优化
**Created**: 2026-01-31

---

## Current State Analysis

### Dockerfile (`docker/Dockerfile`)

**问题发现**:
1. pnpm 在 3 个阶段重复安装（deps、builder、runner）
2. `COPY . .` 在依赖安装后执行，任何源码变动都会破坏缓存
3. runner 阶段安装了 pnpm，但 standalone 模式不需要

**当前结构**:
```
base → deps (pnpm install) → builder (pnpm install) → runner (pnpm install)
```

**优化后结构**:
```
base (corepack) → deps → builder → runner (无 pnpm)
```

### GitHub Actions (`deploy.yml`)

**问题发现**:
1. 未使用 pnpm/action-setup，缺少 pnpm store 缓存
2. 未指定 platforms，可能触发多平台构建
3. 默认启用 provenance 和 sbom，增加镜像层数

**已有优化**:
- 已启用 BuildKit 缓存 (`cache-from: type=gha`)
- 已使用 docker/build-push-action@v5

### NAS 部署流程

**问题发现**:
1. 部署顺序：stop → rm → pull → run（停机时间 = pull + 启动）
2. 无回滚机制
3. 无部署通知

**优化方向**:
- 调整为：pull → stop → rm → run（停机时间 = 仅启动）
- 添加旧镜像记录和回滚逻辑
- 添加企业微信 Webhook 通知

### .dockerignore

**问题发现**:
- 文件位于 `docker/.dockerignore`
- GitHub Actions 构建上下文是项目根目录 (`context: .`)
- 因此 `.dockerignore` 未生效

**解决方案**:
- 移动到项目根目录 `.dockerignore`

---

## Technical Decisions

### Decision 1: pnpm 安装方式

**选项**:
- A: `npm install -g pnpm`（当前方式）
- B: `corepack enable && corepack prepare pnpm@latest --activate`

**决定**: 选项 B

**理由**:
- Node 20 内置 corepack
- 版本与 package.json 中的 `packageManager` 字段一致
- 更快、更标准

### Decision 2: 回滚策略

**选项**:
- A: 手动回滚
- B: 自动回滚到上一版本
- C: 自动回滚 + 通知

**决定**: 选项 C

**理由**:
- 用户明确要求自动回滚 + 企业微信通知
- 降低人工干预成本

### Decision 3: 通知渠道

**选项**:
- A: GitHub 邮件通知
- B: Slack/Discord
- C: 企业微信

**决定**: 选项 C

**理由**:
- 用户已有企业微信群机器人 Webhook
- 团队使用企业微信沟通

---

## Code Snippets

### Corepack 安装 pnpm

```dockerfile
# 替代 npm install -g pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
```

### 优化后的 COPY 顺序

```dockerfile
# deps 阶段
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# builder 阶段
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm prisma generate
COPY . .
RUN pnpm build:production
```

### 企业微信通知函数

```bash
send_wecom_notification() {
  local status=$1
  local message=$2
  local color=$3

  curl -s -X POST "$WECOM_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"msgtype\": \"markdown\",
      \"markdown\": {
        \"content\": \"### Weekly Admin 部署通知\n> 状态: <font color=\\\"$color\\\">$status</font>\n\n$message\"
      }
    }"
}
```

### 回滚逻辑

```bash
# 部署前记录旧镜像
OLD_IMAGE=$(docker inspect --format='{{.Image}}' weekly-admin 2>/dev/null || echo "")

# 健康检查失败时回滚
if [ -n "$OLD_IMAGE" ]; then
  echo "🔄 回滚到上一版本..."
  docker stop weekly-admin 2>/dev/null || true
  docker rm weekly-admin 2>/dev/null || true
  docker run -d --name weekly-admin ... $OLD_IMAGE
  send_wecom_notification "已回滚" "健康检查失败，已回滚到上一版本" "warning"
fi
```

---

## References

- [Docker BuildKit 缓存文档](https://docs.docker.com/build/cache/)
- [GitHub Actions 缓存](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [企业微信群机器人配置](https://developer.work.weixin.qq.com/document/path/91770)
- [pnpm/action-setup](https://github.com/pnpm/action-setup)
