# 周刊自动化管理 - 任务计划

**PRD**: `docs/weekly-automation-prd.md` v1.1
**创建时间**: 2026-01-31
**状态**: 规划中

---

## 目标

实现周刊自动化管理功能，包括：
1. 历史空周刊内容回填
2. 周刊自动创建（每周一）
3. 内容自动关联（每周末）
4. 前端交互优化（列表增强、内容页关联、编辑页增强）

---

## 任务分解

### Phase 1: 后端核心服务 [预计 8 个任务]

#### 1.1 周刊工具函数
- **Task 1.1.1**: 创建周刊时间计算工具
  - 文件: `src/lib/utils/weekly-date.ts`
  - 功能:
    - `getWeekRange(date)`: 获取指定日期所在周的周一和周日
    - `findWeeklyIssueForDate(date)`: 根据日期查找对应周刊
    - `isCurrentWeek(startDate, endDate)`: 判断是否为当前周
  - 依赖: dayjs
  - 状态: `pending`

#### 1.2 历史回填 API
- **Task 1.2.1**: 实现回填服务层
  - 文件: `src/lib/services/weekly-automation.ts`
  - 功能:
    - `backfillWeeklyContents(options)`: 回填逻辑
    - 查询空周刊和未关联内容
    - 按 `created_at` 匹配周刊时间范围
    - 每期最多 15 篇，按时间顺序
    - 支持 dry-run 模式
  - 状态: `pending`

- **Task 1.2.2**: 实现回填 API 路由
  - 文件: `src/app/api/weekly/backfill/route.ts`
  - 方法: `POST`
  - 参数: `{ dryRun: boolean, maxItemsPerIssue: number }`
  - 返回: 回填统计结果
  - 状态: `pending`

#### 1.3 周刊自动创建 API
- **Task 1.3.1**: 实现自动创建服务
  - 文件: `src/lib/services/weekly-automation.ts` (追加)
  - 功能:
    - `autoCreateWeeklyIssue(options)`: 创建本周周刊
    - 检查是否已存在
    - 计算期号（最大期号 + 1）
    - 生成标题和 slug
  - 状态: `pending`

- **Task 1.3.2**: 实现自动创建 API 路由
  - 文件: `src/app/api/weekly/auto-create/route.ts`
  - 方法: `POST`
  - 参数: `{ forceCreate: boolean }`
  - 返回: 创建结果或已存在信息
  - 状态: `pending`

#### 1.4 内容自动关联 API
- **Task 1.4.1**: 实现自动关联服务
  - 文件: `src/lib/services/weekly-automation.ts` (追加)
  - 功能:
    - `autoLinkWeeklyContents(options)`: 关联本周内容
    - 查询本周未关联内容
    - 按时间顺序关联
    - 更新周刊统计信息
  - 状态: `pending`

- **Task 1.4.2**: 实现自动关联 API 路由
  - 文件: `src/app/api/weekly/auto-link/route.ts`
  - 方法: `POST`
  - 参数: `{ maxItems: number, weekOffset: number }`
  - 返回: 关联结果（含跳过原因）
  - 状态: `pending`

#### 1.5 内容周刊关联 API
- **Task 1.5.1**: 实现内容关联查询 API
  - 文件: `src/app/api/contents/[id]/weekly/route.ts`
  - 方法: `GET`
  - 返回: 已关联周刊 + 推荐周刊
  - 状态: `pending`

- **Task 1.5.2**: 实现内容关联操作 API
  - 文件: `src/app/api/contents/[id]/weekly/route.ts` (追加 POST)
  - 方法: `POST`
  - 参数: `{ action: 'link' | 'unlink', weeklyIssueId?: number }`
  - 返回: 操作结果
  - 状态: `pending`

#### 1.6 待关联内容 API
- **Task 1.6.1**: 实现待关联内容查询 API
  - 文件: `src/app/api/weekly/[id]/pending-contents/route.ts`
  - 方法: `GET`
  - 返回: 周刊时间范围内的未关联内容列表
  - 状态: `pending`

---

### Phase 2: 前端 - 周刊列表增强 [预计 3 个任务]

#### 2.1 列表 UI 增强
- **Task 2.1.1**: 添加内容数量徽章和状态标签
  - 文件: `src/app/(dashboard)/weekly/page.tsx`
  - 修改:
    - 内容数量列：空周刊显示警告色 `空` 徽章
    - 状态列：使用不同颜色区分（草稿灰、已发布绿、待审核橙）
  - 状态: `pending`

- **Task 2.1.2**: 添加当前周高亮
  - 文件: `src/app/(dashboard)/weekly/page.tsx`
  - 修改:
    - 判断周刊是否为当前周
    - 当前周行添加特殊背景色/边框
  - 依赖: Task 1.1.1 (周刊时间工具)
  - 状态: `pending`

- **Task 2.1.3**: 添加自动化操作按钮
  - 文件: `src/app/(dashboard)/weekly/page.tsx`
  - 修改:
    - 页面顶部添加"回填历史周刊"按钮
    - 添加"创建本周周刊"按钮
    - 添加"关联本周内容"按钮
    - 操作前确认对话框
    - 操作后结果摘要弹窗
  - 依赖: Phase 1 所有 API
  - 状态: `pending`

---

### Phase 3: 前端 - 内容详情页周刊关联 [预计 3 个任务]

#### 3.1 React Query Hook
- **Task 3.1.1**: 创建内容周刊关联 Hook
  - 文件: `src/hooks/queries/useContentWeeklyQueries.ts`
  - 功能:
    - `useContentWeekly(contentId)`: 获取关联信息
    - `useLinkContentToWeekly()`: 关联操作
    - `useUnlinkContentFromWeekly()`: 取消关联
  - 状态: `pending`

#### 3.2 周刊关联卡片组件
- **Task 3.2.1**: 创建周刊关联卡片组件
  - 文件: `src/components/content/WeeklyLinkCard.tsx`
  - 功能:
    - 显示已关联周刊信息
    - 显示推荐周刊（未关联时）
    - 关联/取消关联按钮
    - 更换周刊下拉选择
  - 状态: `pending`

#### 3.3 集成到内容详情页
- **Task 3.3.1**: 在内容编辑器中集成周刊关联卡片
  - 文件: `src/components/content/simplified-editor.tsx`
  - 修改:
    - 在右侧边栏或底部添加 WeeklyLinkCard
    - 传入 contentId
  - 依赖: Task 3.1.1, Task 3.2.1
  - 状态: `pending`

---

### Phase 4: 前端 - 周刊编辑页增强 [预计 4 个任务]

#### 4.1 待关联内容 Hook
- **Task 4.1.1**: 创建待关联内容 Hook
  - 文件: `src/hooks/queries/useWeeklyQueries.ts` (追加)
  - 功能:
    - `usePendingContents(weeklyId)`: 获取待关联内容
    - `useBatchLinkContents()`: 批量关联
  - 状态: `pending`

#### 4.2 待关联提示栏组件
- **Task 4.2.1**: 创建待关联提示栏组件
  - 文件: `src/components/weekly/PendingContentsBar.tsx`
  - 功能:
    - 显示"本周有 X 篇未关联内容"
    - "批量关联"按钮
    - 点击展开待关联内容列表
  - 状态: `pending`

#### 4.3 完整度指示器组件
- **Task 4.3.1**: 创建完整度指示器组件
  - 文件: `src/components/weekly/CompletenessIndicator.tsx`
  - 功能:
    - 进度条显示 "8/15 篇"
    - 颜色：< 10 篇黄色，10-15 篇绿色，> 15 篇蓝色
    - 提示文字："建议 10-15 篇内容"
  - 状态: `pending`

#### 4.4 结果摘要弹窗组件
- **Task 4.4.1**: 创建结果摘要弹窗组件
  - 文件: `src/components/weekly/LinkResultDialog.tsx`
  - 功能:
    - 显示关联成功的内容列表
    - 显示跳过的内容及原因
    - 关闭按钮
  - 状态: `pending`

#### 4.5 集成到周刊编辑页
- **Task 4.5.1**: 在周刊编辑器中集成增强组件
  - 文件: `src/components/weekly/WeeklyEditor.tsx`
  - 修改:
    - 顶部添加 PendingContentsBar
    - 添加 CompletenessIndicator
    - 批量关联后显示 LinkResultDialog
  - 依赖: Task 4.1.1 ~ 4.4.1
  - 状态: `pending`

#### 4.6 拖拽体验优化
- **Task 4.6.1**: 优化拖拽排序体验
  - 文件: `src/components/weekly/SelectedContentsList.tsx`
  - 修改:
    - 检查当前拖拽库实现
    - 优化拖拽动画和视觉反馈
    - 添加拖拽占位符样式
  - 状态: `pending`

---

### Phase 5: Cron Job 配置 [预计 1 个任务]

- **Task 5.1.1**: 编写 Cron Job 配置文档
  - 文件: `docs/cron-job-setup.md`
  - 内容:
    - crontab 配置示例
    - API Key 认证说明
    - 日志监控建议
    - 故障排查指南
  - 状态: `pending`

---

### Phase 6: 测试 [预计 2 个任务]

- **Task 6.1.1**: 后端 API 测试
  - 文件: `src/lib/services/weekly-automation.test.ts`
  - 覆盖:
    - 回填逻辑测试
    - 自动创建测试
    - 自动关联测试
    - 边界情况测试
  - 状态: `pending`

- **Task 6.2.1**: 端到端测试
  - 手动测试:
    - 回填 API dry-run 和实际执行
    - 自动创建 API
    - 自动关联 API
    - 前端交互流程
  - 状态: `pending`

---

## 任务依赖关系

```
Phase 1 (后端)
├── Task 1.1.1 (时间工具) ──┬──> Task 1.2.1 (回填服务)
│                          ├──> Task 1.3.1 (自动创建服务)
│                          └──> Task 1.4.1 (自动关联服务)
├── Task 1.2.1 ──> Task 1.2.2 (回填 API)
├── Task 1.3.1 ──> Task 1.3.2 (自动创建 API)
├── Task 1.4.1 ──> Task 1.4.2 (自动关联 API)
├── Task 1.5.1 + 1.5.2 (内容关联 API) ──> Phase 3
└── Task 1.6.1 (待关联 API) ──> Phase 4

Phase 2 (周刊列表)
├── Task 2.1.1 (徽章/标签)
├── Task 2.1.2 (当前周高亮) ──> 依赖 Task 1.1.1
└── Task 2.1.3 (操作按钮) ──> 依赖 Phase 1 所有 API

Phase 3 (内容详情页)
├── Task 3.1.1 (Hook) ──> 依赖 Task 1.5.1/1.5.2
├── Task 3.2.1 (卡片组件) ──> 依赖 Task 3.1.1
└── Task 3.3.1 (集成) ──> 依赖 Task 3.2.1

Phase 4 (周刊编辑页)
├── Task 4.1.1 (Hook) ──> 依赖 Task 1.6.1
├── Task 4.2.1 (提示栏) ──> 依赖 Task 4.1.1
├── Task 4.3.1 (完整度指示器)
├── Task 4.4.1 (结果弹窗)
├── Task 4.5.1 (集成) ──> 依赖 Task 4.2.1 ~ 4.4.1
└── Task 4.6.1 (拖拽优化)

Phase 5 (Cron) ──> 依赖 Phase 1

Phase 6 (测试) ──> 依赖所有 Phase
```

---

## 执行顺序建议

1. **第一批（并行）**:
   - Task 1.1.1 (时间工具)
   - Task 2.1.1 (徽章/标签) - 不依赖新 API
   - Task 4.3.1 (完整度指示器) - 纯 UI 组件
   - Task 4.4.1 (结果弹窗) - 纯 UI 组件

2. **第二批（依赖第一批）**:
   - Task 1.2.1, 1.3.1, 1.4.1 (服务层)
   - Task 2.1.2 (当前周高亮)

3. **第三批（依赖第二批）**:
   - Task 1.2.2, 1.3.2, 1.4.2 (API 路由)
   - Task 1.5.1, 1.5.2, 1.6.1 (其他 API)

4. **第四批（依赖第三批）**:
   - Task 2.1.3 (操作按钮)
   - Task 3.1.1, 3.2.1, 3.3.1 (内容详情页)
   - Task 4.1.1, 4.2.1, 4.5.1 (周刊编辑页)
   - Task 4.6.1 (拖拽优化)

5. **第五批（收尾）**:
   - Task 5.1.1 (Cron 文档)
   - Task 6.1.1, 6.2.1 (测试)

---

## 风险与注意事项

1. **数据一致性**: 回填和关联操作需要使用数据库事务
2. **性能**: 回填大量数据时注意分批处理
3. **幂等性**: API 需要支持重复调用不产生副作用
4. **错误处理**: 部分失败时需要返回详细信息

---

## 进度追踪

| Phase | 总任务 | 完成 | 进度 |
|-------|--------|------|------|
| Phase 1 | 9 | 0 | 0% |
| Phase 2 | 3 | 0 | 0% |
| Phase 3 | 3 | 0 | 0% |
| Phase 4 | 6 | 0 | 0% |
| Phase 5 | 1 | 0 | 0% |
| Phase 6 | 2 | 0 | 0% |
| **总计** | **24** | **0** | **0%** |

---

*最后更新: 2026-01-31*
