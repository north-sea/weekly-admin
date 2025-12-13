# Quail 订阅发布功能规划

## 1. 功能概述

### 1.1 背景
Weekly Admin 需要集成 Quail 平台，实现周刊内容的自动发布和订阅管理。Quail 是一个 Newsletter 发布平台，支持通过 API 发布文章。

### 1.2 功能范围
- **Quail 发布服务**：将周刊内容发布到 Quail 平台
- **自动发布机制**：周刊状态变为 `published` 时自动触发 Quail 发布
- **发布历史查询**：从 Quail 平台获取已发布文章列表
- **发布状态检查**：检查周刊是否已在 Quail 发布
- **管理界面**：提供手动发布和历史查看功能

### 1.3 设计决策
1. 不需要额外的鉴权处理（复用现有 Admin 鉴权）
2. 发布历史优先使用 Quail 平台记录
3. Quail 发布失败不影响主流程，仅记录日志
4. 支持手动重试发布

---

## 2. 技术方案

### 2.1 Quail API 集成

#### 2.1.1 环境变量配置
```bash
# .env
QUAIL_API_HOST="https://api.quail.ink"
QUAIL_API_KEY="your_quail_api_key"
QUAIL_LIST_ID="your_newsletter_list_id"  # Newsletter 列表 ID
```

#### 2.1.2 Quail API 客户端 (`src/lib/services/quail-api.ts`)

参考 Karakeep API 客户端设计模式：

```typescript
/**
 * Quail API 客户端服务
 * 用于发布周刊到 Quail Newsletter 平台
 *
 * API 文档: https://docs.quail.ink/api
 */

import ky, { HTTPError } from 'ky';

// 环境变量配置
const QUAIL_API_HOST = process.env.QUAIL_API_HOST || 'https://api.quail.ink';
const QUAIL_API_KEY = process.env.QUAIL_API_KEY || '';
const QUAIL_LIST_ID = process.env.QUAIL_LIST_ID || '';

// Quail 文章数据类型
export interface QuailPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  cover_image?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published';
}

// 创建文章请求
export interface CreatePostRequest {
  title: string;
  slug: string;
  content: string;
  summary?: string;
  cover_image?: string;
  publish?: boolean;  // 是否立即发布
}

// API 响应类型
export interface QuailResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// 分页响应
export interface QuailPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// 错误类型
export class QuailApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'QuailApiError';
  }
}

/**
 * Quail API 客户端类
 */
export class QuailApiClient {
  private kyInstance: typeof ky;

  constructor() {
    if (!QUAIL_API_KEY) {
      throw new Error('QUAIL_API_KEY 环境变量未配置');
    }
    if (!QUAIL_LIST_ID) {
      console.warn('QUAIL_LIST_ID 环境变量未配置');
    }

    this.kyInstance = ky.create({
      prefixUrl: QUAIL_API_HOST,
      timeout: 30000,
      retry: {
        limit: 2,
        methods: ['get'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            request.headers.set('Authorization', `Bearer ${QUAIL_API_KEY}`);
            request.headers.set('Content-Type', 'application/json');
          }
        ],
      }
    });
  }

  /**
   * 发布文章到 Quail
   */
  async publishPost(data: CreatePostRequest): Promise<QuailPost>;

  /**
   * 获取发布历史
   */
  async getPublishHistory(options?: { page?: number; pageSize?: number }): Promise<QuailPaginatedResponse<QuailPost>>;

  /**
   * 检查文章是否已发布（通过 slug 或 title）
   */
  async checkPublishStatus(slug: string): Promise<QuailPost | null>;

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean>;
}
```

### 2.2 数据库变更

#### 2.2.1 weekly_issues 表新增字段

```sql
ALTER TABLE weekly_issues ADD COLUMN quail_post_id VARCHAR(100) NULL COMMENT 'Quail 平台文章 ID';
ALTER TABLE weekly_issues ADD COLUMN quail_published_at TIMESTAMP NULL COMMENT 'Quail 发布时间';
ALTER TABLE weekly_issues ADD COLUMN quail_publish_error TEXT NULL COMMENT 'Quail 发布错误信息';
```

#### 2.2.2 Prisma Schema 更新

```prisma
model weekly_issues {
  // ... 现有字段
  quail_post_id       String?   @db.VarChar(100)
  quail_published_at  DateTime? @db.Timestamp(0)
  quail_publish_error String?   @db.Text
}
```

### 2.3 服务层设计

#### 2.3.1 Quail 发布服务 (`src/lib/services/quail.ts`)

```typescript
import { quailApi } from './quail-api';
import { prisma } from '@/lib/db';

export class QuailService {
  /**
   * 发布周刊到 Quail
   * @param issueId 周刊 ID
   * @param options 发布选项
   */
  async publishWeekly(issueId: number, options?: {
    forceRepublish?: boolean;
  }): Promise<{
    success: boolean;
    quailPostId?: string;
    error?: string;
  }>;

  /**
   * 获取 Quail 发布历史
   */
  async getPublishHistory(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<{
    posts: QuailPost[];
    total: number;
  }>;

  /**
   * 检查周刊是否已在 Quail 发布
   */
  async checkPublishStatus(issueId: number): Promise<{
    published: boolean;
    quailPostId?: string;
    publishedAt?: Date;
  }>;

  /**
   * 生成周刊的 Quail 发布内容
   * 将周刊内容转换为 Quail 支持的格式
   */
  private async generateQuailContent(issueId: number): Promise<CreatePostRequest>;
}

export const quailService = new QuailService();
```

### 2.4 API 路由设计

#### 2.4.1 发布 API (`src/app/api/quail/publish/route.ts`)

```typescript
// POST /api/quail/publish
// 手动发布周刊到 Quail
{
  issueId: number;
  forceRepublish?: boolean;
}

// Response
{
  success: boolean;
  data?: {
    quailPostId: string;
    publishedAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

#### 2.4.2 发布历史 API (`src/app/api/quail/history/route.ts`)

```typescript
// GET /api/quail/history?page=1&pageSize=10
// 获取 Quail 发布历史

// Response
{
  success: boolean;
  data: {
    posts: QuailPost[];
    total: number;
    page: number;
    pageSize: number;
  };
}
```

#### 2.4.3 发布状态 API (`src/app/api/quail/status/[issueId]/route.ts`)

```typescript
// GET /api/quail/status/:issueId
// 检查周刊的 Quail 发布状态

// Response
{
  success: boolean;
  data: {
    published: boolean;
    quailPostId?: string;
    publishedAt?: string;
    error?: string;
  };
}
```

### 2.5 自动发布集成

修改 `src/app/api/weekly/[id]/route.ts` 的 PUT 方法：

```typescript
// 在周刊状态变为 published 时自动触发 Quail 发布
if (data.status === 'published') {
  updateData.published_at = new Date();

  // 异步触发 Quail 发布（不阻塞主流程）
  quailService.publishWeekly(id).catch((error) => {
    console.error('Quail 自动发布失败:', error);
    // 记录错误到数据库
    prisma.weekly_issues.update({
      where: { id },
      data: { quail_publish_error: error.message }
    });
  });
}
```

### 2.6 前端页面设计

#### 2.6.1 发布管理页面 (`src/app/(dashboard)/publish/page.tsx`)

**页面结构**：
1. **待发布周刊列表**：显示已发布但未同步到 Quail 的周刊
2. **发布历史**：从 Quail 获取的已发布文章列表
3. **手动发布操作**：选择周刊 → 发布按钮 → 状态显示

**UI 组件**：
- 周刊选择器（下拉或表格）
- 发布按钮（带 loading 状态）
- 发布状态标签（已发布/未发布/发布失败）
- 发布历史表格

#### 2.6.2 周刊编辑器集成

在周刊编辑器页面添加 Quail 发布状态显示：
- 显示是否已发布到 Quail
- 提供手动发布/重新发布按钮
- 显示发布错误信息（如有）

---

## 3. 实施步骤

### 阶段 1：基础设施（优先级：高）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 1.1 | 创建 Quail API 客户端 | `src/lib/services/quail-api.ts` |
| 1.2 | 添加环境变量配置 | `.env.example`, `docker/env.example` |
| 1.3 | 更新数据库 Schema | `prisma/schema.prisma` |
| 1.4 | 执行数据库迁移 | `pnpm db:push` 或 SQL |

### 阶段 2：服务层（优先级：高）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 2.1 | 创建 Quail 发布服务 | `src/lib/services/quail.ts` |
| 2.2 | 实现内容格式转换 | `src/lib/services/quail.ts` |
| 2.3 | 添加错误处理和日志 | `src/lib/services/quail.ts` |

### 阶段 3：API 路由（优先级：高）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 3.1 | 创建发布 API | `src/app/api/quail/publish/route.ts` |
| 3.2 | 创建历史 API | `src/app/api/quail/history/route.ts` |
| 3.3 | 创建状态 API | `src/app/api/quail/status/[issueId]/route.ts` |
| 3.4 | 集成自动发布到周刊 API | `src/app/api/weekly/[id]/route.ts` |

### 阶段 4：前端页面（优先级：中）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 4.1 | 创建发布管理页面 | `src/app/(dashboard)/publish/page.tsx` |
| 4.2 | 添加 React Query Hooks | `src/hooks/queries/useQuailQueries.ts` |
| 4.3 | 周刊编辑器集成 | `src/app/(dashboard)/weekly/editor/[id]/page.tsx` |
| 4.4 | 添加侧边栏导航 | `src/components/layout/sidebar.tsx` |

### 阶段 5：测试与优化（优先级：中）

| 步骤 | 任务 |
|------|------|
| 5.1 | API 连接测试 |
| 5.2 | 发布流程测试 |
| 5.3 | 错误处理测试 |
| 5.4 | 类型检查 (`pnpm type-check`) |

---

## 4. 验收标准

### 4.1 功能验收

- [ ] 可以手动将周刊发布到 Quail
- [ ] 周刊发布时自动触发 Quail 发布
- [ ] 可以查看 Quail 发布历史
- [ ] 可以检查周刊的 Quail 发布状态
- [ ] Quail 发布失败不影响周刊主流程
- [ ] 发布失败时记录错误信息
- [ ] 支持重新发布已发布的周刊

### 4.2 技术验收

- [ ] 通过 `pnpm type-check` 类型检查
- [ ] 通过 `pnpm lint` 代码检查
- [ ] API 错误有完整的错误处理
- [ ] 环境变量配置文档完整
- [ ] 代码遵循现有项目规范

### 4.3 用户体验验收

- [ ] 发布操作有 loading 状态反馈
- [ ] 发布成功/失败有明确提示
- [ ] 发布历史可分页查看
- [ ] 发布状态在周刊编辑器中可见

---

## 5. 风险与注意事项

1. **Quail API 限流**：需要处理 429 错误，实现重试机制
2. **内容格式兼容**：周刊内容需要转换为 Quail 支持的格式
3. **网络超时**：Quail API 调用可能超时，需要合理设置超时时间
4. **数据一致性**：Quail 发布状态与本地数据库需要保持同步
5. **API Key 安全**：确保 API Key 不会泄露到前端

---

## 6. 参考资料

- [Quail API 文档](https://docs.quail.ink/api)
- 现有 Karakeep API 集成：`src/lib/services/karakeep-api.ts`
- 周刊 API：`src/app/api/weekly/`
