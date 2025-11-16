# 结构化预览迁移指南

## 概述

本次重构将草稿和周刊的预览从 Markdown 字符串渲染改为结构化数据渲染，提供更统一、美观的预览体验。

## 已完成的改动

### 1. 数据库 Schema 更新

在 `contents` 表中新增了两个字段：

- `image_url` (VARCHAR 500): 文章主图 URL
- `summary` (TEXT): 内容摘要/AI 总结

这些字段与 `drafts` 表对齐，便于草稿转正式内容时的数据映射。

**SQL 迁移文件**: `database/add_content_preview_fields.sql`

### 2. 新增结构化预览组件

创建了 `src/components/content/StructuredPreview.tsx` 组件：

- 接收结构化数据（title, url, image_url, summary, tags 等）
- 提供统一的视觉模板（基于 Ant Design）
- 支持 desktop/mobile 两种显示模式
- **向后兼容**：如果没有结构化字段，会自动从 `content` 字段（Markdown）中提取

### 3. 草稿预览改造

更新了 `src/components/drafts/DraftList.tsx`：

- 从 `MarkdownPreview` 切换到 `StructuredPreview`
- 直接传入草稿的结构化字段
- 保持 AI 标签提示功能

### 4. 周刊预览改造

更新了 `src/app/(dashboard)/weekly/preview/[id]/page.tsx`：

- 使用 `StructuredPreview` 组件替代 ReactMarkdown
- 每个内容项都用结构化模板渲染
- 保持现有的分享/打印/导出功能

### 5. API 更新

周刊详情 API (`/api/weekly/:id`) 已自动包含新增的 `image_url` 和 `summary` 字段。

### 6. 草稿转内容逻辑

更新了 `src/app/api/drafts/[id]/convert/route.ts`：

- 直接映射草稿的 `image_url` 和 `summary` 字段到内容表
- 同时保留 `content` 字段（Markdown）以确保向后兼容

### 7. 数据迁移脚本

创建了 `scripts/migrate-content-to-structured.ts`：

- 从现有 `content` 字段（Markdown）中提取 `image_url` 和 `summary`
- 支持 `--dry-run` 模式预览迁移效果
- 提供详细的进度日志

## 执行数据迁移

### 步骤 1: 执行数据库 Schema 变更

```bash
# 连接到 NAS MySQL 数据库
sshpass -p "mp199213" ssh nas 'echo "mp199213" | sudo -S docker exec mysql mysql -uweekly_user -pweekly_20250629_@NAS weekly_blog < /path/to/add_content_preview_fields.sql'

# 或者手动执行 SQL
mysql -h100.113.231.101 -uweekly_user -pweekly_20250629_@NAS weekly_blog < database/add_content_preview_fields.sql
```

### 步骤 2: 预览数据迁移

```bash
pnpm tsx scripts/migrate-content-to-structured.ts --dry-run
```

这会显示将要迁移的数据，但不会实际修改数据库。

### 步骤 3: 执行数据迁移

确认预览结果无误后，执行实际迁移：

```bash
pnpm tsx scripts/migrate-content-to-structured.ts
```

## 向后兼容性

本次重构完全向后兼容：

1. **前端渲染逻辑**：
   - **新版数据**（有 `image_url` 或 `summary`）：使用 `StructuredPreview` 组件，简洁预览
   - **旧版数据**（无结构化字段）：使用 `MarkdownPreview` 组件，完整 Markdown 渲染
   - 周刊预览页面会自动判断使用哪种渲染方式

2. **数据保留**：
   - 原 `content` 字段（Markdown）保持不变
   - 新字段 `image_url` 和 `summary` 是可选的（nullable）
   - Blog 类型（content_type_id = 4）不进行结构化拆分，保持完整 Markdown

3. **草稿转内容**：
   - 新转换的内容会同时填充结构化字段和 Markdown 字段
   - 确保新旧系统都能正常工作

4. **特殊处理**：
   - **Blog 内容**：完整的文章，使用 `MarkdownPreview` 完整渲染
   - **Weekly 内容**：
     - 旧版（多个 ### 段落）：使用 `MarkdownPreview` 渲染
     - 新版（结构化字段）：使用 `StructuredPreview` 简洁预览

## 测试建议

### 1. 草稿预览测试

- 打开草稿列表页面
- 点击"预览"按钮查看草稿
- 验证显示效果（标题、图片、摘要、标签等）

### 2. 周刊预览测试

- 打开周刊编辑页面
- 点击"预览"按钮
- 验证周刊内容的显示效果
- 测试分享、打印功能

### 3. 数据兼容性测试

- 查看迁移前的历史周刊，确认显示正常
- 创建新草稿，验证预览效果
- 将草稿转为内容，验证数据映射正确

### 4. 移动端测试

- 在移动设备或浏览器开发者工具中测试
- 验证响应式布局
- 确认图片懒加载正常

## 后续优化

1. **完全移除 Markdown 依赖**：
   - 当所有数据都迁移完成后，可以考虑完全移除 `content` 字段的 Markdown 生成逻辑
   - 只保留结构化字段

2. **富文本编辑器**：
   - 可以考虑引入富文本编辑器，直接编辑结构化内容
   - 提供更好的编辑体验

3. **预览模板定制**：
   - 支持多种预览模板（简洁版、详细版等）
   - 允许用户自定义预览样式

## 注意事项

- 迁移脚本会跳过已经有 `image_url` 和 `summary` 的记录
- 如果 Markdown 内容中没有图片，`image_url` 会保持为 null
- 摘要长度限制为 500 字符，超出部分会被截断
- 数据迁移不会影响原 `content` 字段，确保安全

## 问题排查

### 预览显示不正常

1. 检查 API 返回的数据是否包含 `image_url` 和 `summary`
2. 查看浏览器控制台是否有错误
3. 确认 `StructuredPreview` 组件的 props 是否正确传递

### 数据迁移失败

1. 检查数据库连接是否正常
2. 确认 `contents` 表已添加新字段
3. 查看迁移脚本的错误日志

### 图片加载失败

1. 检查图片 URL 是否有效
2. 确认图片服务器的 CORS 设置
3. 验证图片懒加载配置

## 相关文件

- Schema: `prisma/schema.prisma`
- SQL 迁移: `database/add_content_preview_fields.sql`
- 预览组件: `src/components/content/StructuredPreview.tsx`
- 草稿预览: `src/components/drafts/DraftList.tsx`
- 周刊预览: `src/app/(dashboard)/weekly/preview/[id]/page.tsx`
- 迁移脚本: `scripts/migrate-content-to-structured.ts`
- 草稿转换: `src/app/api/drafts/[id]/convert/route.ts`




