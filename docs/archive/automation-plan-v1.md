# 周刊自动化方案设计

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

参考 [BestBlogs.dev](https://www.bestblogs.dev/docs/how-it-works) 的三步精选流程:

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                    数据源层 (NAS)                              │
├─────────────────────────────────────────────────────────────┤
│  • Karakeep 收集箱 (RSS/Twitter/手动收藏)                      │
│  • RSS 订阅源 (技术博客/Newsletter)                            │
│  • Twitter Lists (通过 Grok 定时任务)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              自动化处理层 (n8n + Hermes)                       │
├─────────────────────────────────────────────────────────────┤
│  Step 1: 内容聚合 (n8n 定时任务)                               │
│    • 每小时从 Karakeep API 拉取新内容                          │
│    • 同步到 Admin 的 inbox_items 表                           │
│    • 去重检测 (URL/标题相似度)                                 │
│                                                               │
│  Step 2: AI 初评 (Hermes LLM)                                │
│    • 质量评分 (0-100): 技术深度/信息价值/可读性/实践指导        │
│    • 生成摘要和核心观点                                        │
│    • 自动分类和打标签                                          │
│    • 标题党识别                                               │
│    • 自动晋升: score >= 70 → contents 表 (status=ready)       │
│                                                               │
│  Step 3: 专家精审 (可选人工介入)                               │
│    • Admin 后台查看 AI 评分结果                               │
│    • 调整误判内容                                             │
│    • 标记 Featured 精选内容                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  周刊生成层 (自动化)                           │
├─────────────────────────────────────────────────────────────┤
│  • 每周五自动创建新周刊 (n8n 定时任务)                          │
│  • 从 contents 表筛选本周 ready 状态的内容                     │
│  • 按 AI 评分 + 分类自动排序                                   │
│  • AI 生成统一封面 (基于周刊标题)                              │
│  • 自动发布到 Quail Newsletter                                │
└─────────────────────────────────────────────────────────────┘
```

## 详细实现方案

### 阶段一: 去除截图依赖 (优先级最高)

#### 1.1 重新设计周刊列表页

**当前问题**: 依赖第一条内容的截图作为封面

**解决方案**: 统一封面模板 + 动态标题 (推荐)

**方案对比**:

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A. 统一模板 + 动态文字** | 风格统一、加载快、维护简单 | 视觉单一 | ⭐⭐⭐⭐⭐ |
| B. AI 每期生成 | 视觉多样、有新鲜感 | 成本高、风格不统一 | ⭐⭐⭐ |
| C. 预设多套模板轮换 | 平衡统一与多样 | 需要设计多套 | ⭐⭐⭐⭐ |

**推荐方案 A**: 统一封面模板 + 动态标题

```typescript
// 周刊封面配置
interface WeeklyCoverConfig {
  type: 'template';
  template: 'default' | 'gradient-blue' | 'gradient-purple'; // 可扩展
  title: string;      // 动态标题: "第 N 期"
  subtitle?: string;  // 可选副标题: "2026.05.15 - 2026.05.22"
  issueNumber: number;
  stats?: {
    itemCount: number;
    topCategories: string[]; // 本期主要分类
  };
}

// 封面生成逻辑
function generateCoverUrl(config: WeeklyCoverConfig): string {
  // 使用 Canvas/SVG 在前端动态生成
  // 或使用 Cloudflare Workers 边缘生成
  return `/api/cover/generate?template=${config.template}&title=${encodeURIComponent(config.title)}&issue=${config.issueNumber}`;
}
```

**封面设计规范** (需要在仓库中维护):

```markdown
# 周刊封面设计规范

## 默认模板 (default)
- 背景: 渐变色 (#667eea → #764ba2)
- 主标题: "第 N 期" (字体: Inter Bold, 72px)
- 副标题: 日期范围 (字体: Inter Regular, 24px)
- 装饰元素: 简约几何图形
- 尺寸: 1200x630 (适配 OG Image)

## 备选模板
- gradient-blue: 蓝色系渐变
- gradient-purple: 紫色系渐变
- 可根据季节/主题扩展

## 生成 Prompt (用于 AI 辅助设计)
当需要设计新模板时,使用以下 prompt:

"""
设计一个技术周刊的封面模板,要求:
1. 简约现代风格,适合技术内容
2. 使用渐变背景,主色调为 [颜色]
3. 预留标题区域 (第 N 期) 和日期区域
4. 尺寸 1200x630,适配社交媒体分享
5. 可以包含简约的几何装饰元素
6. 整体风格与 weekly.dev 网站一致
"""
```

**前端改造**:
- 周刊列表卡片: 显示统一设计的封面
- `weekly_issues.cover` 字段存储配置 JSON (不再是图片 URL)
- 前端根据配置动态渲染或调用生成 API

#### 1.2 重新设计周刊详情页

**当前问题**: 每条内容都需要截图

**解决方案 A: 纯文本卡片** (推荐)
```tsx
// 内容卡片布局
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

**解决方案 B: 按需加载截图**
- 使用浏览器端截图服务 (如 Puppeteer Cloud)
- 仅在用户点击"查看预览"时才截图
- 截图结果缓存到 CDN

**推荐方案 A**: 
- 加载速度快
- 维护成本低
- 更符合现代 Newsletter 风格 (参考 TLDR, ByteByteGo)

#### 1.3 数据库改造

```sql
-- 1. weekly_issues 表: cover 字段改为存储配置
ALTER TABLE weekly_issues 
MODIFY COLUMN cover TEXT COMMENT 'JSON 配置: {type, background, style}';

-- 2. contents 表: image_url 改为可选
-- 保留字段但不强制要求

-- 3. 新增 AI 评分字段 (已有 original_score/summary_score)
-- 无需改动
```

### 阶段二: 内容自动聚合与评分

#### 2.1 n8n 工作流: Karakeep 同步

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

// Node 2: 去重检测
// 查询 Admin 数据库,检查 URL 是否已存在

// Node 3: 插入 inbox_items
INSERT INTO inbox_items (
  source_id,
  title,
  url,
  summary,
  raw_content,
  status,
  collected_at
) VALUES (...)

// Node 4: 触发 AI 评分 (调用 Hermes)
```

#### 2.2 Hermes AI 评分服务

```typescript
// 部署在 NAS 的 Hermes 上
// API: POST /api/ai/score-content

interface ContentScoreRequest {
  title: string;
  url: string;
  summary?: string;
  content?: string;
}

interface ContentScoreResponse {
  quality_score: number;        // 0-100
  dimensions: {
    technical_depth: number;    // 技术深度
    information_value: number;  // 信息价值
    readability: number;        // 可读性
    practical_guidance: number; // 实践指导
  };
  summary: string;              // AI 生成摘要
  key_points: string[];         // 核心观点
  suggested_category: string;   // 建议分类
  suggested_tags: string[];     // 建议标签
  is_clickbait: boolean;        // 是否标题党
  auto_promote: boolean;        // 是否自动晋升
}

// Prompt 设计 (存储在 ai_prompts 表)
const SCORING_PROMPT = `
你是一个技术内容质量评估专家。请对以下内容进行多维度评分:

标题: {title}
摘要: {summary}
内容: {content}

评分维度 (0-100):
1. 技术深度: 是否有深入的技术分析,而非浅尝辄止
2. 信息价值: 是否提供新知识、新视角或实用信息
3. 可读性: 结构清晰、表达流畅、易于理解
4. 实践指导: 是否有可操作的建议或代码示例

同时判断:
- 是否为标题党 (标题夸张但内容空洞)
- 建议分类和标签
- 生成 100 字以内的摘要

输出 JSON 格式。
`;
```

#### 2.3 自动晋升逻辑

```typescript
// n8n Workflow: Auto Promote
// 触发器: inbox_items 插入后

// 规则:
if (score >= 70 && !is_clickbait) {
  // 自动晋升到 contents 表
  INSERT INTO contents (
    title,
    slug,
    summary,
    content,
    source_url,
    original_score,
    summary_score,
    status,
    category_id,
    ai_metadata
  ) VALUES (
    inbox.title,
    generateSlug(inbox.title),
    ai_result.summary,
    inbox.raw_content,
    inbox.url,
    ai_result.quality_score,
    ai_result.dimensions.information_value,
    'ready', // 自动标记为 ready
    getCategoryId(ai_result.suggested_category),
    JSON.stringify(ai_result)
  );
  
  // 更新 inbox 状态
  UPDATE inbox_items 
  SET status = 'promoted', content_id = LAST_INSERT_ID()
  WHERE id = inbox.id;
}
```

### 阶段三: 周刊自动生成

#### 3.1 n8n 工作流: 周刊自动创建

```javascript
// n8n Workflow: Weekly Auto Generation
// 触发器: Cron (每周五 18:00)

// Node 1: 创建新周刊
const lastIssue = await getLastIssue();
const newIssueNumber = lastIssue.issue_number + 1;
const startDate = getLastFriday();
const endDate = getThisFriday();

const issue = await createWeeklyIssue({
  issue_number: newIssueNumber,
  title: `第 ${newIssueNumber} 期`,
  slug: `issue-${newIssueNumber}`,
  start_date: startDate,
  end_date: endDate,
  status: 'draft',
  cover: JSON.stringify({
    type: 'ai-generated',
    background: 'gradient-blue-purple',
    style: 'modern'
  })
});

// Node 2: 筛选本周内容
const contents = await db.query(`
  SELECT * FROM contents
  WHERE status = 'ready'
    AND created_at BETWEEN ? AND ?
  ORDER BY original_score DESC, created_at DESC
  LIMIT 20
`, [startDate, endDate]);

// Node 3: 按分类分组并排序
const grouped = groupByCategory(contents);
const sorted = sortByScoreAndCategory(grouped);

// Node 4: 插入周刊内容项
for (const [index, content] of sorted.entries()) {
  await db.insert('weekly_content_items', {
    weekly_issue_id: issue.id,
    content_id: content.id,
    sort_order: index,
    section: content.category.name,
    featured: content.original_score >= 85
  });
}

// Node 5: 更新统计信息
await updateWeeklyStats(issue.id);

// Node 6: 生成 AI 封面 (可选)
const coverPrompt = `为技术周刊第 ${newIssueNumber} 期生成封面描述...`;
const coverImage = await generateCoverImage(coverPrompt);

// Node 7: 通知管理员审核
await sendNotification({
  type: 'weekly_draft_ready',
  issue_id: issue.id,
  message: `第 ${newIssueNumber} 期周刊草稿已自动生成,包含 ${contents.length} 条内容`
});
```

#### 3.2 自动发布到 Quail

```typescript
// n8n Workflow: Auto Publish to Quail
// 触发器: weekly_issues.status 变为 'published'

// 或者完全自动化:
// 每周六 10:00 自动发布昨天生成的草稿

const issue = await getLatestDraftIssue();

// 调用现有的 Quail 发布 API
await fetch(`/api/weekly/${issue.id}/publish`, {
  method: 'POST',
  body: JSON.stringify({
    deliver: true, // 同时发送邮件
    auto: true
  })
});
```

### 阶段四: 人工介入点优化

#### 4.1 保留的人工审核环节

```
┌─────────────────────────────────────┐
│  Inbox 审核 (可选)                   │
│  • 查看 AI 评分 60-70 分的边缘内容   │
│  • 手动晋升或拒绝                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  周刊草稿审核 (推荐)                 │
│  • 每周五晚查看自动生成的草稿        │
│  • 调整排序、删除不合适的内容        │
│  • 添加编辑推荐语                    │
│  • 周六上午点击发布                  │
└─────────────────────────────────────┘
```

#### 4.2 Admin 后台优化

```tsx
// 新增: AI 评分仪表板
<AIScoreDashboard>
  <ScoreDistribution />      // 本周评分分布
  <TopContents />            // 高分内容列表
  <PendingReview />          // 待审核的边缘内容
  <CategoryBreakdown />      // 分类统计
</AIScoreDashboard>

// 优化: 周刊编辑器
<WeeklyEditor>
  <AutoGeneratedBadge />     // 标识自动生成
  <AIRecommendations />      // AI 推荐的调整建议
  <QuickActions>
    <RemoveLowScore />       // 一键移除低分内容
    <ReorderByScore />       // 按评分重排
    <AddMissing />           // 添加遗漏的高分内容
  </QuickActions>
</WeeklyEditor>
```

## 技术实现细节

### 1. NAS 部署架构

```yaml
# docker-compose.yml (NAS)
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - ./n8n-data:/home/node/.n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - WEBHOOK_URL=https://your-nas.com/n8n
    
  hermes:
    image: your-hermes-image
    ports:
      - "8080:8080"
    volumes:
      - ./hermes-data:/data
    environment:
      - LLM_PROVIDER=openai
      - OPENAI_API_KEY=${OPENAI_API_KEY}
  
  mysql:
    image: mysql:8.0
    volumes:
      - ./mysql-data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=weekly_admin
```

### 2. API 端点设计

```typescript
// Admin 项目新增 API

// 1. AI 评分接口
POST /api/ai/score-content
Body: { title, url, summary?, content? }
Response: ContentScoreResponse

// 2. 批量评分接口
POST /api/ai/batch-score
Body: { inbox_ids: number[] }
Response: { results: ContentScoreResponse[] }

// 3. 自动晋升接口
POST /api/inbox/auto-promote
Body: { min_score: number, limit?: number }
Response: { promoted: number, skipped: number }

// 4. 周刊自动生成接口
POST /api/weekly/auto-generate
Body: { start_date, end_date, min_score?: number }
Response: { issue_id: number, content_count: number }

// 5. 封面生成接口
POST /api/weekly/[id]/generate-cover
Body: { style?: string }
Response: { cover_url: string }
```

### 3. 数据库迁移

```sql
-- migration: add_ai_scoring_fields.sql

-- 1. inbox_items 表新增字段
ALTER TABLE inbox_items
ADD COLUMN ai_score FLOAT COMMENT 'AI 质量评分 0-100',
ADD COLUMN ai_metadata JSON COMMENT 'AI 评分详情',
ADD COLUMN auto_promoted BOOLEAN DEFAULT FALSE COMMENT '是否自动晋升';

-- 2. contents 表优化
ALTER TABLE contents
MODIFY COLUMN image_url VARCHAR(500) NULL COMMENT '截图 URL (可选)',
ADD COLUMN ai_summary TEXT COMMENT 'AI 生成摘要',
ADD COLUMN ai_key_points JSON COMMENT 'AI 提取的核心观点';

-- 3. weekly_issues 表优化
ALTER TABLE weekly_issues
MODIFY COLUMN cover TEXT COMMENT '封面配置 JSON',
ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE COMMENT '是否自动生成',
ADD COLUMN generation_metadata JSON COMMENT '生成元数据';

-- 4. 新增索引
CREATE INDEX idx_inbox_ai_score ON inbox_items(ai_score DESC);
CREATE INDEX idx_contents_ready ON contents(status, original_score DESC);
```

## 实施路线图

### Phase 1: 去截图依赖 (1-2 周)
- [ ] 设计统一封面模板
- [ ] 改造周刊列表页 UI
- [ ] 改造周刊详情页 UI (纯文本卡片)
- [ ] 数据库迁移
- [ ] 测试并上线

### Phase 2: AI 评分系统 (2-3 周)
- [ ] 在 Hermes 上部署 AI 评分服务
- [ ] 设计评分 Prompt 并调优
- [ ] 开发 Admin API 端点
- [ ] 开发 n8n 工作流: Karakeep 同步 + AI 评分
- [ ] 开发 Admin 后台: AI 评分仪表板
- [ ] 测试自动晋升逻辑

### Phase 3: 周刊自动生成 (1-2 周)
- [ ] 开发 n8n 工作流: 周刊自动创建
- [ ] 开发内容筛选和排序算法
- [ ] 集成 AI 封面生成
- [ ] 优化周刊编辑器 UI
- [ ] 测试端到端流程

### Phase 4: 完全自动化 (1 周)
- [ ] 配置定时任务
- [ ] 设置通知机制
- [ ] 监控和日志
- [ ] 文档和培训

## 预期效果

### 人工时间节省
- **当前**: 每周约 4-6 小时
  - 内容筛选: 2 小时
  - 截图处理: 1-2 小时
  - 周刊编排: 1 小时
  - 发布流程: 0.5 小时

- **自动化后**: 每周约 0.5-1 小时
  - 快速审核 AI 生成的草稿: 0.5 小时
  - 微调和发布: 0.5 小时

**节省 80-90% 的时间**

### 内容质量提升
- AI 评分更客观,减少主观偏见
- 不会遗漏高质量内容
- 自动去重和标题党识别

### 用户体验优化
- 页面加载速度更快 (无需等待截图)
- 统一的视觉风格
- 更稳定的发布节奏

## 成本估算

### 开发成本
- 前端改造: 3-4 天
- 后端 API: 2-3 天
- n8n 工作流: 2-3 天
- AI Prompt 调优: 2-3 天
- 测试和优化: 3-5 天

**总计: 3-4 周**

### 运行成本
- Hermes LLM API: 约 $20-50/月 (取决于调用量)
- n8n: 免费 (自托管)
- 存储和带宽: 忽略不计

## 风险和应对

### 风险 1: AI 评分不准确
- **应对**: 
  - 保留人工审核环节
  - 持续优化 Prompt
  - 收集反馈数据训练模型

### 风险 2: 用户不适应无截图设计
- **应对**:
  - A/B 测试
  - 提供"查看原文预览"功能
  - 收集用户反馈

### 风险 3: NAS 服务不稳定
- **应对**:
  - 设置健康检查和自动重启
  - 关键服务使用云端备份
  - 降级方案: 手动触发工作流

## 参考资料

- [BestBlogs.dev 工作原理](https://www.bestblogs.dev/docs/how-it-works)
- [n8n 官方文档](https://docs.n8n.io/)
- [Karakeep API 文档](https://karakeep.com/docs/api)
- 项目现有文档:
  - `CLAUDE.md` - 项目架构
  - `docs/quail-api.md` - Quail 集成
  - `WEEKLY_WORKFLOW.md` - 当前工作流

## 下一步行动

1. **评审方案**: 与团队讨论技术可行性和优先级
2. **原型验证**: 先做一个最小化的 AI 评分原型
3. **UI 设计**: 设计无截图的周刊页面原型
4. **分阶段实施**: 按照路线图逐步推进

---

**文档版本**: v1.0  
**创建日期**: 2026-05-22  
**作者**: Claude + 用户  
**状态**: 待评审
