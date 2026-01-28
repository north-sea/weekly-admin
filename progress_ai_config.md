# AI 配置系统 - 进度日志

## Session: 2026-01-25

### 14:00 - 需求分析完成

**完成事项：**
- [x] 分析现有代码结构
- [x] 识别多余路由问题
- [x] 梳理 AI 使用场景（6 处）
- [x] 确认需求细节

**用户确认的需求：**
1. 移除 settings 页面内的 Tab 导航
2. 每个 AI 功能独立 Prompt（带默认值）
3. API Key 只支持新增/更新，不显示
4. 支持多组 API 配置切换

### 14:15 - 方案设计完成

**选定方案：** 单表多配置 + 独立 Prompt 表

**数据库设计：**
- `ai_configs` - 多组 API 配置
- `ai_prompts` - 6 个场景的 Prompt 模板

**安全措施：**
- AES-256-GCM 加密 API Key
- 前端脱敏显示
- ADMIN 权限控制

### 14:30 - 计划文件生成

**生成文件：**
- `task_plan_ai_config.md` - 详细执行计划
- `findings_ai_config.md` - 研究发现
- `progress_ai_config.md` - 本文件

### 23:13 - Phase 1 完成（移除多余导航）

**完成事项：**
- [x] 移除 `src/app/(dashboard)/settings/layout.tsx` 中的 Tab 导航，仅保留 children 渲染

### 23:15 - Phase 2 完成（数据库表设计）

**完成事项：**
- [x] 在 `prisma/schema.prisma` 新增 `ai_configs` / `ai_prompts` 两张表及 provider 枚举（含 `text_model` / `image_model`）

### 23:16 - Phase 3 完成（加密工具）

**完成事项：**
- [x] 新增 `src/lib/crypto.ts`：AES-256-GCM 加解密 + API Key 脱敏展示

### 23:24 - Phase 4 完成（服务层实现）

**完成事项：**
- [x] 新增 `src/lib/services/ai-config.ts`：AI 配置 CRUD + 默认配置切换逻辑
- [x] 新增 `src/lib/services/ai-prompt.ts`：Prompt CRUD + 默认 Prompt 定义（含 `summary_score`）

### 23:28 - Phase 5 完成（API 路由）

**完成事项：**
- [x] 新增 AI Configs API：`/api/ai/configs` + `/api/ai/configs/:id/*`（含测试/设默认）
- [x] 新增 AI Prompts API：`/api/ai/prompts` + `/api/ai/prompts/:scene/*`（含重置）
- [x] 新增 `src/lib/validations/ai.ts`（zod schemas）

### 23:31 - Phase 6 完成（修改 AI Client）

**完成事项：**
- [x] `src/lib/ai/server/client.ts` 支持从数据库读取默认配置（可选 `configId`），并兼容环境变量回退
- [x] `/api/ai/config` 与 `/api/ai/image` 优先读取数据库默认配置（兼容旧页面/周刊编辑器）

### 23:35 - Phase 7 完成（前端页面重构）

**完成事项：**
- [x] 重写 `src/app/(dashboard)/settings/ai/page.tsx`：多组配置卡片管理 + Prompt 场景编辑 + 重置/保存

### 23:45 - Phase 8 完成（默认数据 / 落地）

**完成事项：**
- [x] AI 业务调用改为读取数据库 Prompt（`content_score` / `summary_generate` / `summary_optimize` / `summary_score` / `weekly_organize`）
- [x] 新增 Prompt 模板渲染器 `src/lib/ai/server/prompt-template.ts`（支持 `{{var}}` + `{{#var}}...{{/var}}`）
- [x] 更新 `scripts/migrate-db.ts`：创建 `ai_configs` / `ai_prompts` 表并插入默认 Prompt
- [x] 更新 `.env.example`：新增 `AI_ENCRYPTION_KEY`

### 23:48 - 本地环境已初始化

**完成事项：**
- [x] 已写入 `.env` 的 `AI_ENCRYPTION_KEY`（用于数据库加密存储 API Key）
- [x] 已执行 `pnpm db:migrate`：完成建表 + 默认 Prompt 写入（当前未检测到 AI Key，未自动创建默认 AI 配置记录）

---

## 待执行阶段

| Phase | 描述 | 状态 |
|-------|------|------|
| 1 | 移除多余导航 | completed |
| 2 | 数据库表设计 | completed |
| 3 | 加密工具 | completed |
| 4 | 服务层实现 | completed |
| 5 | API 路由 | completed |
| 6 | 修改 AI Client | completed |
| 7 | 前端页面重构 | completed |
| 8 | 初始化默认数据 | completed |

---

## 错误记录

| 时间 | 错误 | 解决方案 |
|------|------|----------|
| - | - | - |

---

## 测试记录

| 时间 | 测试项 | 结果 |
|------|--------|------|
| - | - | - |
