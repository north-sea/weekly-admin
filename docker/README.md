# 🚀 生产环境部署文件

⚠️ **重要说明：本目录的Docker配置仅用于生产环境部署！**

**本地开发不需要Docker，请直接使用 `pnpm dev` 启动开发服务器。**

本目录包含了Weekly内容管理系统在NAS服务器上的生产部署配置文件。

## 文件说明

### 核心文件
- **Dockerfile**: 应用镜像构建配置
- **docker-compose.yml**: 开发环境完整服务编排（外部服务模式）
- **docker-compose.prod.yml**: 生产环境精简配置
- **.dockerignore**: Docker构建忽略文件配置
- **healthcheck.js**: 容器健康检查脚本

## 使用方法

### 1. 构建Docker镜像

**带数据库连接参数（推荐）：**
```bash
docker build -f docker/Dockerfile --build-arg DATABASE_URL="mysql://user:password@host:port/database" -t weekly-admin .
```

**默认构建：**
```bash
docker build -f docker/Dockerfile -t weekly-admin .
```

### 2. 使用Docker Compose

**开发环境（连接外部MySQL和Meilisearch）：**
```bash
docker compose -f docker/docker-compose.yml up -d
```

**生产环境：**
```bash
docker compose -f docker/docker-compose.prod.yml up -d
```

### 3. 直接运行容器

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://user:password@host:port/database" \
  --name weekly-admin \
  weekly-admin
```

## 环境要求

### 外部服务
系统依赖以下外部服务，请确保它们正常运行：

1. **MySQL数据库** 
   - 主机：100.113.231.101（NAS服务器）
   - 数据库：weekly_blog
   - 用户：weekly_user

2. **Meilisearch搜索引擎**
   - 容器：karakeep-meilisearch
   - 端口：7700

### 环境变量配置

**创建.env文件：**
```bash
# 复制Docker部署配置模板
cp docker/env.example .env

# 编辑配置
vim .env
```

**必需的环境变量：**
```env
# 数据库连接
DATABASE_URL="mysql://weekly_user:password@100.113.231.101:3306/weekly_blog"

# 搜索引擎 (推荐使用容器名连接)
MEILISEARCH_HOST="http://karakeep-meilisearch:7700"  
MEILISEARCH_MASTER_KEY="your_master_key"

# JWT认证
JWT_SECRET="production-super-secret-jwt-key"
JWT_EXPIRES_IN="8h"

# Docker部署配置
DOCKER_REGISTRY=""  # 留空使用本地镜像
APP_VERSION="latest"
APP_PORT="3000"
NODE_ENV="production"
```

**📋 详细的环境变量说明请查看：`docker/env.example`**

## 配置说明

### docker-compose.yml vs docker-compose.prod.yml

| 特性 | docker-compose.yml | docker-compose.prod.yml |
|------|-------------------|-------------------------|
| 适用环境 | 开发/测试 | 生产环境 |
| 服务定义 | 仅应用服务（MySQL/Meilisearch已注释） | 仅应用服务 |
| 网络配置 | 自定义网络 | 外部网络 |
| 依赖管理 | 无服务依赖 | 无服务依赖 |

### 健康检查

容器启动后会自动进行健康检查：
- 检查间隔：30秒
- 超时时间：3秒
- 重试次数：3次
- 启动延迟：5秒

检查endpoint：`http://localhost:3000/api/health`

## 故障排除

### 常见问题

1. **构建失败：PrismaClientConstructorValidationError**
   - 确保构建时传入了有效的DATABASE_URL参数
   - 检查数据库连接字符串格式

2. **容器无法连接数据库**
   - 检查`.env`文件中的DATABASE_URL配置
   - 确认MySQL服务器可访问性

3. **搜索功能异常**
   - 检查Meilisearch容器状态
   - 验证MEILISEARCH_HOST和MEILISEARCH_MASTER_KEY配置

### 日志查看

```bash
# 查看应用日志
docker compose -f docker/docker-compose.yml logs -f app

# 查看容器状态
docker ps
```