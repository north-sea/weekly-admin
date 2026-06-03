# NAS Docker 部署指南

本文档说明如何将 Weekly Admin 部署到飞牛 OS (fnOS) NAS 上。

## 部署架构

```
GitHub (push) → GitHub Actions (build) → GHCR (镜像) → NAS (pull & run)
```

## 前置要求

1. NAS 已安装 Docker
2. NAS 可通过 SSH 访问
3. GitHub 仓库已配置 Secrets

## 配置步骤

### 1. 配置 GitHub Secrets

在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `NAS_HOST` | NAS 的 IP 或域名 | `192.168.1.100` 或 `nas.example.com` |
| `NAS_USERNAME` | SSH 用户名 | `admin` |
| `NAS_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `NAS_SSH_PORT` | SSH 端口 (可选，默认 22) | `22` |
| `NAS_DEPLOY_DIR` | 部署目录 (可选) | `/volume1/docker/weekly-admin` |

### 2. 生成 SSH 密钥

```bash
# 在本地生成密钥对
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/nas_deploy

# 将公钥添加到 NAS
ssh-copy-id -i ~/.ssh/nas_deploy.pub admin@your-nas-ip

# 将私钥内容复制到 GitHub Secrets (NAS_SSH_KEY)
cat ~/.ssh/nas_deploy
```

### 3. 在 NAS 上创建部署目录

```bash
# SSH 登录到 NAS
ssh admin@your-nas-ip

# 创建部署目录
mkdir -p /volume1/docker/weekly-admin
cd /volume1/docker/weekly-admin

# 创建环境变量文件
cat > .env << 'EOF'
# 数据库配置
DATABASE_URL=mysql://user:password@host:3306/database

# Meilisearch 配置
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_MASTER_KEY=your-api-key
MEILISEARCH_CONTENT_INDEX=weekly_admin_contents
MEILISEARCH_SHARED_INSTANCE=false

# 认证配置
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://your-nas-ip:3000

# 其他配置
NODE_ENV=production
EOF

# 设置权限
chmod 600 .env
```

### 4. 创建 docker-compose.yml (可选)

如果需要更复杂的配置，可以创建 docker-compose.yml：

```yaml
version: '3.8'

services:
  weekly-admin:
    image: ghcr.io/your-username/weekly-admin:latest
    container_name: weekly-admin
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    networks:
      - weekly-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 60s
      timeout: 15s
      retries: 3
      start_period: 40s

networks:
  weekly-network:
    external: true
    name: your-existing-network  # 如果需要连接到其他容器
```

## 触发部署

### 自动部署

推送代码到 `main` 分支会自动触发部署：

```bash
git push origin main
```

### 手动部署

在 GitHub Actions 页面手动触发：

1. 进入 `Actions` 标签页
2. 选择 `Build and Deploy to NAS` workflow
3. 点击 `Run workflow`
4. 可选择 `deploy_only` 跳过构建，直接部署现有镜像

## 监控和日志

### 查看容器状态

```bash
# SSH 登录 NAS 后
docker ps | grep weekly-admin
docker logs -f weekly-admin
```

### 健康检查

```bash
curl http://localhost:3000/api/health
```

## 回滚

如果新版本有问题，可以回滚到之前的版本：

```bash
# 查看可用的镜像标签
docker images ghcr.io/your-username/weekly-admin

# 回滚到指定版本
docker stop weekly-admin
docker rm weekly-admin
docker run -d \
  --name weekly-admin \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  ghcr.io/your-username/weekly-admin:20260131-abc1234
```

## 使用 Watchtower 自动更新 (可选)

如果不想通过 SSH 部署，可以使用 Watchtower 自动拉取更新：

```yaml
# docker-compose.yml
version: '3.8'

services:
  weekly-admin:
    image: ghcr.io/your-username/weekly-admin:latest
    container_name: weekly-admin
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.docker/config.json:/config.json:ro  # GHCR 认证
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300  # 5分钟检查一次
      - WATCHTOWER_LABEL_ENABLE=true
    command: --interval 300
```

配置 GHCR 认证：

```bash
# 在 NAS 上登录 GHCR
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## 故障排查

### 1. SSH 连接失败

- 检查 NAS 防火墙设置
- 确认 SSH 服务已启用
- 验证密钥权限 (`chmod 600`)

### 2. 镜像拉取失败

- 检查 GHCR 认证是否正确
- 确认 NAS 可以访问外网
- 检查 GitHub Token 权限

### 3. 容器启动失败

```bash
# 查看详细日志
docker logs weekly-admin

# 检查环境变量
docker exec weekly-admin env

# 检查网络连接
docker exec weekly-admin curl -v http://database-host:3306
```

### 4. 健康检查失败

- 检查数据库连接
- 检查 Meilisearch 连接。Meilisearch 是 optional keyword search backend；它不可达时 `/api/health` 应显示 degraded 而不是因为 search 单项失败返回整体 503。
- 若复用 NAS 上已有的 Karakeep Meilisearch，必须使用 Admin 独立 index（例如 `weekly_admin_contents`），不要使用通用 `contents` 或 Karakeep 已有 index。NAS Docker 网络接入方式需单独确认。
- 查看应用日志

---

*最后更新: 2026-01-31*
