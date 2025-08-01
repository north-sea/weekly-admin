# Docker 部署指南

## 概述

本指南介绍如何将周刊内容管理系统部署到 Docker 环境中，支持连接现有的 MySQL 和 Meilisearch 容器。

## 部署架构

```
开发环境 (本地)
├── npm run dev (开发)
└── ./scripts/build-and-push.sh (构建和推送)

生产环境 (NAS)
├── docker-compose.yml
├── .env
└── ./scripts/deploy-update.sh (更新)
```

## 开发流程

### 1. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 2. 构建和推送镜像

开发完成后，使用构建脚本：

```bash
# 构建并推送最新版本
./scripts/build-and-push.sh

# 构建并推送指定版本
./scripts/build-and-push.sh v1.2.3
```

## NAS 服务器部署

### 初始部署

1. **准备文件**
   
   在 NAS 服务器上创建项目目录，只需要这两个文件：
   ```
   /path/to/weekly-admin/
   ├── docker-compose.yml
   ├── .env
   └── scripts/deploy-update.sh (可选，用于更新)
   ```

2. **配置环境变量**
   
   复制并修改 `.env` 文件：
   ```bash
   # 数据库配置 (连接现有 MySQL 容器)
   DB_HOST=mysql_container_name_or_ip
   DB_PORT=3306
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_NAME=your_database_name
   DATABASE_URL="mysql://username:password@mysql_container_name:3306/database_name"
   
   # Meilisearch 配置 (连接现有 Meilisearch 容器)
   MEILISEARCH_HOST="http://meilisearch_container_name:7700"
   MEILISEARCH_MASTER_KEY="your-meilisearch-master-key"
   
   # 图片上传服务
   IMAGE_UPLOAD_URL="https://img.mengpeng.tech/api/v1/upload"
   IMAGE_UPLOAD_TOKEN="your-image-upload-token"
   
   # JWT 配置
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRES_IN="8h"
   
   # Docker 配置
   APP_VERSION=latest
   APP_PORT=3000
   NODE_ENV=production
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

### 版本更新

有三种更新方式：

#### 方式 1: 自动拉取最新版本
```bash
# 拉取最新镜像并重启
docker-compose pull app
docker-compose up -d app
```

#### 方式 2: 使用更新脚本
```bash
./scripts/deploy-update.sh
```

#### 方式 3: 指定版本更新
```bash
# 修改 .env 文件中的 APP_VERSION
echo "APP_VERSION=v1.2.3" >> .env

# 重启服务
docker-compose up -d app
```

## Docker Compose 配置说明

### 完整配置 (docker-compose.yml)
适用于全新部署，包含 MySQL 和 Meilisearch：

```yaml
version: '3.8'
services:
  app:
    image: weekly-content-management:latest
    ports:
      - "3000:3000"
    # ... 其他配置
  mysql:
    image: mysql:8.0
    # ... MySQL 配置
  meilisearch:
    image: getmeili/meilisearch:latest
    # ... Meilisearch 配置
```

### 生产配置 (docker-compose.prod.yml)
适用于连接现有容器：

```yaml
version: '3.8'
services:
  app:
    image: weekly-content-management:latest
    ports:
      - "3000:3000"
    networks:
      - existing-network
networks:
  existing-network:
    external: true
```

## 连接现有容器

### 情况 1: 容器在同一 Docker 网络中

如果你的 MySQL 和 Meilisearch 容器已经在运行，并且在同一个 Docker 网络中：

1. 找到现有网络名称：
   ```bash
   docker network ls
   ```

2. 更新 `.env` 文件：
   ```bash
   EXISTING_NETWORK_NAME=your_existing_network_name
   ```

3. 使用生产配置启动：
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### 情况 2: 容器使用默认网络

如果现有容器使用默认 bridge 网络：

1. 在 `.env` 中设置容器名称或 IP：
   ```bash
   DB_HOST=mysql_container_name
   MEILISEARCH_HOST=http://meilisearch_container_name:7700
   ```

2. 启动应用：
   ```bash
   docker-compose up -d app
   ```

## 健康检查和监控

应用程序包含健康检查端点：

```bash
# 检查应用状态
curl http://localhost:3000/api/health

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DB_HOST` 是否正确
   - 确认 MySQL 容器正在运行
   - 验证网络连接

2. **Meilisearch 连接失败**
   - 检查 `MEILISEARCH_HOST` 配置
   - 确认 Meilisearch 容器正在运行
   - 验证 master key 是否正确

3. **镜像拉取失败**
   - 检查镜像名称和版本
   - 确认 Docker registry 访问权限

### 日志查看

```bash
# 查看应用日志
docker-compose logs app

# 实时查看日志
docker-compose logs -f app

# 查看特定时间的日志
docker-compose logs --since="2024-01-01T00:00:00" app
```

## 安全建议

1. **环境变量安全**
   - 使用强密码
   - 定期更换 JWT secret
   - 限制 `.env` 文件权限

2. **网络安全**
   - 使用内部网络通信
   - 只暴露必要端口
   - 配置防火墙规则

3. **镜像安全**
   - 定期更新基础镜像
   - 扫描安全漏洞
   - 使用非 root 用户运行