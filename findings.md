# AI 功能集成研究

## 2026-01-23 现状校验（与计划对齐）

- 本仓库目前的“迁移”主要通过 `scripts/migrate-db.ts` 使用 `prisma.$executeRaw/$queryRaw` 做幂等建表/加列，而不是 Prisma Migrate 的 `prisma/migrations/*`。
- `prisma/schema.prisma` 来自 `db pull` 风格，表模型使用 snake_case（例如 `contents`），且 `image_url` 字段已存在；计划中新增字段需按该命名体系补充（例如 `original_score`, `ai_metadata`, `image_source`）。
- 工作区存在较多未提交的改动与新增文件（目前集中在 tags/categories 相关），开始 AI 实施前建议先分支/提交/暂存，避免混入同一次改动。

## 项目对比分析

### admin 项目 vs weekly 项目

| 维度 | admin 项目 | weekly 项目 |
|------|-----------|------------|
| **框架** | Next.js 15 (App Router) | Astro 5.x |
| **数据库** | Prisma ORM + MySQL | mysql2 + MySQL |
| **用途** | 管理后台 | 前端展示 |
| **状态** | 成熟，功能完整 | 成熟，功能完整 |
| **AI 集成** | 待实现 | 待实现 |

### 数据共享方案

两个项目共享同一个 MySQL 数据库：

```
┌─────────────────┐    ┌─────────────────┐
│   admin 项目     │    │   weekly 项目    │
│   (Prisma ORM)  │    │   (mysql2)      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │   MySQL 数据库   │
          │   (共享 schema)  │
          └─────────────────┘
```

**注意事项**:
1. admin 项目使用 Prisma 迁移管理 schema
2. weekly 项目需要同步 schema 变更
3. 两个项目都可以读写同一个数据库

---

## 关键设计补充

### 1. 基于 Karakeep 的去重策略

**问题**: Karakeep 是用户的个人收藏服务，内容存储在 `drafts` 表中。需要确保从 RSS 等外部源抓取的内容不会与 Karakeep 已有的内容重复。

**解决方案**: 三层去重检查

```
新抓取的内容（URL）
    ↓
检查 1: drafts 表（Karakeep 同步）
    ↓ 不存在
检查 2: contents 表（已发布内容）
    ↓ 不存在
检查 3: URL 规范化对比
    ↓ 不重复
写入 contents 表
```

**关键实现**:
- URL 规范化：移除 www、尾部斜杠、跟踪参数
- 批量查询：一次查询检查所有 URL，减少数据库请求
- 相似度检查：可选的标题相似度检查（Levenshtein 距离）

**详细设计**: 参见 `deduplication-and-aggregator.md`

### 2. RSS 聚合内容处理

**问题**: 某些 RSS 源本身就是聚合平台（如 Hacker News、daily.dev），一个 RSS 条目包含多个子内容链接。

**解决方案**: 配置驱动 + 智能识别

**配置示例**:
```yaml
sources:
  - name: "Hacker News"
    url: "https://hnrss.org/frontpage"
    type: "aggregator"  # 标记为聚合源
    aggregator_config:
      extract_links: true
      max_links_per_item: 5
      exclude_domains: ["news.ycombinator.com"]
```

**处理流程**:
```
RSS 条目
    ↓
检测是否为聚合内容
    ↓ 是
提取所有子链接
    ↓
过滤和去重（包括 Karakeep）
    ↓
为每个子链接创建独立的 content
```

**智能识别**:
- 链接数量检测（> 5 个链接）
- 标题模式匹配（包含"周刊"、"weekly"等）
- 列表结构检测（多个 li 标签，每个都有链接）

**详细设计**: 参见 `deduplication-and-aggregator.md`

---

## AI 功能实现策略

### 方案对比

#### 方案 A: 在 admin 项目实现所有 AI 功能
**优点**:
- 集中管理，易于维护
- 利用 Next.js 的 API Routes
- 可以复用现有的认证和权限

**缺点**:
- weekly 项目无法直接使用 AI 功能
- 需要通过 API 调用

#### 方案 B: 在 weekly 项目实现 AI 功能
**优点**:
- weekly 项目可以直接使用
- 适合命令行脚本

**缺点**:
- admin 项目需要通过 API 调用
- 代码重复

#### 方案 C: 创建共享的 AI 库（推荐）
**优点**:
- 两个项目都可以使用
- 代码复用，易于维护
- 可以独立测试

**缺点**:
- 需要额外的包管理

### 最终方案：混合策略

1. **共享 AI 库**: 创建 `@weekly/ai-lib` 包
   - 包含 AI 客户端、评分器、生成器等核心逻辑
   - 两个项目都可以引用

2. **admin 项目**: 实现 UI 和 API
   - 提供 Web 界面操作
   - 提供 REST API 供外部调用

3. **weekly 项目**: 实现命令行脚本
   - 提供批量处理脚本
   - 提供定时任务

---

## 图片处理方案（补充）

### admin 项目的图片处理

admin 项目已有图片上传功能，需要集成：

1. **现有功能**:
   - 支持粘贴截图上传
   - 图片存储（可能是本地或 CDN）

2. **新增功能**:
   - 从 URL 提取图片（OG、Twitter Card）
   - 图片去重和优化
   - 默认封面管理

3. **实现位置**:
   - `src/lib/image/extractor.ts` - 图片提取
   - `src/lib/image/optimizer.ts` - 图片优化
   - `src/components/content/ImageSelector.tsx` - UI 组件

---

## RSS 数据源设计

### 数据模型

```prisma
model RssSource {
  id          Int      @id @default(autoincrement())
  name        String
  url         String   @unique
  category    String
  tags        Json
  enabled     Boolean  @default(true)
  lastFetchAt DateTime? @map("last_fetch_at")
  fetchCount  Int      @default(0) @map("fetch_count")
  errorCount  Int      @default(0) @map("error_count")
  lastError   String?  @map("last_error") @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("rss_sources")
}

model RssFetchLog {
  id          Int      @id @default(autoincrement())
  sourceId    Int      @map("source_id")
  status      String   // success, failed
  itemsCount  Int      @default(0) @map("items_count")
  newItems    Int      @default(0) @map("new_items")
  duplicates  Int      @default(0)
  error       String?  @db.Text
  duration    Int      // 毫秒
  createdAt   DateTime @default(now()) @map("created_at")

  source      RssSource @relation(fields: [sourceId], references: [id])

  @@map("rss_fetch_logs")
}
```

### UI 设计

**RSS 源管理页面** (`/rss`):
```
┌─────────────────────────────────────────────────────┐
│  RSS 数据源管理                    [+ 添加源]        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ 名称: Hacker News                            │   │
│  │ URL: https://hnrss.org/frontpage            │   │
│  │ 分类: 文章  标签: [技术] [资讯]              │   │
│  │ 状态: ✅ 启用                                │   │
│  │ 最后抓取: 2024-01-23 10:00                  │   │
│  │ 成功: 156 次  失败: 2 次                     │   │
│  │ [编辑] [禁用] [立即抓取] [查看日志]          │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 名称: OpenAI Blog                            │   │
│  │ ...                                          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 批量处理设计

### 任务队列系统

使用 BullMQ 实现任务队列：

```typescript
// src/lib/queue/ai-queue.ts
import { Queue, Worker } from 'bullmq'

export const aiQueue = new Queue('ai-tasks', {
  connection: redisConnection,
})

export const aiWorker = new Worker('ai-tasks', async (job) => {
  switch (job.name) {
    case 'score-content':
      return await scoreContent(job.data)
    case 'generate-summary':
      return await generateSummary(job.data)
    case 'organize-weekly':
      return await organizeWeekly(job.data)
  }
}, {
  connection: redisConnection,
  concurrency: 3, // 最多 3 个并发任务
})
```

### 进度显示

使用 Server-Sent Events (SSE) 实时推送进度：

```typescript
// src/app/api/batch/score/route.ts
export async function POST(request: Request) {
  const { contentIds } = await request.json()

  const stream = new ReadableStream({
    async start(controller) {
      for (const id of contentIds) {
        const result = await scoreContent(id)
        controller.enqueue(`data: ${JSON.stringify(result)}\n\n`)
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

---

## 成本和性能优化

### AI API 成本控制

1. **缓存策略**:
   - 缓存评分结果（避免重复评分）
   - 缓存生成的摘要

2. **批量处理**:
   - 合并多个请求
   - 使用更便宜的模型（Haiku）处理简单任务

3. **速率限制**:
   - 限制每分钟 API 调用次数
   - 使用队列控制并发

### 数据库性能优化

1. **索引优化**:
   ```sql
   CREATE INDEX idx_original_score ON contents(original_score);
   CREATE INDEX idx_summary_score ON contents(summary_score);
   CREATE INDEX idx_image_source ON contents(image_source);
   ```

2. **查询优化**:
   - 使用 Prisma 的 `select` 只查询需要的字段
   - 使用分页避免大量数据加载

3. **连接池**:
   - Prisma 自动管理连接池
   - 配置合适的连接数

---

## 安全考虑

### API 安全

1. **认证**: 所有 AI API 需要认证
2. **权限**: 只有管理员可以触发批量操作
3. **速率限制**: 防止滥用
4. **输入验证**: 验证所有输入参数

### 数据安全

1. **敏感数据**: API Key 存储在环境变量
2. **日志脱敏**: 不记录敏感信息
3. **错误处理**: 不暴露内部错误信息

---

## 测试策略

### 单元测试

```typescript
// src/lib/ai/__tests__/content-scorer.test.ts
describe('ContentScorer', () => {
  it('should score content correctly', async () => {
    const scorer = new ContentScorer(apiKey)
    const result = await scorer.scoreOriginal(mockContent)
    expect(result.overall).toBeGreaterThan(0)
  })
})
```

### 集成测试

```typescript
// src/app/api/ai/score-content/__tests__/route.test.ts
describe('POST /api/ai/score-content', () => {
  it('should return score', async () => {
    const response = await POST(mockRequest)
    expect(response.status).toBe(200)
  })
})
```

### E2E 测试

使用 Playwright 测试完整流程：
1. 登录
2. 打开内容详情
3. 点击"AI 评分"
4. 验证评分显示

---

## 部署和监控

### 部署流程

1. **数据库迁移**:
   ```bash
   pnpm prisma migrate deploy
   ```

2. **构建应用**:
   ```bash
   pnpm build
   ```

3. **Docker 部署**:
   ```bash
   docker build -t weekly-admin .
   docker run -p 3000:3000 weekly-admin
   ```

### 监控指标

1. **AI API 使用**:
   - 调用次数
   - 成功率
   - 平均响应时间
   - 成本统计

2. **系统性能**:
   - API 响应时间
   - 数据库查询时间
   - 内存使用

3. **业务指标**:
   - 内容评分分布
   - 周刊生成成功率
   - RSS 抓取成功率
