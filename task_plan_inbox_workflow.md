# 收件箱工作流优化 - 任务计划

> 基于设计文档: `docs/plans/2026-01-29-inbox-workflow-optimization-design.md`

## 目标

在保证周刊质量的前提下，降低人工处理时间。预期收件箱处理时间减少 50-70%。

## 现有基础设施

| 模块 | 状态 | 说明 |
|------|------|------|
| `inbox_items` 表 | ✅ 已有 | 已有 `ai_score`, `category_suggestion`, `tags_suggestion` 字段 |
| `data_sources` 表 | ✅ 已有 | 缺少质量追踪字段 |
| AI 评分服务 | ✅ 已有 | `src/lib/ai/server/inbox-scorer.ts` |
| 收件箱页面 | ✅ 已有 | `src/app/(dashboard)/inbox/page.tsx` |
| 数据源页面 | ✅ 已有 | `src/app/(dashboard)/sources/page.tsx` |
| 批量操作 API | ✅ 已有 | 支持 reject/mark_duplicate/mark_pending |

---

## Phase 1: P0 - 批量审核界面优化 (核心)

**目标**: 实现高效的批量审核交互，高分内容默认勾选，一键批量晋升

### Task 1.1: 批量晋升 API
- [ ] **文件**: `src/app/api/inbox/batch-promote/route.ts` (新建)
- [ ] **功能**:
  - 接收 `ids: string[]` 数组
  - 循环调用 `InboxService.promoteInboxItem`
  - 返回成功/失败统计
- [ ] **依赖**: 无

### Task 1.2: 批量晋升 Hook
- [ ] **文件**: `src/hooks/queries/useInboxQueries.ts`
- [ ] **功能**:
  - 新增 `useInboxBatchPromote` mutation
  - 调用 `/api/inbox/batch-promote`
  - 成功后 invalidate inbox list
- [ ] **依赖**: Task 1.1

### Task 1.3: 收件箱页面 - 智能默认选中
- [ ] **文件**: `src/app/(dashboard)/inbox/page.tsx`
- [ ] **功能**:
  - 加载列表后，自动勾选 `ai_score >= 70` 且 `status === 'pending'` 的项
  - 添加「智能选中」按钮，点击后按评分阈值自动勾选
  - 显示 AI 建议标签（如「高质量，建议晋升」）
- [ ] **依赖**: 无

### Task 1.4: 收件箱页面 - 批量晋升按钮
- [ ] **文件**: `src/app/(dashboard)/inbox/page.tsx`
- [ ] **功能**:
  - 添加「批量晋升」按钮
  - 调用 `useInboxBatchPromote`
  - 显示晋升结果（成功 N 条，失败 M 条）
- [ ] **依赖**: Task 1.2, Task 1.3

### Task 1.5: 收件箱页面 - 详情展开
- [ ] **文件**: `src/app/(dashboard)/inbox/page.tsx`
- [ ] **功能**:
  - 点击行可展开查看详情
  - 展开区域显示：摘要、AI 建议分类/标签、疑似重复提示
  - 可在展开区域修改分类/标签后再晋升
- [ ] **依赖**: Task 1.3

---

## Phase 2: P1 - AI 预评分增强

**目标**: 提升 AI 评分的准确性和信息量

### Task 2.1: 数据库 - inbox_items 新增字段
- [ ] **文件**: `prisma/schema.prisma`
- [ ] **变更**:
  ```prisma
  ai_score_details   Json?      // AI 评分明细 {source: 30, completeness: 25, timeliness: 20}
  similar_item_id    BigInt?    // 疑似重复的目标项 ID
  similarity_score   Float?     // 相似度分数 (0-1)
  image_status       String?    // 'ok' | 'needs_crop' | 'missing'
  ```
- [ ] **依赖**: 无

### Task 2.2: AI 评分服务 - 评分明细
- [ ] **文件**: `src/lib/ai/server/inbox-scorer.ts`
- [ ] **功能**:
  - 修改评分逻辑，返回明细分数
  - 来源可信度分（基于 data_source 历史入选率）
  - 内容完整度分（标题、摘要、正文长度）
  - 时效性分（发布时间距今）
  - 存储到 `ai_score_details` 字段
- [ ] **依赖**: Task 2.1

### Task 2.3: 相似度检测服务
- [ ] **文件**: `src/lib/services/inbox-deduplicator.ts` (新建)
- [ ] **功能**:
  - 基于标题相似度检测（Levenshtein / Jaccard）
  - 检测到相似时，更新 `similar_item_id` 和 `similarity_score`
  - 在同步时自动执行
- [ ] **依赖**: Task 2.1

### Task 2.4: 同步时自动执行 AI 预处理
- [ ] **文件**: `src/lib/services/sync-orchestrator.ts`
- [ ] **功能**:
  - 同步完成后，自动对新条目执行：
    - AI 评分
    - 相似度检测
    - 图片状态检测
  - 可配置是否自动执行（避免 API 成本）
- [ ] **依赖**: Task 2.2, Task 2.3

---

## Phase 3: P1 - 截图处理优化

**目标**: 统一裁剪 + 占位图兜底

### Task 3.1: 图片状态检测
- [ ] **文件**: `src/lib/services/image-processor.ts` (新建)
- [ ] **功能**:
  - 检测图片 URL 是否有效
  - 获取图片尺寸
  - 判断是否符合目标比例（16:9）
  - 返回状态：'ok' | 'needs_crop' | 'missing'
- [ ] **依赖**: Task 2.1

### Task 3.2: 图片裁剪组件
- [ ] **文件**: `src/components/inbox/image-cropper.tsx` (新建)
- [ ] **功能**:
  - 基于 `react-image-crop` 或类似库
  - 固定 16:9 比例
  - 用户拖动选择裁剪区域
  - 输出裁剪后的图片（base64 或上传到 OSS）
- [ ] **依赖**: 无

### Task 3.3: 图片裁剪 API
- [ ] **文件**: `src/app/api/inbox/[id]/crop-image/route.ts` (新建)
- [ ] **功能**:
  - 接收裁剪参数（x, y, width, height）
  - 服务端裁剪图片
  - 上传到 OSS 并更新 `image_url`
  - 更新 `image_status` 为 'ok'
- [ ] **依赖**: Task 3.1

### Task 3.4: 占位图系统
- [ ] **文件**: `src/lib/services/placeholder-image.ts` (新建)
- [ ] **功能**:
  - 按分类返回预设占位图 URL
  - 分类映射：前端→蓝色、后端→绿色、工具→橙色、其他→灰色
- [ ] **依赖**: 无

### Task 3.5: 占位图资源
- [ ] **文件**: `public/placeholders/` (新建目录)
- [ ] **功能**:
  - 创建 4 张分类占位图（800x450, 16:9）
  - frontend.svg / backend.svg / tools.svg / default.svg
- [ ] **依赖**: 无

### Task 3.6: 收件箱页面 - 截图状态显示
- [ ] **文件**: `src/app/(dashboard)/inbox/page.tsx`
- [ ] **功能**:
  - 显示截图状态图标：✓图片OK / ⚠️待裁剪 / 📷无图
  - 「待裁剪」显示裁剪按钮
  - 「无图」显示上传/使用占位图按钮
- [ ] **依赖**: Task 3.2, Task 3.4

---

## Phase 4: P2 - RSS 源质量管理

**目标**: 追踪源质量，减少低质量内容噪音

### Task 4.1: 数据库 - data_sources 新增字段
- [ ] **文件**: `prisma/schema.prisma`
- [ ] **变更**:
  ```prisma
  score_weight      Int?       @default(0)  // AI 评分加权值
  total_synced      Int?       @default(0)  // 总抓取数
  total_promoted    Int?       @default(0)  // 晋升数
  total_published   Int?       @default(0)  // 入刊数
  ```
- [ ] **依赖**: 无

### Task 4.2: 源质量统计服务
- [ ] **文件**: `src/lib/services/data-source.ts`
- [ ] **功能**:
  - 新增 `updateSourceStats` 方法
  - 计算入选率 = total_promoted / total_synced
  - 计算入刊率 = total_published / total_promoted
- [ ] **依赖**: Task 4.1

### Task 4.3: 晋升时更新源统计
- [ ] **文件**: `src/lib/services/inbox.ts`
- [ ] **功能**:
  - `promoteInboxItem` 成功后，增加源的 `total_promoted`
- [ ] **依赖**: Task 4.2

### Task 4.4: 发布时更新源统计
- [ ] **文件**: `src/lib/services/quail.ts` (或周刊发布相关)
- [ ] **功能**:
  - 周刊发布成功后，统计各源的入刊数
  - 更新 `total_published`
- [ ] **依赖**: Task 4.2

### Task 4.5: AI 评分加权
- [ ] **文件**: `src/lib/ai/server/inbox-scorer.ts`
- [ ] **功能**:
  - 评分时读取源的 `score_weight`
  - 最终分数 = AI 原始分 + score_weight
  - 上限 100 分
- [ ] **依赖**: Task 4.1

### Task 4.6: 数据源页面 - 质量统计显示
- [ ] **文件**: `src/app/(dashboard)/sources/page.tsx`
- [ ] **功能**:
  - 表格新增列：入选率、入刊率
  - 低入选率（<10%）显示警告图标
  - 点击可配置 score_weight
- [ ] **依赖**: Task 4.2

### Task 4.7: 数据源配置弹窗
- [ ] **文件**: `src/components/sources/source-config-dialog.tsx` (新建)
- [ ] **功能**:
  - 配置默认分类
  - 配置默认标签
  - 配置 AI 评分加权
  - 配置聚合源模式
  - 配置同步频率
- [ ] **依赖**: Task 4.1

---

## Phase 5: 清理与优化

### Task 5.1: 移除自动晋升逻辑
- [ ] **文件**: `src/lib/services/inbox.ts`, `src/lib/services/sync-orchestrator.ts`
- [ ] **功能**:
  - 移除 `auto_promote_threshold` 相关逻辑
  - 移除 `auto_promoted` 字段的自动设置
  - 保留字段但不再使用（向后兼容）
- [ ] **依赖**: Phase 1 完成后

### Task 5.2: 数据库迁移脚本
- [ ] **文件**: `scripts/migrate-inbox-workflow.ts` (新建)
- [ ] **功能**:
  - 执行 Prisma 迁移
  - 回填现有数据的 `image_status`
  - 初始化 `data_sources` 的统计字段
- [ ] **依赖**: Task 2.1, Task 4.1

---

## 实施顺序

```
Week 1: Phase 1 (P0 批量审核)
├── Task 1.1 → Task 1.2 → Task 1.4
└── Task 1.3 → Task 1.5

Week 2: Phase 2 (P1 AI 预评分)
├── Task 2.1 (DB 变更)
├── Task 2.2, Task 2.3 (并行)
└── Task 2.4

Week 3: Phase 3 (P1 截图处理)
├── Task 3.1, Task 3.4, Task 3.5 (并行)
├── Task 3.2 → Task 3.3
└── Task 3.6

Week 4: Phase 4 (P2 源质量管理)
├── Task 4.1 (DB 变更)
├── Task 4.2 → Task 4.3, Task 4.4, Task 4.5 (并行)
└── Task 4.6 → Task 4.7

Week 5: Phase 5 (清理)
├── Task 5.1
└── Task 5.2
```

---

## 风险与注意事项

1. **API 成本**: AI 评分和相似度检测会产生 API 调用成本，需要可配置开关
2. **图片处理**: 服务端裁剪需要 sharp 或类似库，注意内存占用
3. **向后兼容**: 保留 `auto_promoted` 字段，避免破坏现有数据
4. **性能**: 批量晋升时注意事务和并发控制

---

## 验收标准

- [ ] 批量审核：可一键晋升 10+ 条高分内容
- [ ] AI 评分：评分明细可见，相似度检测准确率 > 80%
- [ ] 截图处理：裁剪功能可用，占位图正确显示
- [ ] 源质量：入选率/入刊率统计准确，加权生效
