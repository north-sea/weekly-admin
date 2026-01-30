# Product Requirements Document: 周刊自动化管理

**Version**: 1.1
**Date**: 2026-01-30
**Author**: Sarah (Product Owner)
**Quality Score**: 92/100
**Last Updated**: 2026-01-30 (新增交互优化需求)

---

## Executive Summary

本功能旨在解决周刊管理系统中的两个核心问题：历史空周刊的内容回填，以及后续周刊的自动化创建与内容关联。

当前系统存在 31 期空周刊（第 47-77 期），同时有大量已晋升的内容未关联到任何周刊。本功能将实现：
1. 一次性回填历史空周刊的内容
2. 每周一自动创建新周刊
3. 每周末自动将本周晋升的内容关联到周刊（生成草稿待审核）

这将大幅减少人工操作，确保周刊内容的及时性和完整性。

---

## Problem Statement

**Current Situation**:
- 31 期空周刊（第 47-77 期）没有关联任何内容
- 内容晋升后需要手动关联到周刊，容易遗漏
- 周刊创建需要手动操作，无法保证及时性
- 缺乏自动化流程，运营效率低

**Proposed Solution**:
- 提供历史回填 API，根据内容创建时间自动关联到对应周期的周刊
- 实现 Cron Job 自动化：周一创建周刊，周末关联内容
- 自动关联生成草稿状态，保留人工审核环节

**Business Impact**:
- 减少 90% 的周刊管理手动操作
- 确保内容及时归档到对应周刊
- 提升周刊发布的及时性和规律性

---

## Success Metrics

**Primary KPIs:**
- 历史回填完成率：100% 的空周刊被正确处理
- 自动创建成功率：每周一 100% 自动创建新周刊
- 内容关联准确率：95%+ 的内容被关联到正确的周刊

**Validation**:
- 回填后检查每期周刊的内容数量和时间范围
- 监控 Cron Job 执行日志
- 每周审核自动关联的内容草稿

---

## User Personas

### Primary: 周刊运营管理员
- **Role**: 负责周刊内容审核和发布
- **Goals**: 高效管理周刊，确保内容质量和发布及时性
- **Pain Points**: 手动创建周刊和关联内容耗时，容易遗漏
- **Technical Level**: 中级

---

## User Stories & Acceptance Criteria

### Story 1: 历史空周刊回填

**As a** 运营管理员
**I want to** 一键回填历史空周刊的内容
**So that** 历史周刊能够完整展示对应时期的内容

**Acceptance Criteria:**
- [ ] 提供 API 端点 `POST /api/weekly/backfill` 触发回填
- [ ] 根据内容的 `created_at` 时间匹配对应周期的周刊
- [ ] 每期周刊最多关联 15 篇内容，按时间顺序选取
- [ ] 只处理 `content_type_id=3` 且状态为 `ready` 或 `published` 的内容
- [ ] 返回回填结果统计（处理周刊数、关联内容数）
- [ ] 支持 dry-run 模式预览回填结果

### Story 2: 周刊自动创建

**As a** 系统
**I want to** 每周一自动创建本周的周刊
**So that** 运营人员无需手动创建周刊

**Acceptance Criteria:**
- [ ] 提供 API 端点 `POST /api/weekly/auto-create` 供 Cron 调用
- [ ] 检查本周周刊是否已存在，避免重复创建
- [ ] 周刊时间范围：周一 00:00 到周日 23:59
- [ ] 自动计算期号（上一期 + 1）
- [ ] 周刊标题格式：`我不知道的周刊第 {期号} 期`
- [ ] 初始状态为 `draft`
- [ ] 记录操作日志

### Story 3: 内容自动关联

**As a** 系统
**I want to** 每周末自动将本周晋升的内容关联到周刊
**So that** 内容能够及时归档到对应周刊

**Acceptance Criteria:**
- [ ] 提供 API 端点 `POST /api/weekly/auto-link` 供 Cron 调用
- [ ] 查找本周创建的、未关联周刊的内容
- [ ] 只处理 `content_type_id=3` 且状态为 `ready` 或 `published` 的内容
- [ ] 按 `created_at` 时间顺序关联，每期最多 15 篇
- [ ] 关联后周刊保持 `draft` 状态，等待人工审核
- [ ] 发送通知提醒管理员审核（可选）
- [ ] 记录操作日志

### Story 4: 手动触发入口

**As a** 运营管理员
**I want to** 在管理后台手动触发自动化任务
**So that** 可以在需要时立即执行，而不必等待定时任务

**Acceptance Criteria:**
- [ ] 在周刊管理页面提供"回填历史周刊"按钮
- [ ] 在周刊管理页面提供"创建本周周刊"按钮
- [ ] 在周刊管理页面提供"关联本周内容"按钮
- [ ] 操作前显示确认对话框
- [ ] 操作后显示执行结果摘要弹窗

### Story 5: 周刊列表增强

**As a** 运营管理员
**I want to** 在周刊列表页快速了解每期周刊的状态
**So that** 能够一眼识别需要处理的周刊

**Acceptance Criteria:**
- [ ] 显示内容数量徽章（如 `8 篇` 或 `空`）
- [ ] 显示状态标签（草稿/已发布/待审核）
- [ ] 当前周周刊使用特殊样式高亮标记
- [ ] 空周刊使用警告色提示

### Story 6: 内容详情页周刊关联

**As a** 运营管理员
**I want to** 在内容详情页查看和管理周刊关联
**So that** 能够快速了解内容归属并进行调整

**Acceptance Criteria:**
- [ ] 显示当前内容已关联的周刊信息（期号、标题、链接）
- [ ] 提供快捷关联/取消关联操作按钮
- [ ] 根据内容创建时间推荐应归属的周刊期数
- [ ] 未关联时显示"未关联周刊"提示和推荐

### Story 7: 周刊编辑页增强

**As a** 运营管理员
**I want to** 在周刊编辑页高效管理内容
**So that** 能够快速完成周刊内容的组织和审核

**Acceptance Criteria:**
- [ ] 显示待关联内容提示（本周有 X 篇未关联内容）
- [ ] 提供"批量关联"按钮，一键关联所有待关联内容
- [ ] 优化拖拽排序体验（流畅度、视觉反馈）
- [ ] 显示完整度指示器（如"已有 8 篇，建议 10-15 篇"）
- [ ] 批量关联后显示结果摘要弹窗

---

## Functional Requirements

### Core Features

**Feature 1: 历史回填服务**
- Description: 一次性将历史内容回填到对应周期的空周刊
- User flow:
  1. 管理员调用回填 API 或点击后台按钮
  2. 系统查询所有空周刊和未关联内容
  3. 根据内容 `created_at` 匹配周刊的 `start_date` ~ `end_date`
  4. 按时间顺序关联内容，每期最多 15 篇
  5. 返回回填统计结果
- Edge cases:
  - 某周期内容超过 15 篇：按时间顺序取前 15 篇
  - 某周期没有内容：保持空周刊状态
  - 内容时间不在任何周刊范围内：跳过该内容
- Error handling:
  - 数据库事务失败：回滚并返回错误
  - 部分成功：返回成功和失败的详细信息

**Feature 2: 周刊自动创建服务**
- Description: 每周一自动创建本周周刊
- User flow:
  1. Cron Job 在周一 00:05 触发 API
  2. 系统检查本周周刊是否存在
  3. 如不存在，计算期号并创建周刊
  4. 记录操作日志
- Edge cases:
  - 周刊已存在：跳过创建，返回已存在信息
  - 期号冲突：使用最大期号 + 1
- Error handling:
  - 创建失败：记录错误日志，发送告警

**Feature 3: 内容自动关联服务**
- Description: 每周末自动关联本周内容到周刊
- User flow:
  1. Cron Job 在周日 23:00 触发 API
  2. 系统查询本周周刊和本周创建的未关联内容
  3. 按时间顺序关联内容
  4. 更新周刊统计信息（total_items, word_count 等）
  5. 记录操作日志
- Edge cases:
  - 本周周刊不存在：先创建周刊再关联
  - 本周没有新内容：跳过关联
  - 内容已关联到其他周刊：跳过该内容
- Error handling:
  - 关联失败：记录错误，继续处理其他内容

**Feature 4: 周刊列表增强**
- Description: 在周刊列表页提供更直观的状态展示
- UI Elements:
  - 内容数量徽章：显示关联内容数，空周刊显示"空"
  - 状态标签：草稿（灰色）、已发布（绿色）、待审核（橙色）
  - 当前周高亮：使用边框或背景色标记本周周刊
- Implementation:
  - 复用现有 `_count.weekly_content_items` 数据
  - 添加 CSS 样式类区分不同状态

**Feature 5: 内容详情页周刊关联**
- Description: 在内容详情页显示和管理周刊关联
- UI Elements:
  - 周刊关联卡片：显示已关联周刊的期号和标题
  - 快捷操作按钮：关联/取消关联/更换周刊
  - 推荐提示：根据 `created_at` 计算推荐周刊期数
- User flow:
  1. 进入内容详情页
  2. 查看右侧/底部的周刊关联卡片
  3. 如未关联，显示推荐周刊和"关联"按钮
  4. 如已关联，显示周刊信息和"取消关联"按钮
- Implementation:
  - 新增 API `GET /api/contents/[id]/weekly` 获取关联信息
  - 新增 API `POST /api/contents/[id]/weekly` 关联/取消关联

**Feature 6: 周刊编辑页增强**
- Description: 优化周刊编辑页的内容管理体验
- UI Elements:
  - 待关联提示栏：显示"本周有 X 篇未关联内容"
  - 批量关联按钮：一键关联所有待关联内容
  - 完整度指示器：进度条显示"8/15 篇"
  - 结果摘要弹窗：关联操作后显示详细结果
- User flow:
  1. 进入周刊编辑页
  2. 顶部显示待关联内容提示和批量关联按钮
  3. 点击批量关联，显示确认对话框
  4. 确认后执行关联，显示结果摘要弹窗
  5. 弹窗显示：关联了哪些内容、跳过了哪些、原因
- Implementation:
  - 新增 API `GET /api/weekly/[id]/pending-contents` 获取待关联内容
  - 复用 `PUT /api/weekly/[id]/contents` 进行批量关联
  - 优化拖拽组件性能（使用 `react-beautiful-dnd` 或 `dnd-kit`）

### Out of Scope
- 自动发布周刊（保持草稿状态，需人工审核）
- 内容自动排序和分类（使用现有 AI 组织功能）
- 邮件/消息通知功能（后续迭代）
- 周刊内容的自动删除或归档

---

## Technical Constraints

### Performance
- 回填 API 响应时间 < 30s（处理 31 期周刊）
- 自动创建/关联 API 响应时间 < 5s
- 使用数据库事务确保数据一致性

### Security
- API 需要管理员权限认证
- Cron Job 使用内部 API Key 认证
- 操作日志记录所有自动化操作

### Integration
- **Prisma ORM**: 数据库操作
- **Cron Job**: 系统级定时任务（crontab 或类似方案）
- **现有周刊 API**: 复用 `/api/weekly/[id]/contents` 的关联逻辑

### Technology Stack
- Next.js 15 API Routes
- Prisma 6.x
- MySQL
- 系统 Cron（或 Vercel Cron 作为备选）

---

## MVP Scope & Phasing

### Phase 1: MVP (Required for Initial Launch)

**后端 API：**
- [x] 历史回填 API (`POST /api/weekly/backfill`)
- [x] 周刊自动创建 API (`POST /api/weekly/auto-create`)
- [x] 内容自动关联 API (`POST /api/weekly/auto-link`)
- [x] 内容周刊关联 API (`GET/POST /api/contents/[id]/weekly`)
- [x] 待关联内容 API (`GET /api/weekly/[id]/pending-contents`)
- [x] Cron Job 配置文档

**前端交互优化：**
- [x] 周刊列表增强（内容数量徽章、状态标签、当前周高亮）
- [x] 关联结果摘要弹窗
- [x] 内容详情页周刊关联（显示、快捷操作、推荐期数）
- [x] 周刊编辑页增强（待关联提示、批量关联、拖拽优化、完整度指示器）

**MVP Definition**:
- 能够通过 API 完成历史回填，并配置 Cron Job 实现后续自动化
- 前端提供完整的交互体验，支持手动触发和结果查看

### Phase 2: Enhancements (Post-Launch)
- [ ] 操作结果通知（邮件/消息）
- [ ] 自动化任务监控面板
- [ ] 周刊内容智能排序建议

### Future Considerations
- 智能内容推荐（AI 选择最佳内容）
- 周刊自动发布（定时发布）
- 多周刊模板支持

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| 回填数据不准确 | Medium | High | 提供 dry-run 模式预览，支持回滚 |
| Cron Job 执行失败 | Low | Medium | 添加重试机制和告警通知 |
| 内容重复关联 | Low | Low | 使用唯一约束和事务保护 |
| 性能问题（大量数据） | Low | Medium | 分批处理，添加索引优化 |

---

## Dependencies & Blockers

**Dependencies:**
- 内容晋升流程已完善（inbox -> contents）
- 现有周刊 API 正常工作
- 数据库连接稳定

**Known Blockers:**
- 无

---

## API Specification

### POST /api/weekly/backfill

**Description**: 回填历史空周刊的内容

**Request Body**:
```json
{
  "dryRun": false,
  "maxItemsPerIssue": 15
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "processedIssues": 31,
    "linkedContents": 156,
    "skippedContents": 12,
    "details": [
      { "issueId": 47, "issueNumber": 47, "linkedCount": 8 },
      ...
    ]
  }
}
```

### POST /api/weekly/auto-create

**Description**: 自动创建本周周刊

**Request Body**:
```json
{
  "forceCreate": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "created",
    "issue": {
      "id": 78,
      "issue_number": 78,
      "title": "我不知道的周刊第 78 期",
      "start_date": "2026-01-27",
      "end_date": "2026-02-02"
    }
  }
}
```

### POST /api/weekly/auto-link

**Description**: 自动关联本周内容到周刊

**Request Body**:
```json
{
  "maxItems": 15,
  "weekOffset": 0
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "issueId": 78,
    "issueNumber": 78,
    "linkedCount": 12,
    "skippedCount": 3,
    "linkedContents": [
      { "id": 853, "title": "..." },
      ...
    ],
    "skippedContents": [
      { "id": 860, "title": "...", "reason": "已关联到其他周刊" }
    ]
  }
}
```

### GET /api/contents/[id]/weekly

**Description**: 获取内容的周刊关联信息

**Response**:
```json
{
  "success": true,
  "data": {
    "linkedIssue": {
      "id": 78,
      "issue_number": 78,
      "title": "我不知道的周刊第 78 期",
      "status": "draft"
    },
    "recommendedIssue": {
      "id": 78,
      "issue_number": 78,
      "title": "我不知道的周刊第 78 期",
      "reason": "内容创建时间在该周刊时间范围内"
    }
  }
}
```

### POST /api/contents/[id]/weekly

**Description**: 关联或取消关联内容到周刊

**Request Body**:
```json
{
  "action": "link",
  "weeklyIssueId": 78
}
```
或
```json
{
  "action": "unlink"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "action": "linked",
    "issue": {
      "id": 78,
      "issue_number": 78,
      "title": "我不知道的周刊第 78 期"
    }
  }
}
```

### GET /api/weekly/[id]/pending-contents

**Description**: 获取周刊时间范围内的待关联内容

**Response**:
```json
{
  "success": true,
  "data": {
    "pendingCount": 5,
    "contents": [
      {
        "id": 853,
        "title": "...",
        "created_at": "2026-01-28T10:00:00Z",
        "status": "published"
      },
      ...
    ]
  }
}
```

---

## Cron Job Configuration

```bash
# 每周一 00:05 创建本周周刊
5 0 * * 1 curl -X POST https://admin.example.com/api/weekly/auto-create -H "Authorization: Bearer $API_KEY"

# 每周日 23:00 关联本周内容
0 23 * * 0 curl -X POST https://admin.example.com/api/weekly/auto-link -H "Authorization: Bearer $API_KEY"
```

---

## Appendix

### Glossary
- **周刊 (Weekly Issue)**: 按周组织的内容集合
- **晋升 (Promote)**: 将 inbox 中的内容转为正式内容
- **回填 (Backfill)**: 将历史内容关联到对应周期的周刊

### References
- 现有周刊 API: `src/app/api/weekly/`
- 周刊组织服务: `src/lib/ai/server/weekly-organizer.ts`
- 数据模型: `prisma/schema.prisma`

---

*This PRD was created through interactive requirements gathering with quality scoring to ensure comprehensive coverage of business, functional, UX, and technical dimensions.*
