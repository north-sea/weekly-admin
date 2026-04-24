# 收件箱自动评分设计

**日期**: 2026-02-01

## 背景

当前收件箱评分功能存在以下问题：
1. 同步数据后不会自动评分，需要手动点击"AI评分"按钮
2. 缺少全局配置和数据源级别的控制
3. 时间字段不够清晰，Karakeep 来源需要展示收藏时间

## 设计目标

1. 同步后自动对新条目进行 AI 评分
2. 支持全局默认设置 + 数据源级别覆盖
3. 统一收件箱的时间排序字段

## 数据模型

### 1. 新建 `ai_settings` 表

```prisma
model ai_settings {
  key        String    @id @db.VarChar(100)
  value      Json
  updated_at DateTime? @default(now()) @db.Timestamp(0)
}
```

**初始配置项**：
- `auto_score_on_sync`: `{ enabled: true }` - 同步后自动评分（全局默认）

### 2. 扩展 `data_sources` 表

新增字段：
- `auto_score_override`: `Boolean?` - 自动评分覆盖设置
  - `null`: 使用全局设置
  - `true`: 强制开启
  - `false`: 强制关闭

### 3. 扩展 `inbox_items` 表

新增字段：
- `collected_at`: `DateTime?` - 统一的收集时间

| 来源 | `collected_at` 的值 |
|------|---------------------|
| Karakeep | `bookmark.createdAt`（收藏时间） |
| RSS | 首次同步时间（即首次入库时间） |

## 评分触发逻辑

```
同步数据源
    ↓
写入新条目（ai_score = null）
    ↓
检查是否需要自动评分：
  1. 数据源有 auto_score_override？→ 使用该值
  2. 否则 → 读取 ai_settings.auto_score_on_sync
    ↓
如果启用 → 对本次新增的条目执行评分
    ↓
返回同步结果（含评分统计）
```

**关键点**：
- 只评分本次新增的条目（`ai_score = null`）
- 已有评分的条目不会重复评分
- 内容变化时保留原评分（不自动重新评分）
- 评分失败不影响同步结果（记录错误但不中断）

## UI 变更

### 1. AI 设置页面

新增"自动化设置"卡片：
- **同步后自动评分**：全局开关（默认开启）
- 说明文字：启用后，新同步的收件箱条目会自动进行 AI 评分

### 2. 数据源列表页面

新增自动评分状态显示：

| 状态 | 显示 |
|------|------|
| `auto_score_override = null` | Badge: "跟随全局"（灰色） |
| `auto_score_override = true` | Badge: "开启"（绿色） |
| `auto_score_override = false` | Badge: "关闭"（红色） |

### 3. 数据源配置对话框

新增自动评分设置：
- 三态选择器：跟随全局 / 开启 / 关闭

### 4. 收件箱页面

- 列表按 `collected_at DESC` 排序
- 时间列显示 `collected_at`（统一的收集时间）

## 实现步骤

### Phase 1: 数据库变更
- [ ] 新建 `ai_settings` 表
- [ ] `data_sources` 表添加 `auto_score_override` 字段
- [ ] `inbox_items` 表添加 `collected_at` 字段
- [ ] 运行数据库迁移
- [ ] 回填 `collected_at` 数据

### Phase 2: 后端服务
- [ ] 创建 `AiSettingsService`（读写全局设置）
- [ ] 创建 AI 设置 API 路由
- [ ] 修改 `SyncOrchestrator`（支持自动评分逻辑）
- [ ] 修改同步逻辑（正确设置 `collected_at` 和 `updated_at`）
- [ ] 更新数据源 API 支持 `auto_score_override`

### Phase 3: 前端 UI
- [ ] AI 设置页面添加"自动化设置"卡片
- [ ] 数据源列表显示自动评分状态
- [ ] 数据源配置对话框添加自动评分开关
- [ ] 收件箱列表按 `collected_at` 排序并显示

## 技术决策

| 决策 | 理由 |
|------|------|
| 全局设置存 `ai_settings` 表 | 复用 AI 设置页面，无需新建设置模块 |
| 数据源级别用 `null` 表示跟随全局 | 三态设计，灵活且语义清晰 |
| 内容变化不重新评分 | 避免不必要的 API 调用，用户可手动触发 |
| 统一 `collected_at` 字段 | 简化排序逻辑，一个字段满足所有来源 |
