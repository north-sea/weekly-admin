# 设计决策记录 (Architecture Decision Records)

**版本**: v1.0  
**最后更新**: 2025年1月  

---

## 概述

本文档记录了 Weekly 系统重构过程中的关键设计决策，包括决策背景、考虑的方案、最终选择以及理由。

---

## ADR-001: 内容编辑器的格式检测与手动切换

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: 开发团队  

### 背景

Weekly 内容格式经历了三个演化阶段：
1. **早期**: 周刊内容存储为 Markdown 文件
2. **中期**: 博客和周刊都存储在数据库中，`content` 字段为 Markdown 字符串
3. **当前**: 新版周刊使用结构化数据（JSON），但旧内容仍为 Markdown

这导致编辑器需要同时支持两种格式，如何提供良好的编辑体验成为关键问题。

### 考虑的方案

#### 方案 A: 强制迁移所有旧内容到新格式
**优点**:
- 统一数据格式
- 简化代码逻辑
- 避免格式检测开销

**缺点**:
- 需要批量数据迁移，风险高
- Markdown 转 JSON 可能丢失信息
- 无法回退到旧格式
- 迁移失败影响线上服务

#### 方案 B: 自动检测格式，无法手动切换
**优点**:
- 对用户透明
- 自动化程度高

**缺点**:
- 用户无法选择偏好的编辑模式
- 格式检测可能出错
- 缺乏灵活性

#### 方案 C: 自动检测 + 手动切换（最终选择）
**优点**:
- 兼容新老数据
- 用户可自主选择编辑模式
- 支持渐进式迁移
- 灵活性强

**缺点**:
- 需要同时维护两套编辑器UI
- 格式切换逻辑稍复杂

### 最终决策

**选择方案 C**: 自动检测 + 手动切换

#### 实现细节

1. **初始化时自动检测**:
   ```typescript
   const [editMode, setEditMode] = useState<EditMode>(() => {
     const initialContent = initialValues?.content || '';
     const detectedFormat = ContentFormatAdapter.detectFormat(initialContent);
     return detectedFormat === 'markdown' ? 'markdown' : 'structured';
   });
   ```

2. **提供手动切换按钮**:
   - 工具栏中显示当前模式
   - 点击可切换 Markdown ⇄ 结构化模式
   - 提示文案帮助用户理解两种模式的差异

3. **编辑模式差异**:
   - **Markdown 模式**: 使用 `@uiw/react-md-editor`，适合长文和旧内容
   - **结构化模式**: 使用简单 Textarea，适合新版周刊的简洁内容

4. **预览保持一致**:
   - Blog: 始终使用 MarkdownPreview（完整渲染）
   - Weekly: 始终使用 StructuredPreview（卡片式），不论编辑模式

### 好处

1. **向后兼容**: 旧内容可以继续用 Markdown 编辑
2. **灵活性**: 用户可根据需求选择合适的编辑模式
3. **渐进式迁移**: 不强制迁移，新内容可以使用新格式
4. **降低风险**: 避免批量数据迁移的风险
5. **用户体验**: 编辑器自动识别格式，减少用户困惑

### 相关文件

- `src/components/content/simplified-editor.tsx`
- `src/lib/utils/format-adapter.ts`
- `src/app/(dashboard)/content/[id]/page.tsx`

---

## ADR-002: 内容预览组件的统一渲染逻辑

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: 开发团队  

### 背景

系统中存在多个预览组件：
- `MarkdownPreview.tsx` - 使用 Ant Design 组件，渲染 Markdown
- `StructuredPreview.tsx` - 使用 Ant Design 组件，渲染结构化数据
- 预览逻辑分散在不同页面中，难以维护

在 shadcn/ui 迁移过程中，需要重新设计预览组件。

### 考虑的方案

#### 方案 A: 保留两个独立组件
**优点**:
- 保持现有逻辑
- 改动最小

**缺点**:
- 组件重复
- 维护成本高
- 使用时需要判断用哪个组件

#### 方案 B: 创建统一的 ContentPreview 组件（最终选择）
**优点**:
- 单一入口，易于维护
- 自动检测格式并选择渲染方式
- 统一样式和交互
- 符合 DRY 原则

**缺点**:
- 组件内部逻辑稍复杂

### 最终决策

**选择方案 B**: 创建统一的 `ContentPreview` 组件

#### 实现特点

1. **自动格式检测**:
   ```typescript
   const detectedFormat = useMemo(() => {
     return ContentFormatAdapter.detectFormat(content.content);
   }, [content.content]);
   ```

2. **根据内容类型和格式选择渲染器**:
   - Blog (content_type.id === 4): 使用 `renderBlogPreview()`
   - Weekly + JSON 格式: 使用 `renderWeeklyStructuredPreview()`
   - Weekly + Markdown 格式: 使用 `renderWeeklyMarkdownPreview()`

3. **使用 shadcn/ui 组件**:
   - 移除 Ant Design 依赖
   - 使用 Badge, Card, Separator 等 shadcn 组件
   - 使用 Lucide React 图标

4. **支持多种预览模式**:
   - `mode: 'desktop' | 'mobile'` - 响应式预览
   - `showMeta: boolean` - 控制是否显示元信息
   - 通过 CSS 调整移动端样式

5. **优化排版**:
   - 自定义 ReactMarkdown 渲染组件
   - 优化标题、段落、列表、代码块样式
   - 支持语法高亮（rehype-highlight）
   - 图片自适应和懒加载

### 好处

1. **统一接口**: 一个组件适配所有场景
2. **自动化**: 无需手动判断格式
3. **可维护性**: 样式和逻辑集中管理
4. **现代化**: 使用 shadcn/ui，符合新设计系统
5. **性能优化**: 使用 useMemo 缓存计算结果

### 使用示例

```typescript
<ContentPreview
  content={content}
  mode="desktop"
  showMeta={true}
/>
```

### 相关文件

- `src/components/content/content-preview.tsx`
- `src/app/(dashboard)/content/preview/[id]/page.tsx`
- `src/lib/utils/format-adapter.ts`

---

## ADR-003: 内容预览页面的工具栏设计

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: 开发团队  

### 背景

内容预览页面需要提供多种功能：
- 返回编辑页
- 分享链接
- 打印
- 导出 PDF
- 切换预览模式（桌面/移动端）

如何设计工具栏以提供良好的用户体验是关键。

### 设计决策

#### 1. Sticky 工具栏
- 固定在顶部 (`position: sticky`)
- 始终可见，方便用户操作
- 毛玻璃效果 (`backdrop-blur`)，现代感强

#### 2. 响应式布局
- 桌面端: 显示完整按钮文字
- 移动端: 仅显示图标 (`hidden sm:inline`)

#### 3. 预览模式切换
- 使用圆角按钮组 (`rounded-lg` + `p-1`)
- 视觉上突出当前选中模式
- 图标: Monitor（桌面） / Smartphone（移动）

#### 4. 打印优化
- 工具栏添加 `print:hidden` 类
- 打印时隐藏工具栏和装饰元素
- 确保内容适合打印页面
- 添加打印专用 CSS

### 实现细节

```tsx
<div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b print:hidden">
  <div className="container mx-auto px-4 py-3">
    <div className="flex items-center justify-between">
      {/* 左侧：返回按钮 */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回
      </Button>

      {/* 右侧：功能按钮组 */}
      <div className="flex items-center gap-2">
        {/* 预览模式切换 */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button variant={mode === 'desktop' ? 'default' : 'ghost'}>
            <Monitor className="h-4 w-4" />
          </Button>
          <Button variant={mode === 'mobile' ? 'default' : 'ghost'}>
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        {/* 分享、打印、导出 */}
        <Button onClick={handleShare}>分享</Button>
        <Button onClick={handlePrint}>打印</Button>
        <Button onClick={handleExportPDF}>导出 PDF</Button>
      </div>
    </div>
  </div>
</div>
```

### 好处

1. **易用性**: 功能触手可及
2. **现代化**: 毛玻璃效果提升视觉体验
3. **响应式**: 适配不同屏幕尺寸
4. **打印友好**: 打印时自动隐藏工具栏

### 相关文件

- `src/app/(dashboard)/content/preview/[id]/page.tsx`

---

## ADR-004: 使用 React Query Hooks 替代 Service 类

**日期**: 2025-01  
**状态**: ✅ 已实施  
**决策者**: 开发团队  

### 背景

旧代码使用 Service 类（如 `ContentService`）直接调用 API，存在以下问题：
- 缺乏缓存管理
- 无法自动重新请求
- 加载状态需要手动维护
- 难以实现乐观更新

### 最终决策

**使用 React Query Hooks**: `useContentDetail`, `useUpdateContent` 等

#### 优势

1. **自动缓存**: 减少重复请求
2. **状态管理**: 自动处理 loading, error, data
3. **乐观更新**: 立即更新 UI，提升体验
4. **失败重试**: 自动重试失败的请求
5. **缓存失效**: 自动刷新过期数据

#### 使用示例

```typescript
// 旧方式
const [content, setContent] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  ContentService.getContentById(id).then(setContent).finally(() => setLoading(false));
}, [id]);

// 新方式
const { data: content, isLoading } = useContentDetail(id);
```

### 好处

1. **代码量减少**: 无需手动管理状态
2. **性能优化**: 智能缓存策略
3. **用户体验**: 加载状态更流畅
4. **可维护性**: 集中管理 API 调用

### 相关文件

- `src/hooks/queries/useContentQueries.ts`
- `src/app/(dashboard)/content/preview/[id]/page.tsx`

---

## 附录

### 文档更新流程

1. 每次重大技术决策前，评估多个方案
2. 记录决策背景、考虑的方案、最终选择和理由
3. 在本文档中添加新的 ADR 条目
4. 更新相关的技术文档和代码注释

### 参考资料

- [ADR (Architecture Decision Records) 最佳实践](https://adr.github.io/)
- [React Query 最佳实践](https://tanstack.com/query/latest)
- [shadcn/ui 设计系统](https://ui.shadcn.com/)

---

> **维护人**: 开发团队  
> **最后更新**: 2025年1月
