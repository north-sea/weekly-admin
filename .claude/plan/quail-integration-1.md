# Quail 订阅发布功能规划 (v2)

> 基于 Quail 官方 API 文档更新：https://docs.quaily.com/developer/

## 1. 功能概述

### 1.1 背景
Weekly Admin 需要集成 Quail 平台，实现周刊内容的自动发布和订阅管理。Quail 是一个 Newsletter 发布平台，支持通过 API 发布文章和管理订阅者。

### 1.2 功能范围

#### 核心功能
- **文章发布服务**：将周刊内容发布到 Quail 平台
- **自动发布机制**：周刊状态变为 `published` 时自动触发 Quail 发布
- **发布历史查询**：从 Quail 平台获取已发布文章列表
- **发布状态检查**：检查周刊是否已在 Quail 发布

#### 订阅者管理（新增）
- **订阅者列表**：查看频道订阅者
- **订阅者统计**：订阅者数量、类型分布
- **订阅者操作**：添加、删除、转移订阅者

### 1.3 设计决策
1. 不需要额外的鉴权处理（复用现有 Admin 鉴权）
2. 发布历史优先使用 Quail 平台记录
3. Quail 发布失败不影响主流程，仅记录日志
4. 支持手动重试发布
5. 订阅者管理为可选功能模块

---

## 2. Quail API 概览

### 2.1 认证方式
```
Authorization: Bearer <api_key>
```
API Key 通过 Quail Dashboard 的 profile/apikeys 页面创建。

### 2.2 API 基础地址
```
API_BASE: https://api.quail.ink (待确认)
```

### 2.3 核心 API 端点

#### Post API（文章管理）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/lists/:channel_slug/posts` | 获取文章列表（支持分页） |
| GET | `/lists/:channel_slug/posts/:post_id` | 获取单篇文章 |
| POST | `/lists/:channel_slug/posts` | 创建文章 |
| PUT | `/lists/:channel_slug/posts/:post_slug` | 更新文章 |
| DELETE | `/lists/:channel_slug/posts/:post_slug` | 删除文章 |
| PUT | `/lists/:channel_slug/posts/:post_slug/publish` | 发布文章 |
| PUT | `/lists/:channel_slug/posts/:post_slug/unpublish` | 取消发布 |
| PUT | `/lists/:channel_slug/posts/:post_slug/deliver` | 发送/分发文章 |
| GET | `/lists/:channel_slug/posts/:post_slug/content` | 获取文章内容 |

#### Subscription API（订阅者管理）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/subscriptions/:list_id/members/:user_id/subs` | 获取成员订阅列表 |
| POST | `/subscriptions/:list_id/members/:user_id/transfer` | 转移成员 |
| DELETE | `/subscriptions/:list_id/members/:user_id` | 删除成员 |
| PUT | `/subscriptions/:list_id/members/:user_id/email` | 更新邮件设置 |
| POST | `/auxilia/subscriptions/:list_id/members/add` | 批量添加成员（Quaily+） |

#### Channel API（频道管理）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/lists/:channel_slug` | 获取频道信息 |
| GET | `/users/:user_id/lists` | 获取用户的频道列表 |

### 2.4 响应对象

#### Post Object
```typescript
interface QuailPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  cover_image?: string;
  page_view_count: number;
  email_view_count: number;
  similar_post_items?: any[];
  created_at: string;
  updated_at: string;
}
```

#### Channel Object
```typescript
interface QuailChannel {
  slug: string;
  title: string;
  description?: string;
  // 订阅者信息
  subscriber_count?: number;
  // 用户信息
  user: QuailUser;
  created_at: string;
  updated_at: string;
}
```

#### Subscription Object
```typescript
interface QuailSubscription {
  type: 'free' | 'silver' | 'gold';  // 订阅类型
  paid_expiry?: string;  // 付费到期时间
  email_enabled: boolean;
  user: QuailUser;
  channel: QuailChannel;
  created_at: string;
  updated_at: string;
}
```

---

## 3. 技术方案

### 3.1 环境变量配置

```bash
# .env
QUAIL_API_HOST="https://api.quail.ink"
QUAIL_API_KEY="your_quail_api_key"
QUAIL_CHANNEL_SLUG="your_channel_slug"  # 频道 slug（用于 Post API）
QUAIL_LIST_ID="your_list_id"            # 列表 ID（用于 Subscription API）
```

### 3.2 Quail API 客户端 (`src/lib/services/quail-api.ts`)

```typescript
/**
 * Quail API 客户端服务
 * 用于发布周刊到 Quail Newsletter 平台
 *
 * API 文档: https://docs.quaily.com/developer/
 */

import ky, { HTTPError } from 'ky';

// 环境变量配置
const QUAIL_API_HOST = process.env.QUAIL_API_HOST || 'https://api.quail.ink';
const QUAIL_API_KEY = process.env.QUAIL_API_KEY || '';
const QUAIL_CHANNEL_SLUG = process.env.QUAIL_CHANNEL_SLUG || '';
const QUAIL_LIST_ID = process.env.QUAIL_LIST_ID || '';

// ============ 类型定义 ============

// 用户对象
export interface QuailUser {
  id: number;
  name: string;
  bio?: string;
  email?: string;
  social_ids?: Array<{ platform: string; value: string }>;
}

// 频道对象
export interface QuailChannel {
  slug: string;
  title: string;
  description?: string;
  user: QuailUser;
  created_at: string;
  updated_at: string;
}

// 文章对象
export interface QuailPost {
  id: string;
  slug: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image?: string;
  page_view_count: number;
  email_view_count: number;
  created_at: string;
  updated_at: string;
}

// 订阅对象
export interface QuailSubscription {
  type: 'free' | 'silver' | 'gold';
  paid_expiry?: string;
  email_enabled: boolean;
  user: QuailUser;
  channel: QuailChannel;
  created_at: string;
  updated_at: string;
}

// 创建文章请求
export interface CreatePostRequest {
  title: string;
  slug: string;
  content: string;
  summary?: string;
  cover_image?: string;
  tags?: string[];
  theme?: string;
  publish_at?: string;
}

// 添加成员请求
export interface AddMemberRequest {
  email: string;
  name?: string;
}

// API 响应类型
export interface QuailResponse<T> {
  data: T;
  ts: number;
}

// 分页响应
export interface QuailPaginatedResponse<T> {
  data: T[];
  ts: number;
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
        afterResponse: [
          async (_request, _options, response) => {
            if (!response.ok) {
              console.error('Quail API 错误:', {
                status: response.status,
                statusText: response.statusText,
              });
            }
            return response;
          }
        ],
      }
    });
  }

  // ============ Post API ============

  /**
   * 获取文章列表
   * GET /lists/:channel_slug/posts
   */
  async getPosts(options?: {
    page?: number;
    pageSize?: number;
    public?: boolean;
  }): Promise<QuailPaginatedResponse<QuailPost>>;

  /**
   * 获取单篇文章
   * GET /lists/:channel_slug/posts/:post_id
   */
  async getPost(postId: string): Promise<QuailResponse<QuailPost>>;

  /**
   * 创建文章
   * POST /lists/:channel_slug/posts
   */
  async createPost(data: CreatePostRequest): Promise<QuailResponse<QuailPost>>;

  /**
   * 更新文章
   * PUT /lists/:channel_slug/posts/:post_slug
   */
  async updatePost(postSlug: string, data: Partial<CreatePostRequest>): Promise<QuailResponse<QuailPost>>;

  /**
   * 删除文章
   * DELETE /lists/:channel_slug/posts/:post_slug
   */
  async deletePost(postSlug: string): Promise<void>;

  /**
   * 发布文章
   * PUT /lists/:channel_slug/posts/:post_slug/publish
   */
  async publishPost(postSlug: string): Promise<QuailResponse<QuailPost>>;

  /**
   * 取消发布
   * PUT /lists/:channel_slug/posts/:post_slug/unpublish
   */
  async unpublishPost(postSlug: string): Promise<QuailResponse<QuailPost>>;

  /**
   * 发送/分发文章（发送邮件给订阅者）
   * PUT /lists/:channel_slug/posts/:post_slug/deliver
   */
  async deliverPost(postSlug: string): Promise<QuailResponse<QuailPost>>;

  // ============ Channel API ============

  /**
   * 获取频道信息
   * GET /lists/:channel_slug
   */
  async getChannel(channelSlug?: string): Promise<QuailResponse<QuailChannel>>;

  // ============ Subscription API ============

  /**
   * 获取成员订阅列表
   * GET /subscriptions/:list_id/members/:user_id/subs
   */
  async getMemberSubscriptions(userId: number): Promise<QuailPaginatedResponse<QuailSubscription>>;

  /**
   * 删除成员
   * DELETE /subscriptions/:list_id/members/:user_id
   */
  async deleteMember(userId: number): Promise<void>;

  /**
   * 更新成员邮件设置
   * PUT /subscriptions/:list_id/members/:user_id/email
   */
  async updateMemberEmail(userId: number, enabled: boolean): Promise<void>;

  /**
   * 转移成员
   * POST /subscriptions/:list_id/members/:user_id/transfer
   */
  async transferMember(userId: number, targetListId: string): Promise<void>;

  /**
   * 批量添加成员（Quaily+ 计划）
   * POST /auxilia/subscriptions/:list_id/members/add
   */
  async addMembers(members: AddMemberRequest[]): Promise<void>;

  // ============ 工具方法 ============

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean>;
}

// 导出单例实例
export const quailApi = new QuailApiClient();
```

### 3.3 数据库变更

#### 3.3.1 weekly_issues 表新增字段

```sql
ALTER TABLE weekly_issues ADD COLUMN quail_post_id VARCHAR(100) NULL COMMENT 'Quail 平台文章 ID';
ALTER TABLE weekly_issues ADD COLUMN quail_post_slug VARCHAR(200) NULL COMMENT 'Quail 文章 slug';
ALTER TABLE weekly_issues ADD COLUMN quail_published_at TIMESTAMP NULL COMMENT 'Quail 发布时间';
ALTER TABLE weekly_issues ADD COLUMN quail_delivered_at TIMESTAMP NULL COMMENT 'Quail 邮件发送时间';
ALTER TABLE weekly_issues ADD COLUMN quail_publish_error TEXT NULL COMMENT 'Quail 发布错误信息';
```

#### 3.3.2 Prisma Schema 更新

```prisma
model weekly_issues {
  // ... 现有字段
  quail_post_id       String?   @db.VarChar(100)
  quail_post_slug     String?   @db.VarChar(200)
  quail_published_at  DateTime? @db.Timestamp(0)
  quail_delivered_at  DateTime? @db.Timestamp(0)
  quail_publish_error String?   @db.Text
}
```

### 3.4 服务层设计

#### 3.4.1 Quail 发布服务 (`src/lib/services/quail.ts`)

```typescript
import { quailApi, QuailPost, CreatePostRequest } from './quail-api';
import { prisma } from '@/lib/db';

export class QuailService {
  /**
   * 发布周刊到 Quail（完整流程：创建 → 发布 → 发送）
   */
  async publishWeekly(issueId: number, options?: {
    forceRepublish?: boolean;
    deliver?: boolean;  // 是否发送邮件给订阅者
  }): Promise<{
    success: boolean;
    quailPostId?: string;
    quailPostSlug?: string;
    error?: string;
  }>;

  /**
   * 仅发送邮件（文章已发布的情况）
   */
  async deliverWeekly(issueId: number): Promise<{
    success: boolean;
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
    delivered: boolean;
    quailPostId?: string;
    quailPostSlug?: string;
    publishedAt?: Date;
    deliveredAt?: Date;
    error?: string;
  }>;

  /**
   * 获取频道信息（包含订阅者统计）
   */
  async getChannelInfo(): Promise<{
    title: string;
    description?: string;
    subscriberCount?: number;
  }>;

  /**
   * 生成周刊的 Quail 发布内容
   */
  private async generateQuailContent(issueId: number): Promise<CreatePostRequest>;
}

export const quailService = new QuailService();
```

### 3.5 API 路由设计

#### 3.5.1 发布相关 API

```typescript
// POST /api/quail/publish
// 发布周刊到 Quail
Request: {
  issueId: number;
  forceRepublish?: boolean;
  deliver?: boolean;  // 是否同时发送邮件
}

// POST /api/quail/deliver
// 发送邮件给订阅者
Request: {
  issueId: number;
}

// GET /api/quail/history?page=1&pageSize=10
// 获取 Quail 发布历史

// GET /api/quail/status/:issueId
// 检查周刊的 Quail 发布状态
```

#### 3.5.2 频道信息 API

```typescript
// GET /api/quail/channel
// 获取频道信息（包含订阅者统计）
Response: {
  success: boolean;
  data: {
    title: string;
    description?: string;
    subscriberCount?: number;
  };
}
```

#### 3.5.3 订阅者管理 API（可选）

```typescript
// GET /api/quail/subscribers?page=1&pageSize=20
// 获取订阅者列表

// DELETE /api/quail/subscribers/:userId
// 删除订阅者

// PUT /api/quail/subscribers/:userId/email
// 更新订阅者邮件设置
Request: { enabled: boolean }

// POST /api/quail/subscribers/add
// 批量添加订阅者（Quaily+ 计划）
Request: { members: Array<{ email: string; name?: string }> }
```

### 3.6 前端页面设计

#### 3.6.1 发布管理页面 (`src/app/(dashboard)/publish/page.tsx`)

**页面结构**：
1. **频道概览卡片**：显示频道名称、订阅者数量
2. **待发布周刊列表**：显示已发布但未同步到 Quail 的周刊
3. **发布历史**：从 Quail 获取的已发布文章列表
4. **手动发布操作**：选择周刊 → 发布按钮 → 发送邮件按钮

**UI 组件**：
- 频道信息卡片（订阅者统计）
- 周刊选择器（下拉或表格）
- 发布按钮（带 loading 状态）
- 发送邮件按钮（独立操作）
- 发布状态标签（草稿/已发布/已发送）
- 发布历史表格

#### 3.6.2 订阅者管理页面（可选）(`src/app/(dashboard)/subscribers/page.tsx`)

**页面结构**：
1. **订阅者统计**：总数、类型分布（免费/付费）
2. **订阅者列表**：分页表格
3. **批量操作**：添加、删除

---

## 4. 实施步骤

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
| 3.2 | 创建发送邮件 API | `src/app/api/quail/deliver/route.ts` |
| 3.3 | 创建历史 API | `src/app/api/quail/history/route.ts` |
| 3.4 | 创建状态 API | `src/app/api/quail/status/[issueId]/route.ts` |
| 3.5 | 创建频道信息 API | `src/app/api/quail/channel/route.ts` |
| 3.6 | 集成自动发布到周刊 API | `src/app/api/weekly/[id]/route.ts` |

### 阶段 4：前端页面（优先级：中）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 4.1 | 创建发布管理页面 | `src/app/(dashboard)/publish/page.tsx` |
| 4.2 | 添加 React Query Hooks | `src/hooks/queries/useQuailQueries.ts` |
| 4.3 | 周刊编辑器集成 | `src/app/(dashboard)/weekly/editor/[id]/page.tsx` |
| 4.4 | 添加侧边栏导航 | `src/components/layout/sidebar.tsx` |

### 阶段 5：订阅者管理（优先级：低，可选）

| 步骤 | 任务 | 文件 |
|------|------|------|
| 5.1 | 创建订阅者 API | `src/app/api/quail/subscribers/route.ts` |
| 5.2 | 创建订阅者管理页面 | `src/app/(dashboard)/subscribers/page.tsx` |

### 阶段 6：测试与优化（优先级：中）

| 步骤 | 任务 |
|------|------|
| 6.1 | API 连接测试 |
| 6.2 | 发布流程测试 |
| 6.3 | 邮件发送测试 |
| 6.4 | 错误处理测试 |
| 6.5 | 类型检查 (`pnpm type-check`) |

---

## 5. 验收标准

### 5.1 功能验收

#### 发布功能
- [ ] 可以手动将周刊发布到 Quail
- [ ] 周刊发布时自动触发 Quail 发布
- [ ] 可以单独发送邮件给订阅者
- [ ] 可以查看 Quail 发布历史
- [ ] 可以检查周刊的 Quail 发布状态
- [ ] Quail 发布失败不影响周刊主流程
- [ ] 发布失败时记录错误信息
- [ ] 支持重新发布已发布的周刊

#### 订阅者管理（可选）
- [ ] 可以查看频道订阅者统计
- [ ] 可以查看订阅者列表
- [ ] 可以删除订阅者
- [ ] 可以批量添加订阅者（Quaily+）

### 5.2 技术验收

- [ ] 通过 `pnpm type-check` 类型检查
- [ ] 通过 `pnpm lint` 代码检查
- [ ] API 错误有完整的错误处理
- [ ] 环境变量配置文档完整
- [ ] 代码遵循现有项目规范

### 5.3 用户体验验收

- [ ] 发布操作有 loading 状态反馈
- [ ] 发布成功/失败有明确提示
- [ ] 发布历史可分页查看
- [ ] 发布状态在周刊编辑器中可见
- [ ] 频道订阅者统计可见

---

## 6. 风险与注意事项

1. **Quail API 限流**：需要处理 429 错误，实现重试机制
2. **内容格式兼容**：周刊内容需要转换为 Quail 支持的格式
3. **网络超时**：Quail API 调用可能超时，需要合理设置超时时间
4. **数据一致性**：Quail 发布状态与本地数据库需要保持同步
5. **API Key 安全**：确保 API Key 不会泄露到前端
6. **发布与发送分离**：`publish` 和 `deliver` 是两个独立操作
7. **Quaily+ 限制**：批量添加订阅者需要 Quaily+ 计划

---

## 7. 参考资料

- [Quail 开发者文档](https://docs.quaily.com/developer/)
- [Quail API 文档 (GitHub)](https://github.com/quailyquaily/quaily-docs)
- 现有 Karakeep API 集成：`src/lib/services/karakeep-api.ts`
- 周刊 API：`src/app/api/weekly/`

---

## 8. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1 | 2025-12-13 | 初始规划 |
| v2 | 2025-12-13 | 基于官方 API 文档更新，新增订阅者管理功能 |
