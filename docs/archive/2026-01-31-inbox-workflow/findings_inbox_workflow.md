# 收件箱工作流优化 - 发现记录

## 现有代码分析

### 1. 数据库结构

**inbox_items 表** (已有字段):
- `ai_score` Float - AI 评分 (0-100)
- `category_suggestion` String - 分类建议
- `tags_suggestion` Json - 标签建议
- `duplicate_of_id` BigInt - 重复项关联
- `summarization_status` String - 摘要状态
- `tagging_status` String - 标签状态

**data_sources 表** (已有字段):
- `auto_promote_threshold` Float - 自动晋升阈值（设计中要移除）
- `sync_count` Int - 同步次数
- `error_count` Int - 错误次数

### 2. 现有服务

**InboxService** (`src/lib/services/inbox.ts`):
- `getInboxList` - 支持 ai_score_min 筛选
- `promoteInboxItem` - 单条晋升，已支持 Karakeep 双向同步
- `batchAction` - 批量操作（reject/mark_duplicate/mark_pending）
- **缺失**: 批量晋升功能

**inbox-scorer** (`src/lib/ai/server/inbox-scorer.ts`):
- `scoreInboxItem` - 单条评分
- `batchScoreInboxItems` - 批量评分
- 使用 `summary_score` prompt
- Karakeep 爬取失败自动 0 分
- **缺失**: 评分明细、来源加权

**DataSourceService** (`src/lib/services/data-source.ts`):
- CRUD 操作
- **缺失**: 质量统计方法

### 3. 现有页面

**收件箱页面** (`src/app/(dashboard)/inbox/page.tsx`):
- 已有评分筛选（≥80/70/60/50/0）
- 已有批量操作按钮
- 已有 AI 评分按钮
- **缺失**: 智能默认选中、批量晋升、详情展开、截图状态

**数据源页面** (`src/app/(dashboard)/sources/page.tsx`):
- 已有 CRUD 和同步功能
- **缺失**: 质量统计显示、配置弹窗

### 4. 关键发现

1. **批量晋升是核心缺失功能**
   - 现有 `batchAction` 只支持状态变更
   - 需要新增 `batchPromote` 方法

2. **AI 评分已有基础**
   - 评分逻辑已实现
   - 需要增强：评分明细、来源加权

3. **相似度检测需新建**
   - 现有 `duplicate_of_id` 字段可复用
   - 需要实现标题相似度算法

4. **图片处理需新建**
   - 现有 `image_url` 字段
   - 需要新增 `image_status` 字段和处理逻辑

5. **源质量追踪需新建**
   - 需要新增统计字段
   - 需要在晋升/发布时更新统计

---

## 技术决策

### 图片裁剪方案

**选项 A**: 前端裁剪 + 上传
- 优点：减少服务端负载
- 缺点：需要处理大图片上传

**选项 B**: 服务端裁剪
- 优点：统一处理，支持 URL 图片
- 缺点：需要 sharp 库，内存占用

**决定**: 采用 **选项 B**，因为需要处理远程 URL 图片

### 相似度算法

**选项 A**: Levenshtein 距离
- 优点：简单，适合短文本
- 缺点：对词序敏感

**选项 B**: Jaccard 相似度
- 优点：对词序不敏感
- 缺点：需要分词

**选项 C**: 向量相似度 (Embedding)
- 优点：语义理解
- 缺点：需要 API 调用，成本高

**决定**: 采用 **选项 A + B 组合**，先 Jaccard 粗筛，再 Levenshtein 精确匹配

---

## 已确认决策

1. **图片上传**: 使用项目已有的图床配置
2. **占位图**: 直接生成几个默认的静态图片
3. **相似度阈值**: 支持配置，默认 0.8
4. **AI 评分加权**: 上限 ±20
