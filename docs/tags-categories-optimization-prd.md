# Product Requirements Document: 标签与分类管理优化

**Version**: 1.0
**Date**: 2026-01-31
**Author**: Sarah (Product Owner)
**Quality Score**: 92/100

---

## Executive Summary

当前周刊管理系统的标签和分类功能存在多个痛点：标签数量膨胀且命名混乱、分类层级结构不清晰、日常使用效率低下、缺乏智能辅助。这些问题导致内容管理者在打标签和选分类时耗费大量时间，且难以保持数据的一致性和规范性。

本次优化将从四个维度入手：**标签治理**（解决混乱问题）、**分类重构**（理顺层级关系）、**效率提升**（优化操作体验）、**智能推荐**（复用现有 AI 服务）。采用「先设计后实施、小步快跑」的策略，分三个阶段交付，确保每个阶段都能带来可感知的改进。

---

## Problem Statement

**Current Situation**:
- 标签存在大量同义词重复（如 React/ReactJS/react.js），缺乏分组机制，低频标签占用空间，命名风格不统一
- 分类层级深度不合理，部分分类互斥逻辑不清，排序依赖手动输入数字，废弃分类无法安全清理
- 给内容打标签/选分类时操作繁琐，缺少快捷方式和智能辅助
- 系统已有 AI 评分服务，但未应用于标签/分类推荐场景

**Proposed Solution**:
- 引入标签组和别名系统，提供 AI 辅助的相似标签检测和合并建议
- 优化分类树结构，支持拖拽排序和安全迁移，限制合理层级深度
- 增强选择器体验，支持常用置顶、最近使用、拼音搜索
- 复用现有 AI 服务，在内容编辑时提供标签和分类推荐

**Business Impact**:
- 减少内容管理者 30%+ 的标签/分类操作时间
- 提升标签数据质量，降低同义词重复率至 5% 以下
- 提高分类结构的可维护性，支持业务扩展

---

## Success Metrics

**Primary KPIs:**

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 标签同义词重复率 | < 5% | AI 检测相似标签数 / 总标签数 |
| 未使用标签占比 | < 10% | count=0 的标签数 / 总标签数 |
| 标签选择平均耗时 | 减少 30% | 用户行为埋点（可选） |
| AI 推荐采纳率 | > 60% | 推荐被采纳次数 / 推荐展示次数 |

**Validation**: 上线后 2 周内通过数据统计和用户反馈验证

---

## User Personas

### Primary: 内容编辑 (Editor)

- **Role**: 日常负责内容录入、编辑、发布的运营人员
- **Goals**: 快速准确地给内容打标签和选分类，保持数据规范
- **Pain Points**:
  - 标签太多找不到合适的，经常创建重复标签
  - 分类层级混乱，不确定该选哪个
  - 每次都要手动输入，效率低
- **Technical Level**: 中等，熟悉后台操作

### Secondary: 系统管理员 (Admin)

- **Role**: 负责标签和分类的整体规划与维护
- **Goals**: 保持标签/分类体系的整洁和可扩展性
- **Pain Points**:
  - 难以发现和清理重复/废弃的标签
  - 分类调整时担心影响已有内容
  - 缺乏数据洞察，不知道哪些标签/分类需要优化
- **Technical Level**: 高，理解数据结构

---

## User Stories & Acceptance Criteria

### Epic 1: 标签治理

#### Story 1.1: 标签分组管理

**As a** 系统管理员
**I want to** 将标签按类型分组（如：技术栈、主题、内容类型）
**So that** 标签体系更有组织性，便于查找和管理

**Acceptance Criteria:**
- [ ] 可创建、编辑、删除标签组
- [ ] 每个标签可归属于一个标签组（可选）
- [ ] 标签列表支持按组筛选
- [ ] 标签选择器按组分类展示

#### Story 1.2: 相似标签检测

**As a** 内容编辑
**I want to** 创建标签时系统自动检测是否已有相似标签
**So that** 避免创建重复标签

**Acceptance Criteria:**
- [ ] 输入标签名时实时检测相似标签（基于编辑距离 + AI 语义）
- [ ] 相似度 > 80% 时显示警告和已有标签建议
- [ ] 用户可选择使用已有标签或确认创建新标签
- [ ] 支持中英文、大小写的相似匹配

#### Story 1.3: 标签别名系统

**As a** 系统管理员
**I want to** 为标签设置别名（如 React 的别名：ReactJS, react.js）
**So that** 搜索时能匹配到正确的标签

**Acceptance Criteria:**
- [ ] 每个标签可设置多个别名
- [ ] 搜索标签时同时匹配名称和别名
- [ ] 别名不可与其他标签名称或别名重复
- [ ] 合并标签时自动将被合并标签名转为别名

#### Story 1.4: 智能标签合并建议

**As a** 系统管理员
**I want to** 系统自动分析并推荐可合并的相似标签
**So that** 定期清理标签体系

**Acceptance Criteria:**
- [ ] 提供「智能分析」按钮，调用 AI 分析所有标签
- [ ] 展示相似标签组列表，按相似度排序
- [ ] 支持一键合并或忽略建议
- [ ] 合并后自动更新所有关联内容

#### Story 1.5: 标签规范化工具

**As a** 系统管理员
**I want to** 批量规范化标签命名（大小写、格式）
**So that** 保持标签命名一致性

**Acceptance Criteria:**
- [ ] 提供命名规则配置（如：首字母大写、全小写、保持原样）
- [ ] 预览规范化结果，确认后批量应用
- [ ] 记录规范化操作日志

---

### Epic 2: 分类重构

#### Story 2.1: 分类层级限制与可视化

**As a** 系统管理员
**I want to** 清晰地看到分类层级结构，并限制最大深度
**So that** 保持分类结构简洁合理

**Acceptance Criteria:**
- [ ] 树形视图清晰展示父子关系和层级深度
- [ ] 可配置最大层级深度（默认 3 层）
- [ ] 超过最大深度时禁止创建子分类
- [ ] 显示每个分类的内容数量

#### Story 2.2: 拖拽排序优化

**As a** 系统管理员
**I want to** 通过拖拽直观地调整分类顺序和层级
**So that** 排序操作更高效

**Acceptance Criteria:**
- [ ] 支持拖拽调整同级分类顺序
- [ ] 支持拖拽调整父子层级关系
- [ ] 拖拽时显示放置位置预览
- [ ] 自动重新计算 sort_order，无需手动输入数字

#### Story 2.3: 分类安全迁移

**As a** 系统管理员
**I want to** 删除或归档分类时，安全地迁移关联内容
**So that** 不会丢失内容的分类信息

**Acceptance Criteria:**
- [ ] 删除分类前显示关联内容数量
- [ ] 提供「迁移到其他分类」选项
- [ ] 支持批量迁移内容到目标分类
- [ ] 提供「归档」选项（隐藏但不删除）

#### Story 2.4: 分类合并增强

**As a** 系统管理员
**I want to** 合并分类时保留所有关联数据
**So that** 整理分类时不丢失信息

**Acceptance Criteria:**
- [ ] 合并时显示两个分类的内容数量
- [ ] 自动将源分类的所有内容迁移到目标分类
- [ ] 可选择是否保留源分类名作为目标分类的描述/备注
- [ ] 合并操作可撤销（软删除 + 恢复）

---

### Epic 3: 效率提升

#### Story 3.1: 增强标签选择器

**As a** 内容编辑
**I want to** 快速找到并选择合适的标签
**So that** 提高内容编辑效率

**Acceptance Criteria:**
- [ ] 常用标签（使用频率 Top 10）置顶显示
- [ ] 显示「最近使用」标签列表
- [ ] 支持拼音首字母搜索（如输入 "qd" 匹配 "前端"）
- [ ] 支持键盘快捷操作（上下选择、回车确认）

#### Story 3.2: 增强分类选择器

**As a** 内容编辑
**I want to** 快速定位并选择正确的分类
**So that** 减少选择分类的时间

**Acceptance Criteria:**
- [ ] 树形下拉展示分类层级
- [ ] 支持搜索过滤（名称 + 拼音）
- [ ] 显示分类路径（如：技术 > 前端 > React）
- [ ] 记住上次选择，作为默认值

#### Story 3.3: 批量标签操作

**As a** 内容编辑
**I want to** 批量给多个内容添加或移除标签
**So that** 处理大量内容时更高效

**Acceptance Criteria:**
- [ ] 内容列表支持多选
- [ ] 提供「批量添加标签」操作
- [ ] 提供「批量移除标签」操作
- [ ] 显示操作结果统计

---

### Epic 4: 智能推荐

#### Story 4.1: 内容编辑时标签推荐

**As a** 内容编辑
**I want to** 编辑内容时系统根据标题和摘要推荐标签
**So that** 快速选择合适的标签

**Acceptance Criteria:**
- [ ] 输入标题/摘要后自动触发推荐（防抖 500ms）
- [ ] 显示 3-5 个推荐标签，按相关度排序
- [ ] 点击推荐标签直接添加
- [ ] 推荐结果标注置信度（高/中/低）

#### Story 4.2: 内容编辑时分类推荐

**As a** 内容编辑
**I want to** 编辑内容时系统推荐合适的分类
**So that** 减少分类选择的犹豫

**Acceptance Criteria:**
- [ ] 基于内容标题/摘要推荐 1-3 个分类
- [ ] 显示推荐理由（如：「标题包含 React 关键词」）
- [ ] 点击推荐分类直接选中
- [ ] 复用现有 AI 评分服务的能力

#### Story 4.3: 标签健康度报告

**As a** 系统管理员
**I want to** 定期查看标签体系的健康度报告
**So that** 了解哪些标签需要整理

**Acceptance Criteria:**
- [ ] 显示标签总数、使用率、重复率等指标
- [ ] 列出疑似重复的标签组
- [ ] 列出长期未使用的标签
- [ ] 提供一键清理/合并入口

---

## Functional Requirements

### Core Features

#### Feature 1: 标签组 (Tag Groups)

**Description**: 新增标签组实体，用于对标签进行分类管理

**数据模型变更**:
```prisma
model tag_groups {
  id          Int       @id @default(autoincrement())
  name        String    @unique @db.VarChar(50)
  slug        String    @unique @db.VarChar(50)
  description String?   @db.Text
  sort_order  Int       @default(0)
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  tags        tags[]
}

model tags {
  // ... existing fields
  group_id    Int?
  aliases     String?   @db.Text  // JSON array of aliases
  group       tag_groups? @relation(fields: [group_id], references: [id])
}
```

**User flow**:
1. 管理员进入标签管理页面
2. 点击「管理标签组」打开标签组管理面板
3. 创建/编辑/删除标签组
4. 在标签列表中为标签分配组

**Edge cases**:
- 删除标签组时，组内标签的 group_id 置为 null
- 标签组名称不可重复

#### Feature 2: 相似标签检测服务

**Description**: 基于编辑距离和 AI 语义分析检测相似标签

**API 设计**:
```typescript
// POST /api/tags/detect-similar
interface DetectSimilarRequest {
  name: string;
  threshold?: number; // 默认 0.8
}

interface DetectSimilarResponse {
  similar_tags: Array<{
    id: number;
    name: string;
    similarity: number;
    match_type: 'exact' | 'alias' | 'fuzzy' | 'semantic';
  }>;
}
```

**Implementation**:
1. 精确匹配：名称完全相同
2. 别名匹配：匹配已有标签的别名
3. 模糊匹配：Levenshtein 距离 < 3
4. 语义匹配：复用现有 AI 服务进行语义相似度计算

#### Feature 3: AI 标签/分类推荐

**Description**: 复用现有 inbox-scorer AI 服务，扩展标签和分类推荐能力

**API 设计**:
```typescript
// POST /api/ai/recommend-tags
interface RecommendTagsRequest {
  title: string;
  summary?: string;
  content?: string;
  limit?: number; // 默认 5
}

interface RecommendTagsResponse {
  recommendations: Array<{
    tag_id: number;
    tag_name: string;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
  }>;
}

// POST /api/ai/recommend-category
interface RecommendCategoryRequest {
  title: string;
  summary?: string;
}

interface RecommendCategoryResponse {
  recommendations: Array<{
    category_id: number;
    category_name: string;
    category_path: string;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
  }>;
}
```

#### Feature 4: 增强选择器组件

**Description**: 优化标签和分类选择器的用户体验

**标签选择器增强**:
- 分组展示（按 tag_group 分类）
- 常用标签区（基于全局使用频率）
- 最近使用区（基于当前用户）
- 拼音搜索支持（使用 pinyin 库）
- 键盘导航支持

**分类选择器增强**:
- 树形下拉结构
- 面包屑路径显示
- 搜索过滤
- 默认值记忆

### Out of Scope

- 标签/分类的权限控制（所有用户可见所有标签）
- 标签的多语言支持
- 分类的多选支持（保持单选，通过标签补充）
- 自动标签（入库时自动打标签，本期仅做推荐）
- 标签/分类的版本历史

---

## Technical Constraints

### Performance

- 相似标签检测响应时间 < 300ms
- AI 推荐响应时间 < 1s（可接受，因为是辅助功能）
- 标签选择器渲染 1000+ 标签时保持流畅（虚拟滚动）

### Security

- 标签/分类操作需要 EDITOR 或 ADMIN 角色
- AI 推荐 API 需要认证
- 批量操作需要记录操作日志

### Integration

- **现有 AI 服务**: 复用 `src/lib/ai/server/inbox-scorer.ts` 的 AI 调用能力
- **Prisma ORM**: 扩展现有数据模型
- **React Query**: 复用现有的数据获取模式

### Technology Stack

- 前端：React + shadcn/ui（现有）
- 拼音搜索：pinyin-pro 库
- 虚拟滚动：@tanstack/react-virtual（如需要）

---

## MVP Scope & Phasing

### Phase 1: 标签治理基础 (MVP)

**核心交付**:
- [ ] 1.1 标签分组管理
- [ ] 1.2 相似标签检测（创建时）
- [ ] 1.3 标签别名系统
- [ ] 3.1 增强标签选择器（常用 + 最近 + 拼音搜索）

**MVP Definition**: 解决标签混乱的核心问题，提供基础的组织和查找能力

### Phase 2: 分类优化 + 智能推荐

**核心交付**:
- [ ] 2.1 分类层级限制与可视化
- [ ] 2.2 拖拽排序优化
- [ ] 2.3 分类安全迁移
- [ ] 3.2 增强分类选择器
- [ ] 4.1 内容编辑时标签推荐
- [ ] 4.2 内容编辑时分类推荐

### Phase 3: 高级功能

**核心交付**:
- [ ] 1.4 智能标签合并建议
- [ ] 1.5 标签规范化工具
- [ ] 2.4 分类合并增强
- [ ] 3.3 批量标签操作
- [ ] 4.3 标签健康度报告

### Future Considerations

- 标签自动化：入库时自动打标签（需评估准确率）
- 标签关系图：可视化标签之间的关联
- 分类多选：支持内容属于多个分类
- 标签订阅：用户订阅感兴趣的标签

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| AI 推荐准确率不足 | Medium | Medium | 先上线为「建议」模式，收集反馈后迭代优化 |
| 标签迁移影响已有内容 | Low | High | 提供预览和回滚机制，分批执行 |
| 拼音搜索性能问题 | Low | Low | 预计算拼音索引，或使用服务端搜索 |
| 用户习惯改变阻力 | Medium | Medium | 渐进式上线，保留原有操作方式 |

---

## Dependencies & Blockers

**Dependencies:**
- 现有 AI 服务稳定可用
- Prisma schema 变更需要数据库迁移

**Known Blockers:**
- 无

---

## Appendix

### Glossary

- **标签组 (Tag Group)**: 用于组织标签的分类，如「技术栈」「主题」
- **标签别名 (Tag Alias)**: 标签的替代名称，用于搜索匹配
- **相似度阈值 (Similarity Threshold)**: 判定两个标签相似的最低分数

### References

- 现有标签管理页面: `src/app/(dashboard)/settings/tags/page.tsx`
- 现有分类管理页面: `src/app/(dashboard)/settings/categories/page.tsx`
- AI 评分服务: `src/lib/ai/server/inbox-scorer.ts`
- 数据模型: `prisma/schema.prisma`

### UI Wireframes

待设计阶段补充

---

*This PRD was created through interactive requirements gathering with quality scoring to ensure comprehensive coverage of business, functional, UX, and technical dimensions.*
