# AI 配置系统重构计划

## 目标

1. 移除 Settings 页面内的多余 Tab 导航（侧边栏已有子菜单）
2. 将 AI 配置从环境变量迁移到数据库，支持页面配置
3. 支持多组 API 配置切换
4. 为每个 AI 功能场景配置独立 Prompt（带默认值）
5. 确保 API Key 安全存储（加密）

## 当前状态分析

### 多余路由问题
- `settings/layout.tsx` 有 Tab 导航（分类、标签、AI）
- `MenuConfig.tsx` 侧边栏有子菜单（用户、分类、标签、AI）
- **双重导航冗余**，需移除页面内 Tab

### AI 配置现状
- 完全依赖环境变量：`AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_TEXT_MODEL` 等
- AI 使用场景（6 处）：
  1. `content-scorer.ts` - 内容评分
  2. `summary-generator.ts` - 摘要生成
  3. `summary-scorer.ts` - 摘要评分
  4. `weekly-organizer.ts` - 周刊组织
  5. 周刊简介生成（前端调用）
  6. 周刊封面生成（前端调用）

---

## 执行计划

### Phase 1: 移除多余导航
- **状态**: `pending`
- **文件**: `src/app/(dashboard)/settings/layout.tsx`
- **操作**: 移除 Tab 导航，只保留 children 渲染

### Phase 2: 数据库表设计
- **状态**: `pending`
- **文件**: `prisma/schema.prisma`
- **操作**:
  - 新增 `ai_configs` 表（多组 API 配置）
  - 新增 `ai_prompts` 表（Prompt 模板）

### Phase 3: 加密工具
- **状态**: `pending`
- **新建文件**: `src/lib/crypto.ts`
- **功能**:
  - `encrypt(plaintext)` - AES-256-GCM 加密
  - `decrypt(ciphertext)` - 解密
  - `maskApiKey(key)` - 脱敏显示 `sk-****xxxx`

### Phase 4: 服务层实现
- **状态**: `pending`
- **新建文件**:
  - `src/lib/services/ai-config.ts` - 配置 CRUD
  - `src/lib/services/ai-prompt.ts` - Prompt CRUD

### Phase 5: API 路由
- **状态**: `pending`
- **新建/修改文件**:
  - `src/app/api/ai/configs/route.ts` - GET/POST
  - `src/app/api/ai/configs/[id]/route.ts` - GET/PUT/DELETE
  - `src/app/api/ai/configs/[id]/test/route.ts` - POST 测试连接
  - `src/app/api/ai/configs/[id]/default/route.ts` - PUT 设为默认
  - `src/app/api/ai/prompts/route.ts` - GET
  - `src/app/api/ai/prompts/[scene]/route.ts` - GET/PUT
  - `src/app/api/ai/prompts/[scene]/reset/route.ts` - POST 重置

### Phase 6: 修改 AI Client
- **状态**: `pending`
- **文件**: `src/lib/ai/server/client.ts`
- **操作**:
  - 优先从数据库读取默认配置
  - 回退到环境变量（兼容）
  - 支持指定 configId 调用

### Phase 7: 前端页面重构
- **状态**: `pending`
- **文件**: `src/app/(dashboard)/settings/ai/page.tsx`
- **功能**:
  - API 配置列表（卡片式）
  - 新增/编辑配置弹窗
  - 设为默认、测试连接、删除
  - Prompt 模板编辑（Tab 切换场景）
  - 重置为默认 Prompt

### Phase 8: 初始化默认数据
- **状态**: `pending`
- **操作**:
  - 创建 seed 脚本或 API 初始化默认 Prompt
  - 6 个场景的默认 Prompt 模板

---

## 数据库设计

### ai_configs 表
```prisma
model ai_configs {
  id               Int      @id @default(autoincrement())
  name             String   @unique @db.VarChar(100)
  provider         ai_configs_provider @default(openai)
  base_url         String   @db.VarChar(500)
  api_key_encrypted String  @db.Text
  model            String   @db.VarChar(100)
  is_default       Boolean  @default(false)
  enabled          Boolean  @default(true)
  created_at       DateTime? @default(now()) @db.Timestamp(0)
  updated_at       DateTime? @default(now()) @db.Timestamp(0)
}

enum ai_configs_provider {
  openai
  anthropic
}
```

### ai_prompts 表
```prisma
model ai_prompts {
  id         Int      @id @default(autoincrement())
  scene      String   @unique @db.VarChar(50)
  name       String   @db.VarChar(100)
  prompt     String   @db.Text
  variables  Json?
  updated_at DateTime? @default(now()) @db.Timestamp(0)
}
```

---

## 默认 Prompt 模板

| scene | name | 变量 |
|-------|------|------|
| `content_score` | 内容评分 | `{{title}}`, `{{source_url}}`, `{{description}}`, `{{summary}}`, `{{content}}` |
| `summary_generate` | 摘要生成 | `{{title}}`, `{{source_url}}`, `{{description}}`, `{{content}}` |
| `summary_optimize` | 摘要优化 | `{{title}}`, `{{summary}}`, `{{content}}` |
| `weekly_organize` | 周刊组织 | `{{title}}`, `{{start_date}}`, `{{end_date}}`, `{{max_items}}`, `{{candidates}}` |
| `weekly_desc` | 周刊简介 | `{{title}}`, `{{date_range}}`, `{{contents_summary}}` |
| `weekly_cover` | 周刊封面 | `{{title}}`, `{{contents_summary}}` |

---

## 安全措施

1. **API Key 加密**: AES-256-GCM，密钥从 `AI_ENCRYPTION_KEY` 环境变量读取
2. **前端脱敏**: 只显示 `sk-****xxxx` 格式
3. **更新逻辑**: 空字符串保留原值，非空则更新
4. **权限控制**: 所有 AI 配置 API 需要 ADMIN 角色

---

## 环境变量更新

新增：
```env
# AI 配置加密密钥（32字节 hex，64字符）
AI_ENCRYPTION_KEY="your-64-char-hex-string"
```

保留（作为回退）：
```env
AI_PROVIDER="openai"
AI_BASE_URL="https://api.openai.com"
AI_API_KEY="your-api-key"
AI_TEXT_MODEL="gpt-4o-mini"
```

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| - | - | - |

---

## 文件变更清单

### 新建文件
- [ ] `src/lib/crypto.ts`
- [ ] `src/lib/services/ai-config.ts`
- [ ] `src/lib/services/ai-prompt.ts`
- [ ] `src/app/api/ai/configs/route.ts`
- [ ] `src/app/api/ai/configs/[id]/route.ts`
- [ ] `src/app/api/ai/configs/[id]/test/route.ts`
- [ ] `src/app/api/ai/configs/[id]/default/route.ts`
- [ ] `src/app/api/ai/prompts/route.ts`
- [ ] `src/app/api/ai/prompts/[scene]/route.ts`
- [ ] `src/app/api/ai/prompts/[scene]/reset/route.ts`
- [ ] `src/lib/validations/ai.ts`

### 修改文件
- [ ] `prisma/schema.prisma`
- [ ] `src/app/(dashboard)/settings/layout.tsx`
- [ ] `src/app/(dashboard)/settings/ai/page.tsx`
- [ ] `src/lib/ai/server/client.ts`
- [ ] `src/lib/ai/server/content-scorer.ts`
- [ ] `src/lib/ai/server/summary-generator.ts`
- [ ] `src/lib/ai/server/weekly-organizer.ts`
- [ ] `.env.example`
