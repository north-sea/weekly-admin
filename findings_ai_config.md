# AI 配置系统 - 研究发现

## 现有代码分析

### 1. AI Client 架构 (`src/lib/ai/server/client.ts`)

当前实现：
- 支持 OpenAI 和 Anthropic 两种 provider
- 通过环境变量配置：`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`
- 提供 `serverGenerateText()` 和 `serverGenerateJSON()` 两个核心函数
- 自动检测 provider（优先显式配置，其次根据 API Key 推断）

关键函数签名：
```typescript
export interface AiGenerateOptions {
  messages: AiMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
}

export async function serverGenerateText(options: AiGenerateOptions): Promise<string>
export async function serverGenerateJSON<T>(options: AiGenerateOptions): Promise<T>
```

### 2. AI 使用场景

| 文件 | 功能 | Prompt 特点 |
|------|------|-------------|
| `content-scorer.ts` | 内容评分 | 固定评分维度，输出 JSON |
| `summary-generator.ts` | 摘要生成/优化 | 100-200字要求，纯文本输出 |
| `summary-scorer.ts` | 摘要评分 | 类似内容评分 |
| `weekly-organizer.ts` | 周刊组织 | 选择+分类，输出 JSON |
| 前端周刊编辑器 | 简介/封面生成 | 通过 API 调用 |

### 3. Settings 页面结构

```
/settings/
├── layout.tsx          # Tab 导航（分类、标签、AI）← 需移除
├── categories/page.tsx # 分类管理
├── tags/page.tsx       # 标签管理
└── ai/page.tsx         # AI 设置（当前只读展示）
```

侧边栏 MenuConfig 已有完整子菜单，页面内 Tab 冗余。

### 4. 现有 AI 设置页面功能

- 只读展示当前环境变量配置
- 测试连接功能
- 无法在页面修改配置

---

## 技术决策

### 加密方案选择

**选择 AES-256-GCM**：
- Node.js 原生 `crypto` 模块支持
- 提供认证加密（AEAD），防篡改
- 业界标准，安全性高

实现要点：
- 每次加密生成随机 IV（12字节）
- 存储格式：`iv:authTag:ciphertext`（Base64）
- 密钥从环境变量读取，不硬编码

### 数据库设计决策

**为什么分两张表**：
- `ai_configs`：API 配置，可能频繁切换
- `ai_prompts`：Prompt 模板，相对稳定
- 分离关注点，便于独立管理

**为什么 scene 用字符串而非枚举**：
- 便于扩展新场景
- 前端可动态渲染
- 数据库层面用 UNIQUE 约束保证唯一

### 兼容性策略

**环境变量回退**：
- 数据库无配置时，回退到环境变量
- 便于迁移，不破坏现有部署
- 生产环境可逐步迁移

---

## API 设计

### AI Configs API

```
GET    /api/ai/configs              # 列表（脱敏 key）
POST   /api/ai/configs              # 新建
GET    /api/ai/configs/:id          # 详情（脱敏 key）
PUT    /api/ai/configs/:id          # 更新
DELETE /api/ai/configs/:id          # 删除
POST   /api/ai/configs/:id/test     # 测试连接
PUT    /api/ai/configs/:id/default  # 设为默认
```

### AI Prompts API

```
GET    /api/ai/prompts              # 列表
GET    /api/ai/prompts/:scene       # 详情
PUT    /api/ai/prompts/:scene       # 更新
POST   /api/ai/prompts/:scene/reset # 重置为默认
```

---

## UI 设计草图

```
┌─────────────────────────────────────────────────────────────────┐
│  AI 设置                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ API 配置 ─────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐  │ │
│  │  │ OpenAI 主力      │  │ Claude 备用      │  │ + 新增  │  │ │
│  │  │ gpt-4o-mini      │  │ claude-3-5-sonnet│  │         │  │ │
│  │  │ ✓ 默认           │  │                  │  │         │  │ │
│  │  │ [测试] [编辑]    │  │ [测试] [编辑]    │  │         │  │ │
│  │  └──────────────────┘  └──────────────────┘  └─────────┘  │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Prompt 模板 ───────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  [内容评分] [摘要生成] [摘要优化] [周刊组织] [周刊简介] [封面] │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ 你是技术周刊编辑助手。请对下面的"原文内容"进行      │   │ │
│  │  │ 0-10 分打分，并给出简短理由（中文）。               │   │ │
│  │  │                                                     │   │ │
│  │  │ 评分维度：                                          │   │ │
│  │  │ - relevance：与技术从业者/开发者相关性              │   │ │
│  │  │ - quality：信息密度、可信度、结构清晰度             │   │ │
│  │  │ ...                                                 │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  可用变量: {{title}}, {{source_url}}, {{content}}          │ │
│  │                                                             │ │
│  │  [重置为默认]                              [保存]          │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 默认 Prompt 内容

### content_score（内容评分）
```
你是技术周刊编辑助手。请对下面的"原文内容"进行 0-10 分打分，并给出简短理由（中文）。

评分维度：
- relevance：与技术从业者/开发者相关性
- quality：信息密度、可信度、结构清晰度
- practicality：可实践性、可操作性、可迁移性
- overall：综合评分（0-10，可带 0.5）

输出 JSON 字段：overall, relevance, quality, practicality, reasons（数组，1-8 条）。

标题：{{title}}
{{#source_url}}来源：{{source_url}}{{/source_url}}
{{#description}}描述：{{description}}{{/description}}
{{#summary}}摘要：{{summary}}{{/summary}}

原文内容：
{{content}}
```

### summary_generate（摘要生成）
```
你是技术周刊编辑助手。请为下面内容生成中文摘要。

要求：
- 100-200 字
- 客观、信息密度高
- 不要使用 Markdown
- 只输出摘要文本，不要加标题或引号

标题：{{title}}
{{#source_url}}来源：{{source_url}}{{/source_url}}
{{#description}}描述：{{description}}{{/description}}

原文：
{{content}}
```

### summary_optimize（摘要优化）
```
你是技术周刊编辑助手。请优化下面的中文摘要。

要求：
- 仍保持 100-200 字
- 更清晰、更准确、更精炼
- 不要使用 Markdown
- 只输出优化后的摘要文本，不要加标题或引号

标题：{{title}}

当前摘要：
{{summary}}

原文（供参考）：
{{content}}
```

### weekly_organize（周刊组织）
```
你是技术周刊编辑。请从候选内容中挑选并组织本期周刊的条目。

周刊标题：{{title}}
时间范围：{{start_date}} ~ {{end_date}}
目标数量：{{max_items}}

要求：
- 选择最值得推荐的条目（优先参考 original_score/summary_score，但也可基于标题/摘要判断）
- 为每条选择一个 section（例如：工具/文章/教程/开源/资源/观点）
- 可标记 1-2 条 featured=true
- reason 用 1 句话解释为何入选（可选）

候选列表（JSON 数组）：
{{candidates}}
```

### weekly_desc（周刊简介）
```
你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。

标题：{{title}}
时间：{{date_range}}
收录：{{contents_summary}}
```

### weekly_cover（周刊封面）
```
Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.
```

---

## 补充发现（实现阶段）

1. 现有周刊编辑器依赖 `GET /api/ai/config` 获取 `weeklyDescPrompt` / `weeklyCoverPrompt`，需要兼容数据库 Prompt（否则旧逻辑无法感知新配置）。
2. 除 “摘要生成/优化” 外，系统还存在 “摘要评分”（`summary-scorer.ts`），需要独立 Prompt（scene：`summary_score`）。
