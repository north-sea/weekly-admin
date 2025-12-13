# Quail Newsletter API 集成文档

> 本文档描述 Weekly Admin 项目中 Quail Newsletter 平台的 API 集成实现。

## 概述

Quail 是一个 Newsletter 发布平台，Weekly Admin 通过 Quail API 实现：
- 周刊自动发布到 Newsletter
- 邮件发送给订阅者
- 订阅者管理
- 发布历史查询

**官方文档**: https://docs.quaily.com/developer/

## 环境变量配置

```bash
# Quail Newsletter 配置
QUAIL_API_HOST="https://api.quail.ink"    # API 基础地址
QUAIL_API_KEY="your-quail-api-key"        # API 密钥
QUAIL_CHANNEL_SLUG="your-channel-slug"    # 频道 slug（用于 Post API）
QUAIL_LIST_ID="your-list-id"              # 列表 ID（用于 Subscription API）
```

### 获取配置值

1. **API Key**: 在 [Quail Dashboard](https://quail.ink) → Profile → API Keys 创建
2. **Channel Slug**: 你的频道 URL 中的 slug，如 `https://quail.ink/your-channel` 中的 `your-channel`
3. **List ID**: 在频道设置中获取

## API 端点

### 认证方式

所有 API 请求需要在 Header 中携带 API Key：

```
Authorization: Bearer <api_key>
```

### Post API（文章管理）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/lists/:channel_slug/posts` | 获取文章列表 |
| GET | `/lists/:channel_slug/posts/:post_id` | 获取单篇文章 |
| POST | `/lists/:channel_slug/posts` | 创建文章 |
| PUT | `/lists/:channel_slug/posts/:post_slug` | 更新文章 |
| DELETE | `/lists/:channel_slug/posts/:post_slug` | 删除文章 |
| PUT | `/lists/:channel_slug/posts/:post_slug/publish` | 发布文章（公开可见） |
| PUT | `/lists/:channel_slug/posts/:post_slug/unpublish` | 取消发布 |
| PUT | `/lists/:channel_slug/posts/:post_slug/deliver` | 发送邮件给订阅者 |
| GET | `/lists/:channel_slug/posts/:post_slug/content` | 获取文章内容 |

### Channel API（频道管理）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/lists/:channel_slug` | 获取频道信息 |
| GET | `/users/:user_id/lists` | 获取用户的频道列表 |

### Subscription API（订阅者管理）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/subscriptions/:list_id/members/:user_id/subs` | 获取成员订阅列表 |
| DELETE | `/subscriptions/:list_id/members/:user_id` | 删除成员 |
| PUT | `/subscriptions/:list_id/members/:user_id/email` | 更新邮件设置 |
| POST | `/subscriptions/:list_id/members/:user_id/transfer` | 转移成员 |
| POST | `/auxilia/subscriptions/:list_id/members/add` | 批量添加成员（Quaily+） |

## 项目实现

### 文件结构

```
src/
├── lib/services/
│   ├── quail-api.ts      # Quail API 客户端
│   └── quail.ts          # Quail 发布服务
├── app/api/quail/
│   ├── publish/route.ts  # 发布 API
│   ├── deliver/route.ts  # 发送邮件 API
│   ├── history/route.ts  # 发布历史 API
│   ├── channel/route.ts  # 频道信息 API
│   ├── status/[issueId]/route.ts  # 发布状态 API
│   └── subscribers/
│       ├── route.ts      # 添加订阅者
│       └── [userId]/route.ts  # 订阅者管理
├── hooks/queries/
│   └── useQuailQueries.ts  # React Query Hooks
└── app/(dashboard)/publish/
    └── page.tsx          # 发布管理页面
```

### 核心类型定义

```typescript
// 文章对象
interface QuailPost {
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

// 频道对象
interface QuailChannel {
  slug: string;
  title: string;
  description?: string;
  subscriber_count?: number;
  user: QuailUser;
}

// 订阅对象
interface QuailSubscription {
  type: 'free' | 'silver' | 'gold';
  paid_expiry?: string;
  email_enabled: boolean;
  user: QuailUser;
}
```

### 使用示例

#### 1. 发布周刊到 Quail

```typescript
import { quailService } from '@/lib/services/quail';

// 发布周刊
const result = await quailService.publishWeekly(issueId, {
  forceRepublish: false,  // 是否强制重新发布
  deliver: true,          // 是否同时发送邮件
});

if (result.success) {
  console.log('发布成功:', result.quailPostSlug);
} else {
  console.error('发布失败:', result.error);
}
```

#### 2. 发送邮件给订阅者

```typescript
// 仅发送邮件（文章已发布的情况）
const result = await quailService.deliverWeekly(issueId);
```

#### 3. 获取频道信息

```typescript
const channelInfo = await quailService.getChannelInfo();
console.log('订阅者数量:', channelInfo?.subscriberCount);
```

#### 4. 使用 React Query Hooks

```tsx
import {
  useQuailChannel,
  useQuailPublish,
  useQuailStatus,
} from '@/hooks/queries/useQuailQueries';

function PublishButton({ issueId }) {
  const { data: status } = useQuailStatus(issueId);
  const publishMutation = useQuailPublish();

  const handlePublish = async () => {
    await publishMutation.mutateAsync({
      issueId,
      deliver: true,
    });
  };

  return (
    <button
      onClick={handlePublish}
      disabled={publishMutation.isPending}
    >
      {status?.published ? '重新发布' : '发布'}
    </button>
  );
}
```

## 数据库字段

`weekly_issues` 表新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| quail_post_id | VARCHAR(100) | Quail 文章 ID |
| quail_post_slug | VARCHAR(200) | Quail 文章 slug |
| quail_published_at | TIMESTAMP | Quail 发布时间 |
| quail_delivered_at | TIMESTAMP | 邮件发送时间 |
| quail_publish_error | TEXT | 发布错误信息 |

## 自动发布机制

当周刊状态变为 `published` 时，系统会自动触发 Quail 发布：

```typescript
// src/app/api/weekly/[id]/route.ts
if (data.status === 'published' && isQuailConfigured()) {
  quailService.publishWeekly(id).catch((error) => {
    console.error('Quail 自动发布失败:', error);
  });
}
```

**注意**：
- 自动发布是异步的，不会阻塞主流程
- 发布失败会记录到数据库的 `quail_publish_error` 字段
- 可以在发布管理页面手动重试

## 订阅小组件

Quail 提供了订阅小组件，可以嵌入到前端页面：

```html
<!-- 在 Weekly 前端项目中使用 -->
<script
  async
  src="https://quail.ink/widget.js"
  data-channel="your-channel-slug"
></script>
```

详见：https://docs.quaily.com/developer/widget

## 错误处理

API 错误会抛出 `QuailApiError`：

```typescript
try {
  await quailApi.publishPost(slug);
} catch (error) {
  if (error instanceof QuailApiError) {
    console.error('状态码:', error.statusCode);
    console.error('错误信息:', error.message);
  }
}
```

常见错误码：
- `401` - API Key 无效
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求过于频繁

## 注意事项

1. **发布与发送分离**：`publish` 使文章公开可见，`deliver` 发送邮件给订阅者
2. **Quaily+ 限制**：批量添加订阅者需要 Quaily+ 付费计划
3. **API 限流**：注意处理 429 错误，实现重试机制
4. **内容格式**：周刊内容会自动转换为 Markdown 格式

## 参考链接

- [Quail 开发者文档](https://docs.quaily.com/developer/)
- [Quail API 文档 (GitHub)](https://github.com/quailyquaily/quaily-docs)
- [Quail 订阅小组件](https://docs.quaily.com/developer/widget)
