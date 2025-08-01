# 设计文档

## 概述

此设计概述了周刊内容管理系统的 Docker 部署优化。解决方案将 Next.js 应用程序容器化，外部化图片上传服务的配置，并提供全面的部署文档。系统将与运行在同一服务器上的现有 MySQL 数据库和 Meilisearch 容器集成。

## 架构

### 容器架构

```mermaid
graph TB
    subgraph "Docker 主机服务器"
        subgraph "应用程序栈"
            APP[Next.js 应用容器]
            DB[(MySQL 容器)]
            SEARCH[Meilisearch 容器]
        end
        
        subgraph "外部服务"
            IMG[图片上传服务<br/>img.mengpeng.tech]
        end
        
        subgraph "存储"
            ENV[环境文件]
            DATA[数据库卷]
            SEARCH_DATA[搜索索引卷]
        end
    end
    
    APP --> DB
    APP --> SEARCH
    APP --> IMG
    ENV --> APP
    DATA --> DB
    SEARCH_DATA --> SEARCH
```

### 网络架构

- **内部 Docker 网络**: 所有容器通过自定义 Docker 网络通信
- **外部访问**: 只有 Next.js 应用程序向主机暴露端口
- **服务发现**: 容器通过服务名称相互引用
- **卷挂载**: 持久数据存储在 Docker 卷中

## 组件和接口

### 1. Docker 配置

#### Dockerfile
- **基础镜像**: Node.js 18 Alpine，优化大小和安全性
- **多阶段构建**: 分离构建和运行时阶段
- **依赖项**: 在最终阶段仅安装生产依赖项
- **用户**: 以非 root 用户运行以确保安全
- **健康检查**: 实现健康检查端点

#### Docker Compose
- **服务**: 定义应用程序、数据库和搜索服务
- **网络**: 为服务通信创建隔离网络
- **卷**: 数据库和搜索数据的持久存储
- **环境**: 从 .env 文件加载环境变量
- **依赖关系**: 确保正确的启动顺序

### 2. 环境配置

#### 环境变量结构
```bash
# 应用程序
NODE_ENV=production
PORT=3000

# 数据库 (MySQL 容器)
DATABASE_URL=mysql://user:password@mysql:3306/database
DB_HOST=mysql
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=secure_password
DB_NAME=content_management

# 搜索 (Meilisearch 容器)
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_MASTER_KEY=secure_search_key

# 图片上传服务
IMAGE_UPLOAD_URL=https://img.mengpeng.tech/api/v1/upload
IMAGE_UPLOAD_TOKEN=your_secure_token

# JWT 配置
JWT_SECRET=your_super_secure_jwt_secret
JWT_EXPIRES_IN=8h
```

#### 配置验证
- **启动验证**: 在启动时检查所有必需的环境变量
- **连接测试**: 验证数据库和搜索服务连接
- **优雅降级**: 处理缺失的可选配置

### 3. Image Upload Service Refactoring

#### Current Implementation Issues
- Hardcoded URL and token in source code
- No environment-based configuration
- No fallback mechanisms

#### New Implementation
```typescript
export class ImageUploadService {
  private static readonly UPLOAD_URL = process.env.IMAGE_UPLOAD_URL;
  private static readonly AUTH_TOKEN = process.env.IMAGE_UPLOAD_TOKEN;
  
  static validateConfig(): void {
    if (!this.UPLOAD_URL || !this.AUTH_TOKEN) {
      throw new Error('Image upload service not configured');
    }
  }
}
```

### 4. Database Integration

#### Connection Strategy
- **Container Communication**: Use Docker service names for host resolution
- **Connection Pooling**: Configure appropriate pool sizes for containerized environment
- **Health Checks**: Implement database connectivity checks
- **Migration Strategy**: Handle database migrations in containerized environment

#### Prisma Configuration
- **Database URL**: Use environment variable with container service name
- **Connection Limits**: Configure for container resource constraints
- **SSL Configuration**: Disable SSL for internal container communication

### 5. Search Service Integration

#### Meilisearch Configuration
- **Service Discovery**: Connect using Docker service name
- **Index Management**: Ensure indexes are created on startup
- **Data Persistence**: Use Docker volumes for search data
- **Health Monitoring**: Implement search service health checks

## Data Models

### Docker Compose Configuration Model
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mysql
      - meilisearch
    networks:
      - app-network
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-network
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:latest
    environment:
      MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY}
    volumes:
      - meilisearch_data:/meili_data
    networks:
      - app-network
    restart: unless-stopped

volumes:
  mysql_data:
  meilisearch_data:

networks:
  app-network:
    driver: bridge
```

### Environment Configuration Model
```typescript
interface EnvironmentConfig {
  // Application
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  
  // Database
  databaseUrl: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  
  // Search
  meilisearchHost: string;
  meilisearchMasterKey: string;
  
  // Image Upload
  imageUploadUrl: string;
  imageUploadToken: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
}
```

## Error Handling

### Configuration Errors
- **Missing Environment Variables**: Fail fast with clear error messages
- **Invalid Configuration Values**: Validate format and ranges
- **Service Connectivity**: Retry logic with exponential backoff
- **Startup Failures**: Log detailed error information for debugging

### Runtime Errors
- **Database Connection Loss**: Implement reconnection logic
- **Search Service Unavailable**: Graceful degradation of search features
- **Image Upload Failures**: Fallback to local storage or error handling
- **Container Resource Limits**: Monitor and alert on resource usage

### Monitoring and Logging
- **Health Check Endpoints**: Implement comprehensive health checks
- **Structured Logging**: Use JSON format for container log aggregation
- **Error Tracking**: Implement error reporting and alerting
- **Performance Metrics**: Monitor container performance and resource usage

## Testing Strategy

### Unit Testing
- **Environment Configuration**: Test configuration loading and validation
- **Service Connections**: Mock external services for unit tests
- **Image Upload Service**: Test with mocked HTTP requests
- **Error Handling**: Test error scenarios and edge cases

### Integration Testing
- **Database Integration**: Test with containerized test database
- **Search Integration**: Test with containerized Meilisearch instance
- **End-to-End Workflows**: Test complete user workflows in containerized environment
- **Configuration Testing**: Test different environment configurations

### Container Testing
- **Image Building**: Automated testing of Docker image builds
- **Container Startup**: Test container startup and health checks
- **Service Communication**: Test inter-container communication
- **Volume Persistence**: Test data persistence across container restarts

### Deployment Testing
- **Local Deployment**: Test complete stack deployment locally
- **Production Simulation**: Test with production-like configurations
- **Rollback Testing**: Test deployment rollback procedures
- **Performance Testing**: Load testing in containerized environment

## Security Considerations

### Container Security
- **Non-root User**: Run application as non-privileged user
- **Minimal Base Image**: Use Alpine Linux for reduced attack surface
- **Security Updates**: Regular base image updates
- **Secret Management**: Secure handling of environment variables

### Network Security
- **Internal Networks**: Isolate containers in private networks
- **Port Exposure**: Minimize exposed ports
- **SSL/TLS**: Use HTTPS for external communications
- **Firewall Rules**: Configure host firewall appropriately

### Data Security
- **Environment Variables**: Secure storage of sensitive configuration
- **Database Security**: Strong passwords and access controls
- **Image Upload**: Validate and sanitize uploaded content
- **Audit Logging**: Comprehensive logging of security events