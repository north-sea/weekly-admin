# Weekly Admin 项目 - AI 功能增强计划

## 项目背景

Weekly Admin 是一个基于 Next.js 15 的成熟周刊管理系统，已实现：
- ✅ 内容 CRUD 管理
- ✅ 周刊编辑和发布
- ✅ Karakeep 同步
- ✅ Quail Newsletter 集成
- ✅ Meilisearch 搜索

**本次目标**：为现有系统添加 AI 能力，实现智能化内容管理和周刊生成。

## 项目阶段

### Phase 1: 数据库适配和 AI 基础设施 [in_progress]
**目标**: 扩展数据库支持 AI 功能，搭建 AI 服务层

**任务**:
- [x] 扩展 `scripts/migrate-db.ts`（以现有模式 idempotent 添加字段）
- [x] 更新 `prisma/schema.prisma`（`contents` 模型新增字段映射）
- [x] 扩展 contents 表（original_score, summary_score, ai_metadata）
- [x] 扩展 contents 表（image_source, image_width, image_height）
- [x] 创建 AI 服务层（server-only client）
- [x] 配置 Anthropic API 客户端（server-only + 环境变量）
- [x] 增加 AI 测试路由（便于验证服务端调用）
- [x] 更新 TypeScript 类型定义（如需要）

**文件**:
- `scripts/migrate-db.ts`
- `prisma/schema.prisma`
- `src/app/api/ai/test/route.ts`
- `src/lib/ai/server/client.ts`
- `src/types/content.ts`

**验收标准**:
- [x] Prisma schema 包含新字段
- [x] `pnpm db:migrate` 可重复执行且成功
- [ ] AI 客户端可以成功调用已配置的模型 API（OpenAI/兼容 或 Anthropic）
- [ ] TypeScript 类型无错误

**预计时间**: 3 小时

---

### Phase 2: AI 内容评分功能 [in_progress]
**目标**: 实现原文和摘要的 AI 评分

**任务**:
- [x] 实现原文内容评分服务
- [x] 实现摘要质量评分服务
- [x] 创建评分 API 路由
- [x] 在内容详情页添加评分显示
- [ ] 在内容列表页添加评分筛选
- [x] 添加"重新评分"按钮

**文件**:
- `src/lib/ai/server/content-scorer.ts`
- `src/lib/ai/server/summary-scorer.ts`
- `src/app/api/ai/score-content/route.ts`
- `src/app/api/ai/score-summary/route.ts`
- `src/components/content/AIScoreDisplay.tsx`
- `src/components/content/AIScoreButton.tsx`

**验收标准**:
- [ ] 可以对单个内容进行 AI 评分
- [ ] 评分结果保存到数据库
- [ ] 前端显示评分信息（分数 + 理由）
- [ ] 支持批量评分（选中多个内容）

**预计时间**: 5 小时

---

### Phase 3: AI 摘要生成功能 [pending]
**目标**: 实现 AI 自动生成和优化摘要

**任务**:
- [ ] 实现摘要生成服务
- [ ] 创建摘要生成 API 路由
- [ ] 在内容编辑页添加"AI 生成摘要"按钮
- [ ] 在内容编辑页添加"AI 优化摘要"按钮
- [ ] 添加摘要质量评分显示
- [ ] 支持摘要重新生成

**文件**:
- `src/lib/ai/summary-generator.ts`
- `src/app/api/ai/generate-summary/route.ts`
- `src/app/api/ai/optimize-summary/route.ts`
- `src/components/content/AISummaryGenerator.tsx`

**验收标准**:
- [ ] 可以为内容生成摘要
- [ ] 可以优化现有摘要
- [ ] 摘要符合配置的长度要求（100-200字）
- [ ] 显示摘要质量评分

**预计时间**: 4 小时

---

### Phase 4: AI 周刊组织器 [pending]
**目标**: 实现 AI 自动组织周刊功能

**任务**:
- [ ] 实现周刊组织器服务
- [ ] 创建周刊生成 API 路由
- [ ] 创建周刊生成器页面
- [ ] 实现配置面板（数量、分类配额）
- [ ] 实现候选内容展示
- [ ] 实现 AI 生成预览
- [ ] 实现一键应用到周刊

**文件**:
- `src/lib/ai/weekly-organizer.ts`
- `src/app/api/ai/organize-weekly/route.ts`
- `src/app/(dashboard)/weekly/generate/page.tsx`
- `src/components/weekly/WeeklyGenerator.tsx`
- `src/components/weekly/GeneratorConfig.tsx`
- `src/components/weekly/CandidateList.tsx`

**验收标准**:
- [ ] 可以查询未关联的内容
- [ ] AI 可以智能筛选和组织内容
- [ ] 显示 AI 生成的周刊预览
- [ ] 可以调整配置重新生成
- [ ] 可以一键应用到周刊编辑器

**预计时间**: 8 小时

---

### Phase 5: RSS 数据源集成 [pending]
**目标**: 实现 RSS 源管理和自动抓取，支持去重和聚合内容处理

**任务**:
- [ ] 创建 RSS 源数据模型（`scripts/migrate-db.ts` + `prisma/schema.prisma`）
- [ ] 明确 RSS 源配置存储（DB 字段：`type` + `aggregator_config`/`config` JSON；支持 UI 编辑）
- [ ] 实现 RSS 抓取服务
- [ ] 实现图片提取服务
- [ ] 实现去重服务（**关键**）
  - [ ] 检查 drafts 表（Karakeep 同步）
  - [ ] 检查 contents 表（已发布内容）
  - [ ] URL 规范化（移除 www、跟踪参数等）
  - [ ] 批量去重查询优化
  - [ ] 可选：标题相似度检查
- [ ] 输出去重报告（用于 UI 展示：drafts/contents/相似度）
- [ ] 实现聚合内容处理（**关键**）
  - [ ] 聚合源检测（配置驱动 + 智能识别）
  - [ ] 子链接提取
  - [ ] 子链接过滤和去重
  - [ ] 为每个子链接创建独立 content
- [ ] 可选：保留聚合关系（复用 `content_relations`；确认 `relation_type` 枚举是否需要新增值）
- [ ] 创建 RSS 源管理页面
- [ ] 创建 RSS 抓取 API 路由
- [ ] 创建聚合预览 API（`/api/rss/preview-aggregator`）
- [ ] 添加定时任务支持

**文件**:
- `scripts/migrate-db.ts`
- `prisma/schema.prisma`
- `src/lib/rss/fetcher.ts`
- `src/lib/rss/image-handler.ts`
- `src/lib/rss/deduplicator.ts` ⭐
- `src/lib/rss/aggregator-handler.ts` ⭐
- `src/lib/rss/aggregator-detector.ts` ⭐
- `src/app/(dashboard)/rss/page.tsx`
- `src/app/api/rss/fetch/route.ts`
- `src/app/api/rss/sources/route.ts`
- `src/app/api/rss/check-duplicate/route.ts` ⭐
- `src/app/api/rss/preview-aggregator/route.ts` ⭐

**验收标准**:
- [ ] 可以添加/编辑/删除 RSS 源
- [ ] 可以配置聚合源（type: aggregator）
- [ ] 可以手动触发抓取
- [ ] 抓取的内容自动写入 contents 表
- [ ] 自动提取图片（OG → Twitter → 原文）
- [ ] **与 Karakeep（drafts 表）去重** ⭐
- [ ] **与已发布内容（contents 表）去重** ⭐
- [ ] **聚合内容自动提取子链接** ⭐
- [ ] **子链接也进行去重检查** ⭐
- [ ] 显示去重报告（新增/重复/来源；包含 duplicates 详情）
- [ ] 支持聚合条目“预览提取 + 去重标注”

**预计时间**: 8 小时（增加 2 小时用于去重和聚合处理）

---

### Phase 6: 批量处理和自动化 [pending]
**目标**: 实现批量操作和自动化流程

**任务**:
- [ ] 实现批量 AI 评分
- [ ] 实现批量生成摘要
- [ ] 实现自动周刊生成（定时任务）
- [ ] 创建任务队列系统
- [ ] 添加进度显示
- [ ] 添加错误处理和重试

**文件**:
- `src/lib/queue/task-queue.ts`
- `src/lib/automation/weekly-auto-generator.ts`
- `src/app/api/batch/score/route.ts`
- `src/app/api/batch/summary/route.ts`
- `src/components/batch/BatchOperations.tsx`

**验收标准**:
- [ ] 可以批量处理多个内容
- [ ] 显示处理进度
- [ ] 错误时自动重试
- [ ] 可以配置自动化规则

**预计时间**: 5 小时

---

### Phase 7: 统计和可视化 [pending]
**目标**: 添加 AI 相关的统计和可视化

**任务**:
- [ ] 在仪表盘添加 AI 统计卡片
- [ ] 创建 AI 评分分布图表
- [ ] 创建内容质量趋势图
- [ ] 创建周刊生成报告
- [ ] 添加 AI 使用统计（API 调用次数、成本）

**文件**:
- `src/app/(dashboard)/analytics/ai/page.tsx`
- `src/components/analytics/AIScoreChart.tsx`
- `src/components/analytics/QualityTrendChart.tsx`
- `src/components/analytics/WeeklyReport.tsx`

**验收标准**:
- [ ] 仪表盘显示 AI 统计数据
- [ ] 图表清晰展示数据趋势
- [ ] 可以导出报告

**预计时间**: 4 小时

---

### Phase 8: 测试和优化 [pending]
**目标**: 测试完整流程并优化性能

**任务**:
- [ ] 端到端测试
- [ ] 性能优化（缓存、并发控制）
- [ ] 错误处理完善
- [ ] 用户体验优化
- [ ] 编写使用文档

**文件**:
- `docs/ai-features.md`
- `docs/api-reference.md`

**验收标准**:
- [ ] 所有功能正常工作
- [ ] 性能满足要求
- [ ] 错误处理完善
- [ ] 文档完整

**预计时间**: 3 小时

---

## 技术决策

### 1. 数据库扩展方案

**Prisma Schema 扩展**:
```prisma
model contents {
  // 现有字段...

  // AI 评分字段
  original_score Float?
  summary_score  Float?
  ai_metadata    Json?

  // 图片字段（image_url 已存在）
  image_source String? // og, twitter, content, default, screenshot
  image_width  Int?
  image_height Int?

  @@index([original_score])
  @@index([summary_score])
}

model RssSource {
  id          Int      @id @default(autoincrement())
  name        String
  url         String   @unique
  category    String
  tags        Json
  enabled     Boolean  @default(true)
  lastFetchAt DateTime? @map("last_fetch_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("rss_sources")
}
```

### 2. AI 服务层架构

```typescript
// src/lib/ai/client.ts
export class AIClient {
  async generate(options: AIGenerateOptions): Promise<string>
  async generateJSON<T>(options: AIGenerateOptions): Promise<T>
}

// src/lib/ai/content-scorer.ts
export class ContentScorer {
  async scoreOriginal(content: Content): Promise<OriginalScore>
  async scoreSummary(content: Content): Promise<SummaryScore>
}

// src/lib/ai/summary-generator.ts
export class SummaryGenerator {
  async generate(content: Content): Promise<string>
  async optimize(summary: string): Promise<string>
}

// src/lib/ai/weekly-organizer.ts
export class WeeklyOrganizer {
  async organize(contents: Content[], config: OrganizerConfig): Promise<OrganizedWeekly>
}
```

### 3. API 路由设计

```
POST /api/ai/score-content      # 评分原文
POST /api/ai/score-summary      # 评分摘要
POST /api/ai/generate-summary   # 生成摘要
POST /api/ai/optimize-summary   # 优化摘要
POST /api/ai/organize-weekly    # 组织周刊

POST /api/batch/score           # 批量评分
POST /api/batch/summary         # 批量生成摘要

GET  /api/rss/sources           # 获取 RSS 源列表
POST /api/rss/sources           # 添加 RSS 源
PUT  /api/rss/sources/:id       # 更新 RSS 源
DELETE /api/rss/sources/:id     # 删除 RSS 源
POST /api/rss/fetch             # 手动抓取
```

### 4. 配置文件

**AI 配置** (`src/config/ai.ts`):
```typescript
export const aiConfig = {
  // 通过环境变量覆盖，避免硬编码模型名
  model: process.env.AI_MODEL ?? 'TBD',
  temperature: 0.7,
  maxTokens: 8192,

  scoring: {
    minRelevance: 7,
    minQuality: 6,
    minPracticality: 6,
    minOverall: 7.0,
  },

  summary: {
    minLength: 100,
    maxLength: 200,
    style: 'objective',
  },

  weekly: {
    minItems: 8,
    maxItems: 15,
    preferredItems: 12,
    categoryLimits: {
      '工具': 4,
      '文章': 5,
      '教程': 3,
      '开源': 3,
      '资源': 2,
    },
  },
}
```

---

## 与现有系统的集成

### 1. 与 Karakeep 同步的协作

```
Karakeep 同步 → drafts 表
    ↓
AI 评分和生成摘要
    ↓
转换为 contents 表
    ↓
AI 组织周刊
    ↓
weekly_issues 表
```

### 2. 与 Quail Newsletter 的协作

```
AI 生成周刊
    ↓
用户审核和编辑
    ↓
发布到 weekly_issues
    ↓
自动同步到 Quail
    ↓
发送 Newsletter
```

### 3. 与 Meilisearch 的协作

```
AI 评分后的内容
    ↓
更新 Meilisearch 索引
    ↓
支持按评分筛选搜索
```

---

## 环境变量

```bash
# 现有环境变量
DATABASE_URL=...
MEILISEARCH_HOST=...
QUAIL_API_KEY=...

# 新增 AI 相关
ANTHROPIC_API_KEY=sk-ant-xxx

# 新增 RSS 相关（可选）
SCREENSHOT_API_KEY=xxx
SCREENSHOT_API_PROVIDER=ScreenshotLayer
```

---

## 依赖安装

```bash
# AI SDK
pnpm add @anthropic-ai/sdk

# RSS 解析
pnpm add rss-parser

# HTML 解析（图片提取）
pnpm add cheerio

# YAML 解析（配置文件）
pnpm add js-yaml
pnpm add -D @types/js-yaml

# 任务队列（可选）
pnpm add bull bullmq
```

---

## 错误记录

| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| - | - | - |

---

## 进度追踪

- **开始时间**: 2024-01-23
- **当前阶段**: Phase 1
- **完成阶段**: 0/8
- **预计完成**: 2024-01-26

---

## 注意事项

1. **数据库兼容性**: 确保 Prisma 迁移与现有数据库兼容
2. **API 限流**: 注意 Anthropic API 的速率限制
3. **成本控制**: 监控 AI API 调用次数和成本
4. **错误处理**: 完善的错误处理和重试机制
5. **用户体验**: AI 操作要有明确的加载状态和进度提示
