# Karakeep 增量同步功能设计

## 背景

当前 Karakeep 数据源同步时会获取所有书签并全量 upsert，对于已同步过的数据源，大部分书签都是重复的。新增增量同步功能，只处理上次同步之后新增的书签。

## 设计方案

### 1. SyncOptions 扩展

在 `src/lib/services/sync-orchestrator.ts` 中扩展 `SyncOptions` 类型：

```typescript
export type SyncOptions = {
  max_items?: number;
  similarity_check?: boolean;
  auto_preprocess?: boolean;
  incremental?: boolean;  // 新增：增量同步模式（仅 Karakeep）
};
```

### 2. syncKarakeepToInbox 逻辑修改

在获取书签后，当 `incremental: true` 且 `source.last_synced_at` 存在时，过滤书签：

```typescript
let filteredBookmarks = bookmarks;
if (options?.incremental && source.last_synced_at) {
  filteredBookmarks = bookmarks.filter((bookmark) => {
    const createdAt = new Date(bookmark.createdAt);
    return createdAt > source.last_synced_at!;
  });
}
```

### 3. API 层

修改 `src/app/api/sources/[id]/sync/route.ts`，在请求体中支持 `incremental` 参数。

### 4. React Query Hook

修改 `src/hooks/queries/useDataSourceQueries.ts` 中的 `useSyncDataSource`，支持传递 `incremental` 参数。

### 5. UI 变更

在 `src/app/(dashboard)/sources/page.tsx` 中，为 Karakeep 类型的数据源新增"仅新增"按钮：

```
[同步] [仅新增]  // 仅 Karakeep 类型显示第二个按钮
```

## 文件变更清单

1. `src/lib/services/sync-orchestrator.ts` - 扩展 SyncOptions，修改 syncKarakeepToInbox
2. `src/app/api/sources/[id]/sync/route.ts` - 支持 incremental 参数
3. `src/hooks/queries/useDataSourceQueries.ts` - 扩展 mutation 参数
4. `src/app/(dashboard)/sources/page.tsx` - 新增"仅新增"按钮

## 行为说明

| 场景 | 同步按钮 | 仅新增按钮 |
|------|----------|------------|
| 首次同步 | 全量同步 | 全量同步（无 last_synced_at） |
| 后续同步 | 全量同步 | 只处理 createdAt > last_synced_at 的书签 |
