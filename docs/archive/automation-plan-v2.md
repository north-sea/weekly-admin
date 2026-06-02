# 周刊自动化方案设计 v2

> 基于 BestBlogs.dev 经验和 Hermes Agent 能力的优化方案

## 当前痛点分析

### 1. 人工介入环节过多
- **内容收集**: 需要手动从 Karakeep 收集箱筛选内容
- **截图处理**: Karakeep 截图经常失败,需要在 Admin 后台手动截图并上传图床
- **内容筛选**: 需要人工判断哪些内容值得进入周刊
- **周刊编排**: 需要手动拖拽排序、分类
- **封面生成**: 目前使用第一条内容的截图作为封面,不够统一美观
- **发布流程**: 虽然有 Quail 集成,但前置步骤太多

### 2. 截图依赖问题
- 周刊列表页依赖封面图(目前取第一条内容截图)
- 周刊详情页每条内容都需要截图
- Karakeep 截图 API 不稳定
- 手动截图上传耗时耗力

## 自动化方案设计

### 核心理念

**n8n 做简单的事,Hermes 做复杂的事**

- **n8n**: 数据搬运、定时触发、API 调用(可视化、易调试)
- **Hermes**: AI 评分、学习偏好、智能决策(自主学习、持续优化)

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                    数据源层 (NAS)                              │
├─────────────────────────────────────────────────────────────┤
│  Karakeep 收集箱 (RSS/Twitter/手动收藏)                        │
│  • 已有分类/标签建议 ✓                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              n8n: 数据同步层 (每小时)                          │
├─────────────────────────────────────────────────────────────┤
│  1. 从 Karakeep API 拉取新内容                                │
│  2. 插入 inbox_items 表                                       │
│  3. 保存 Karakeep 的分类/标签建议                             │
│  4. 去重检测 (URL/标题)                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Hermes: AI 评分与学习层 (定时技能)                     │
├─────────────────────────────────────────────────────────────┤
│  技能 1: 内容评分 (每小时触发)                                 │
│    • 扫描 inbox_items 中未评分的内容                          │
│    • 六维评分 (参考 BestBlogs)                                │
│      - 选题质量 (Topic Quality)                               │
│      - 内容质量 (Content Quality)                             │
│      - 技术深度 (Technical Depth)                             │
│      - 实用价值 (Practical Value)                             │
│      - 创新性 (Innovation)                                    │
│      - 表达质量 (Expression Quality)                          │
│    • 参考 Karakeep 的分类/标签建议                            │
│    • 参考记忆中的用户偏好                                      │
│    • 自动晋升高分内容到 contents 表                            │
│                                                               │
│  技能 2: 学习用户偏好 (每周日触发)                             │
│    • 分析本周你的手动调整                                      │
│    • 提取偏好规律存入记忆                                      │
│    • 更新评分权重                                             │
│                                                               │
│  技能 3: 周刊生成 (每周五 18:00)                              │
│    • 筛选本周 ready 状态的内容                                │
│    • 按评分和分类排序                                         │
│    • 生成周刊草稿                                             │
│    • 通过微信通知你审核                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              人工审核 (微信/Admin 后台)                        │
├─────────────────────────────────────────────────────────────┤
│  • 查看周刊草稿                                               │
│  • 微调排序/删除不合适的内容                                   │
│  • 点击发布                                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           n8n: 发布层 (手动触发或定时)                         │
├─────────────────────────────────────────────────────────────┤
│  • 调用 Admin API 发布周刊                                    │
│  • 调用 Quail API 发送邮件                                    │
└─────────────────────────────────────────────────────────────┘
```

## 详细实现方案

### 阶段一: 去除截图依赖 (优先级最高)

#### 1.1 重新设计周刊列表页

**解决方案**: 统一封面模板 + 动态标题

**设计规范**: 见 `docs/cover-design.md`

**前端实现**:
```typescript
// 周刊封面配置
interface WeeklyCoverConfig {
  type: 'template';
  template: 'default' | 'gradient-blue' | 'gradient-purple';
  title: string;      // "第 N 期"
  subtitle?: string;  // "2026.05.15 - 2026.05.22"
  issueNumber: number;
}

// 封面生成 (前端 Canvas 或 Cloudflare Workers)
function generateCoverUrl(config: WeeklyCoverConfig): string {
  return `/api/cover/generate?template=${config.template}&title=${encodeURIComponent(config.title)}&issue=${config.issueNumber}`;
}
```

#### 1.2 重新设计周刊详情页

**解决方案**: 纯文本卡片 (参考 TLDR, ByteByteGo)

```tsx
<ContentCard>
  <CategoryBadge />
  <Title />
  <Summary />        // AI 生成的摘要
  <Tags />
  <Metadata>
    <Source />
    <Date />
    <ReadingTime />
  </Metadata>
  <Link to={source_url} />
</ContentCard>
```

#### 1.3 数据库改造

```sql
-- weekly_issues 表: cover 字段改为存储配置
ALTER TABLE weekly_issues 
MODIFY COLUMN cover TEXT COMMENT 'JSON 配置: {type, template, title}';

-- contents 表: image_url 改为可选
-- 保留字段但不强制要求
```

### 阶段二: AI 评分系统 (参考 BestBlogs)

#### 2.1 六维评分体系

基于 [BestBlogs.dev](https://github.com/ginobefun/BestBlogs) 的实践:

| 维度 | 说明 | 权重 |
|------|------|------|
| **选题质量** | 话题的重要性、时效性、受众相关性 | 15% |
| **内容质量** | 信息准确性、论证充分性、结构完整性 | 25% |
| **技术深度** | 技术细节的深入程度、原理解释 | 20% |
| **实用价值** | 可操作性、实际应用场景、代码示例 | 20% |
| **创新性** | 新颖的观点、独特的视角、前沿技术 | 10% |
| **表达质量** | 文字流畅度、逻辑清晰度、可读性 | 10% |

**评分流程** (参考 BestBlogs 的 Dify Workflow):

```
1. 初评 (快速过滤)
   ↓
2. 长文分段分析 (>6000字)
   ↓
3. 六维评分
   ↓
4. 生成摘要和关键观点
   ↓
5. 分类和标签生成
   ↓
6. 检查反思
   ↓
7. 优化改进
```

#### 2.2 Hermes 技能设计

**技能 1: 内容评分**

```yaml
名称: weekly_content_scoring
触发: 每小时 (cron: "0 * * * *")
工作目录: /path/to/admin
依赖工具: 
  - database_query (查询 inbox_items)
  - llm_call (调用 LLM 评分)
  - database_update (更新评分结果)

流程:
  1. 查询未评分的 inbox_items
  2. 对每条内容:
     a. 读取标题、摘要、URL
     b. 参考 Karakeep 的分类/标签建议
     c. 从记忆中加载用户偏好
     d. 调用 LLM 进行六维评分
     e. 生成摘要和关键观点
     f. 更新 inbox_items 表
  3. 自动晋升高分内容 (score >= 70):
     - 插入 contents 表
     - 状态设为 'ready'
     - 更新 inbox_items.status = 'promoted'
```

**技能 2: 学习用户偏好**

```yaml
名称: weekly_preference_learning
触发: 每周日 22:00 (cron: "0 22 * * 0")
工作目录: /path/to/admin

流程:
  1. 查询本周的用户操作:
     - 手动晋升的低分内容
     - 手动删除的高分内容
     - 标记为 featured 的内容
  2. 分析共同特征:
     - 标题关键词
     - 来源域名
     - 技术栈标签
     - 内容长度
  3. 提取偏好规律:
     "用户偏好 Rust 相关内容,即使评分 65 也会晋升"
     "用户不喜欢纯理论文章,实践类优先"
  4. 存入记忆系统:
     - 类型: feedback
     - 标题: "周刊内容偏好 - {日期}"
     - 内容: 偏好规律描述
```

**技能 3: 周刊生成**

```yaml
名称: weekly_issue_generation
触发: 每周五 18:00 (cron: "0 18 * * 5")
工作目录: /path/to/admin

流程:
  1. 创建新周刊:
     - 期数 = 上期 + 1
     - 日期范围 = 上周五到本周五
     - 状态 = 'draft'
  2. 筛选本周内容:
     - status = 'ready'
     - created_at 在本周范围内
     - 按 original_score DESC 排序
  3. 按分类分组并排序
  4. 插入 weekly_content_items
  5. 生成封面配置 (统一模板)
  6. 通过微信通知:
     "第 N 期周刊草稿已生成,包含 X 条内容,请审核"
```

#### 2.3 数据库 Schema 调整

```sql
-- 1. inbox_items 表新增字段
ALTER TABLE inbox_items
ADD COLUMN suggested_category VARCHAR(100) COMMENT 'Karakeep 建议的分类',
ADD COLUMN suggested_tags JSON COMMENT 'Karakeep 建议的标签',
ADD COLUMN ai_score FLOAT COMMENT 'AI 综合评分 0-100',
ADD COLUMN ai_dimensions JSON COMMENT 'AI 六维评分详情',
ADD COLUMN ai_summary TEXT COMMENT 'AI 生成摘要',
ADD COLUMN ai_key_points JSON COMMENT 'AI 提取的核心观点',
ADD COLUMN auto_promoted BOOLEAN DEFAULT FALSE COMMENT '是否自动晋升';

-- 2. contents 表优化
ALTER TABLE contents
MODIFY COLUMN image_url VARCHAR(500) NULL COMMENT '截图 URL (可选)',
ADD COLUMN ai_dimensions JSON COMMENT 'AI 六维评分详情',
ADD COLUMN ai_key_points JSON COMMENT 'AI 提取的核心观点';

-- 3. weekly_issues 表优化
ALTER TABLE weekly_issues
MODIFY COLUMN cover TEXT COMMENT '封面配置 JSON',
ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE COMMENT '是否自动生成',
ADD COLUMN generation_metadata JSON COMMENT '生成元数据';

-- 4. 新增用户反馈表 (用于学习偏好)
CREATE TABLE user_feedback (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content_id INT,
  action ENUM('promote', 'demote', 'feature', 'delete'),
  ai_score FLOAT COMMENT '当时的 AI 评分',
  reason TEXT COMMENT '操作原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES contents(id)
);

-- 5. 新增索引
CREATE INDEX idx_inbox_ai_score ON inbox_items(ai_score DESC);
CREATE INDEX idx_inbox_status ON inbox_items(status);
CREATE INDEX idx_contents_ready ON contents(status, original_score DESC);
```

### 阶段三: Admin Docker 部署 (参考 StrideOS)

#### 3.1 Dockerfile (多阶段构建)

```dockerfile
# 参考 /Users/yqg/personal/webs/stride-os/Dockerfile.web

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

#### 3.2 Docker Compose (生产环境)

```yaml
# compose.prod.yml
services:
  admin:
    image: ${DOCKER_REGISTRY:-ghcr.io/your-org}/weekly-admin:${IMAGE_TAG:-latest}
    restart: unless-stopped
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      - RUN_MIGRATIONS_ON_START=true
    networks:
      - proxy
      - default
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.weekly-admin.rule=Host(`admin.weekly.dev`)"
      - "traefik.http.routers.weekly-admin.entrypoints=websecure"
      - "traefik.http.routers.weekly-admin.tls=true"
      - "traefik.http.services.weekly-admin.loadbalancer.server.port=3000"

networks:
  proxy:
    external: true
```

#### 3.3 Docker Entrypoint

```bash
#!/bin/sh
# scripts/docker-entrypoint.sh

set -eu

# 运行数据库迁移
if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# 启动应用
exec "$@"
```

#### 3.4 API 路由设计

参考 StrideOS 的 API 结构:

```
src/app/api/v1/
├── inbox/
│   ├── route.ts              # GET /api/v1/inbox (列表)
│   ├── [id]/route.ts         # GET/PATCH/DELETE /api/v1/inbox/:id
│   └── [id]/promote/route.ts # POST /api/v1/inbox/:id/promote
├── contents/
│   ├── route.ts              # GET/POST /api/v1/contents
│   └── [id]/route.ts         # GET/PATCH/DELETE /api/v1/contents/:id
├── weekly/
│   ├── route.ts              # GET/POST /api/v1/weekly
│   ├── [id]/route.ts         # GET/PATCH /api/v1/weekly/:id
│   ├── [id]/publish/route.ts # POST /api/v1/weekly/:id/publish
│   └── [id]/items/route.ts   # GET/POST /api/v1/weekly/:id/items
└── ai/
    ├── score/route.ts        # POST /api/v1/ai/score (手动触发评分)
    └── feedback/route.ts     # POST /api/v1/ai/feedback (记录用户反馈)
```

**API 示例** (参考 StrideOS):

```typescript
// src/app/api/v1/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listInboxItems } from '@/lib/services/inbox-service';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const status = request.nextUrl.searchParams.get('status');
  const items = await listInboxItems({ status });
  
  return NextResponse.json(items);
}
```

### 阶段四: n8n 工作流设计

#### 4.1 Karakeep 同步工作流

```javascript
// n8n Workflow: Karakeep to Inbox
// 触发器: Cron (每小时)

// Node 1: HTTP Request - 获取 Karakeep 新内容
GET https://api.karakeep.com/bookmarks/search
Headers: Authorization: Bearer ${KARAKEEP_TOKEN}
Query: {
  query: "is:inlist list:周刊收集箱",
  limit: 50
}

// Node 2: 转换数据格式
// 提取 Karakeep 的分类/标签建议

// Node 3: MySQL - 去重检测
SELECT id FROM inbox_items WHERE url = ?

// Node 4: MySQL - 插入新内容
INSERT INTO inbox_items (
  source_id,
  title,
  url,
  summary,
  raw_content,
  suggested_category,
  suggested_tags,
  status,
  collected_at
) VALUES (...)
```

#### 4.2 周刊发布工作流

```javascript
// n8n Workflow: Publish Weekly
// 触发器: Webhook (Admin 后台点击发布)

// Node 1: HTTP Request - 获取周刊详情
GET http://admin.weekly.dev/api/v1/weekly/${weeklyId}

// Node 2: HTTP Request - 调用 Quail API
POST https://api.quail.ink/v1/newsletters/${newsletterId}/posts
Body: {
  title: weekly.title,
  content: weekly.content,
  send_email: true
}

// Node 3: MySQL - 更新周刊状态
UPDATE weekly_issues SET status = 'published' WHERE id = ?
```

## 封面设计规范

详见 `docs/cover-design.md`

## 预期效果

### 人工时间节省
- **当前**: 每周约 4-6 小时
- **自动化后**: 每周约 0.5-1 小时
- **节省**: 80-90%

### 内容质量提升
- AI 六维评分更客观
- 不会遗漏高质量内容
- 自动学习用户偏好

### 用户体验优化
- 页面加载速度更快
- 统一的视觉风格
- 更稳定的发布节奏

## 成本估算

### 开发成本
- 前端改造: 3-4 天
- 后端 API: 2-3 天
- Hermes 技能开发: 3-4 天
- n8n 工作流: 2-3 天
- Docker 部署: 1-2 天
- 测试和优化: 3-5 天

**总计: 3-4 周**

### 运行成本
- LLM API: 约 $20-50/月
- n8n: 免费 (自托管)
- Hermes: 免费 (自托管)
- 存储和带宽: 忽略不计

## 风险和应对

### 风险 1: AI 评分不准确
- **应对**: 
  - 保留人工审核环节
  - 持续优化 Prompt
  - 通过用户反馈学习

### 风险 2: Hermes 学习偏差
- **应对**:
  - 定期检查记忆内容
  - 提供手动调整评分权重的接口
  - 保留完整的操作日志

### 风险 3: NAS 服务不稳定
- **应对**:
  - 设置健康检查和自动重启
  - 关键服务使用云端备份
  - 降级方案: 手动触发工作流

## 参考资料

- [BestBlogs.dev GitHub](https://github.com/ginobefun/BestBlogs)
- [BestBlogs Dify Workflow 实践](https://github.com/ginobefun/BestBlogs/blob/main/flows/Dify/BestBlogs.dev%20%E5%9F%BA%E4%BA%8E%20Dify%20Workflow%20%E7%9A%84%E6%96%87%E7%AB%A0%E6%99%BA%E8%83%BD%E5%88%86%E6%9E%90%E5%AE%9E%E8%B7%B5.md)
- [Hermes Agent 文档](https://hermes-agent.nousresearch.com/docs)
- [n8n 官方文档](https://docs.n8n.io/)
- [Karakeep API 文档](https://karakeep.com/docs/api)
- StrideOS 参考: `/Users/yqg/personal/webs/stride-os`
- 项目现有文档:
  - `CLAUDE.md` - 项目架构
  - `docs/quail-api.md` - Quail 集成
  - `WEEKLY_WORKFLOW.md` - 当前工作流

## 下一步行动

1. ✅ 方案评审通过
2. 进入 SDD 开发流程:
   - 详细设计 Hermes 技能
   - 设计 API 接口规范
   - 设计数据库迁移脚本
3. 创建封面设计规范文档
4. 准备 Admin Docker 部署

---

**文档版本**: v2.0  
**创建日期**: 2026-05-22  
**作者**: Claude + 用户  
**状态**: 待进入 SDD 流程
