# 设计决策记录 (Architecture Decision Records)

本文档记录 Weekly 系统重构过程中的重要技术和产品决策。

---

## ADR-001: 内容编辑器根据类型差异化

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: AI Agent  

### 背景

系统支持两种内容类型：
1. **Blog** - 长文博客，使用 Markdown 格式
2. **Weekly** - 周刊推荐，使用结构化 JSON 格式

初始实现中，两种类型都使用了相同的 Markdown 编辑器，这对于 Weekly 来说并不合适。

### 问题

- Weekly 内容是结构化的推荐卡片（标题、来源、摘要、推荐理由等）
- 使用 Markdown 编辑器编辑 Weekly：
  - ❌ 不符合数据结构（JSON vs Markdown）
  - ❌ 编辑体验不直观
  - ❌ 难以保证数据格式一致性
  - ❌ 工具栏功能（加粗、斜体等）对简短摘要意义不大

### 决策

**根据内容类型显示不同的编辑界面：**

#### Blog (content_type_id = 4)
- ✅ 使用 **Markdown 编辑器** (`@uiw/react-md-editor`)
- ✅ 提供完整的 Markdown 工具栏（加粗、斜体、代码、链接、图片、列表等）
- ✅ 支持实时预览
- ✅ 适合长文自由创作

#### Weekly (content_type_id = 3)
- ✅ 使用 **结构化表单输入**（Textarea）
- ✅ 简洁的文本输入框，专注于核心内容描述
- ✅ 内容字段用于存储摘要或关键点（可使用简单 Markdown）
- ✅ 配合 Weekly 专用字段（来源、来源链接、推荐理由）形成完整的推荐卡片

### 实现

```typescript
// simplified-editor.tsx
{contentTypeId === 4 ? (
  // Blog: Markdown 编辑器
  <MDEditor
    value={field.value}
    onChange={(val) => field.onChange(val || '')}
    preview="edit"
    height={500}
  />
) : (
  // Weekly: 结构化输入
  <Textarea
    placeholder="请输入周刊内容的摘要或关键点"
    rows={8}
  />
)}
```

### 优势

1. **更符合数据模型**
   - Blog 存储自由格式的 Markdown
   - Weekly 存储结构化字段

2. **更好的用户体验**
   - Blog 编辑者获得强大的 Markdown 编辑能力
   - Weekly 编辑者获得简洁直观的表单界面

3. **数据一致性**
   - 避免 Weekly 内容格式混乱
   - 便于后续渲染和展示

4. **可扩展性**
   - 未来可以为 Weekly 添加更多结构化字段
   - 可以轻松支持其他内容类型

### 权衡

- **增加了代码复杂度**：需要根据类型渲染不同组件
- **解决方案**：使用条件渲染，保持代码清晰

### 相关代码

- `src/components/content/simplified-editor.tsx` - 编辑器实现
- `src/lib/utils/format-adapter.ts` - 格式适配器（兼容老数据）

### 未来考虑

1. 如果 Weekly 需要更丰富的格式，可以考虑：
   - 富文本编辑器（如 Tiptap）
   - 块编辑器（如 Editor.js）
   - 保持简洁的 Markdown 子集

2. 可以为 Weekly 添加更多结构化字段：
   - 标签（自动提取或手动添加）
   - 重要程度评分
   - 目标受众
   - 等等

---

## ADR-002: 操作日志 resource_id 使用 String 类型

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: AI Agent  

### 背景

原有的 `operation_logs.resource_id` 字段使用 `Int?` 类型，导致无法记录 BigInt 类型的 content_id。

### 决策

将 `resource_id` 改为 `String? @db.VarChar(50)`，支持：
- 数字 ID
- BigInt ID
- UUID
- 其他自定义 ID 格式

### 优势

- 灵活性高，支持各种 ID 类型
- 向后兼容（数字可转为字符串）
- 便于未来扩展

### 实现

```prisma
model operation_logs {
  resource_id String? @db.VarChar(50)
  @@index([resource_id])
}
```

---

## ADR-003: UI 库从 Ant Design 迁移到 shadcn/ui

**日期**: 2025-01  
**状态**: 🔵 进行中（阶段 1: 86% 完成）  
**决策者**: AI Agent  

### 背景

原系统使用 Ant Design Pro 作为主要 UI 库，但存在以下问题：
- 定制性较差
- 打包体积大
- 与 claude theme 风格不匹配

### 决策

迁移到 shadcn/ui + claude theme

### 优势

1. **完全可定制**：基于 Radix UI 原语
2. **按需引入**：只打包使用的组件
3. **主题统一**：完美支持 claude theme
4. **可访问性好**：Radix UI 内置 WAI-ARIA
5. **现代化**：符合最新设计趋势

### 迁移策略

**渐进式迁移**，不影响现有功能：
1. 新页面使用 shadcn/ui
2. 旧页面逐步迁移
3. 共存阶段保持两套 UI 库

### 已完成迁移

- ✅ 登录页
- ✅ 内容编辑页

### 待迁移

- [ ] 内容预览页
- [ ] 草稿管理页
- [ ] 周刊编辑页
- [ ] 仪表板
- [ ] 分析页面
- [ ] 设置页面

---

## ADR-004: 表单管理使用 react-hook-form + zod

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: AI Agent  

### 背景

原系统使用 Ant Design Form 管理表单，与 UI 库强绑定。

### 决策

使用 `react-hook-form` + `zod` 进行表单管理和验证

### 优势

1. **类型安全**：zod 提供运行时类型验证
2. **性能好**：减少不必要的重新渲染
3. **框架无关**：不依赖特定 UI 库
4. **开发体验好**：自动类型推导

### 示例

```typescript
const schema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
});

const { control, handleSubmit } = useForm({
  resolver: zodResolver(schema),
});
```

---

## ADR-005: ContentFormatAdapter 处理新老数据格式

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: AI Agent  

### 背景

系统数据格式演进：
- 老格式：Markdown 字符串
- 新格式：JSON 结构化数据

需要同时支持两种格式。

### 决策

创建 `ContentFormatAdapter` 适配器类，提供统一的检测、转换和渲染接口。

### 优势

1. **向后兼容**：老数据无需迁移即可使用
2. **渐进式**：可以逐步转换为新格式
3. **降低风险**：不需要一次性数据迁移
4. **易于回退**：出问题可以快速恢复

### 核心方法

```typescript
class ContentFormatAdapter {
  static detectFormat(content: string): ContentFormat;
  static toStructured(content: string): StructuredContent;
  static toMarkdown(structured: StructuredContent): string;
  static extractMetadata(content: string): ContentMetadata;
}
```

### 使用场景

- 编辑器：根据格式选择不同的编辑方式
- 预览：统一渲染新老格式
- 导出：转换为所需格式

---

## 模板

复制以下模板记录新的决策：

```markdown
## ADR-XXX: 决策标题

**日期**: YYYY-MM  
**状态**: ⚪️ 提议 / 🔵 进行中 / ✅ 已实施 / ❌ 已废弃  
**决策者**: 姓名  

### 背景

描述问题的背景和上下文。

### 问题

具体说明遇到的问题。

### 决策

描述做出的决策。

### 优势

列出这个决策的好处。

### 权衡

列出这个决策的代价或限制。

### 实现

关键代码示例或实现细节。

### 相关代码

列出相关的文件和代码位置。

### 未来考虑

可能的改进方向或替代方案。
```

---

> **维护说明**：
> - 所有重要的技术决策都应记录在此文档
> - 保持决策的可追溯性和透明性
> - 便于新成员了解系统设计的演进过程
