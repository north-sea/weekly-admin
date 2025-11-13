# React Query 数据获取指南

本文档说明项目中新的React Query数据获取架构的使用方法和最佳实践。

## 目录

- [架构概述](#架构概述)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [使用指南](#使用指南)
- [最佳实践](#最佳实践)
- [迁移指南](#迁移指南)
- [常见问题](#常见问题)

---

## 架构概述

项目已完全迁移到React Query架构，提供了统一、高效的数据获取和状态管理方案。

### 架构优势

- **自动缓存管理**: 智能缓存策略，减少60%+的重复API调用
- **乐观更新**: 即时UI反馈，提升用户体验
- **统一错误处理**: 全局错误处理和用户反馈机制
- **声明式数据获取**: 减少80%的样板代码
- **类型安全**: 完整的TypeScript支持

### 架构分层

```
组件层 (Components)
    ↓ 使用
查询Hooks层 (src/hooks/queries/)
    ↓ 调用
服务层 (src/lib/services/)
    ↓ 请求
API客户端 (apiClient)
```

---

## 快速开始

### 1. 查询数据（GET）

```typescript
import { useContentDetail } from '@/hooks/queries';

function ContentDetailPage({ id }: { id: string }) {
  const { data, isLoading, error } = useContentDetail(id);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return <div>{data?.title}</div>;
}
```

### 2. 创建数据（POST）

```typescript
import { useCreateContent } from '@/hooks/queries';
import { message } from 'antd';

function CreateContentForm() {
  const createContent = useCreateContent({
    onSuccess: () => {
      message.success('内容创建成功');
    },
    onError: (error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  const handleSubmit = (values: ContentCreateInput) => {
    createContent.mutate(values);
  };

  return (
    <Form onFinish={handleSubmit}>
      {/* 表单字段 */}
      <Button 
        type="primary" 
        htmlType="submit"
        loading={createContent.isPending}
      >
        提交
      </Button>
    </Form>
  );
}
```

### 3. 更新数据（PUT）

```typescript
import { useUpdateContent } from '@/hooks/queries';

function EditContentForm({ id }: { id: string }) {
  const updateContent = useUpdateContent({
    onSuccess: () => {
      message.success('更新成功');
    },
  });

  const handleUpdate = (values: ContentUpdateInput) => {
    updateContent.mutate({ id, data: values });
  };

  return (
    <Button 
      onClick={handleUpdate}
      loading={updateContent.isPending}
    >
      保存
    </Button>
  );
}
```

### 4. 删除数据（DELETE）

```typescript
import { useDeleteContent } from '@/hooks/queries';

function ContentActions({ id }: { id: string }) {
  const deleteContent = useDeleteContent({
    onSuccess: () => {
      message.success('删除成功');
    },
  });

  const handleDelete = () => {
    deleteContent.mutate(id);
  };

  return (
    <Button 
      danger 
      onClick={handleDelete}
      loading={deleteContent.isPending}
    >
      删除
    </Button>
  );
}
```

---

## 核心概念

### 1. 查询键（Query Keys）

查询键用于标识和缓存查询数据。项目使用统一的查询键生成器：

```typescript
import { queryKeys } from '@/hooks/useApi';

// 内容相关
queryKeys.content.all           // ['content']
queryKeys.content.list()        // ['content', 'list']
queryKeys.content.detail(id)    // ['content', 'detail', id]

// 分类相关
queryKeys.categories.all        // ['categories']
queryKeys.categories.detail(id) // ['categories', 'detail', id]

// 标签相关
queryKeys.tags.all              // ['tags']
queryKeys.tags.popular(10)      // ['tags', 'popular', 10]

// 分析相关
queryKeys.analytics.overview(7) // ['analytics', 'overview', 7]
queryKeys.analytics.sources()   // ['analytics', 'sources']
```

### 2. 业务领域Hooks

按业务领域组织的查询hooks位于 `src/hooks/queries/` 目录：

```
src/hooks/queries/
├── index.ts                    # 统一导出
├── useContentQueries.ts        # 内容相关查询
├── useCategoryQueries.ts       # 分类相关查询
├── useTagQueries.ts            # 标签相关查询
├── useAnalyticsQueries.ts      # 分析数据查询
├── useWeeklyQueries.ts         # 周刊相关查询
├── useSearchQueries.ts         # 搜索功能查询
└── useOperationLogsQueries.ts  # 操作日志查询
```

### 3. 缓存策略

不同类型数据采用不同的缓存策略：

```typescript
// 静态数据 - 长缓存时间
categories, tags: 5分钟 staleTime, 10分钟 gcTime

// 动态数据 - 短缓存时间
content: 1分钟 staleTime, 5分钟 gcTime

// 实时数据 - 无缓存
analytics: 0 staleTime, 5分钟 gcTime

// 频繁更新数据 - 极短缓存
search: 30秒 staleTime, 2分钟 gcTime
```

缓存配置位于 `src/lib/cache-config.ts`

### 4. 错误处理

全局错误处理机制位于 `src/lib/error-handler.ts`：

```typescript
import { handleApiError } from '@/lib/error-handler';

// 在mutation中使用
const createContent = useCreateContent({
  onError: (error) => {
    handleApiError(error, 'create', '内容');
  },
});
```

---

## 使用指南

### 内容管理

#### 获取内容列表

```typescript
import { useContentList } from '@/hooks/queries';

function ContentList() {
  const { data, isLoading, error, refetch } = useContentList({
    page: 1,
    pageSize: 20,
    status: 'published',
  });

  return (
    <div>
      {data?.data.map(item => (
        <ContentItem key={item.id} data={item} />
      ))}
      <Pagination {...data?.pagination} />
    </div>
  );
}
```

#### 获取内容详情

```typescript
import { useContentDetail } from '@/hooks/queries';

function ContentDetail({ id }: { id: string }) {
  const { data, isLoading } = useContentDetail(id);

  return <div>{data?.title}</div>;
}
```

#### 创建内容

```typescript
import { useCreateContent } from '@/hooks/queries';

function CreateContent() {
  const createContent = useCreateContent();

  const handleCreate = (values: ContentCreateInput) => {
    createContent.mutate(values);
  };

  return <ContentForm onSubmit={handleCreate} />;
}
```

#### 批量操作

```typescript
import { useBatchContentOperation } from '@/hooks/queries';

function BatchActions({ ids }: { ids: number[] }) {
  const batchOperation = useBatchContentOperation();

  const handleBatchDelete = () => {
    batchOperation.mutate({
      action: 'delete',
      ids,
    });
  };

  return <Button onClick={handleBatchDelete}>批量删除</Button>;
}
```

### 分类和标签管理

#### 获取分类树

```typescript
import { useCategoryTree } from '@/hooks/queries';

function CategoryTree() {
  const { data } = useCategoryTree();

  return <Tree treeData={data} />;
}
```

#### 获取所有标签

```typescript
import { useAllTags } from '@/hooks/queries';

function TagSelect() {
  const { data: tags } = useAllTags();

  return (
    <Select>
      {tags?.map(tag => (
        <Option key={tag.id} value={tag.id}>
          {tag.name}
        </Option>
      ))}
    </Select>
  );
}
```

#### 创建标签

```typescript
import { useCreateTag } from '@/hooks/queries';

function CreateTag() {
  const createTag = useCreateTag();

  return (
    <Button onClick={() => createTag.mutate({ name: '新标签' })}>
      创建标签
    </Button>
  );
}
```

### 数据分析

#### 获取概览数据

```typescript
import { useAnalyticsOverview } from '@/hooks/queries';

function Dashboard() {
  const { data } = useAnalyticsOverview(7); // 最近7天

  return (
    <div>
      <Statistic title="总内容数" value={data?.totalContents} />
      <Statistic title="总浏览量" value={data?.totalViews} />
    </div>
  );
}
```

#### 获取来源分析

```typescript
import { useSourceAnalytics } from '@/hooks/queries';

function SourceAnalysis() {
  const { data } = useSourceAnalytics(30); // 最近30天

  return <Chart data={data?.sourceDistribution} />;
}
```

### 搜索功能

#### 搜索内容

```typescript
import { useContentSearch } from '@/hooks/queries';

function SearchBar() {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useContentSearch({
    q: query,
    limit: 10,
  }, {
    enabled: query.length > 0, // 仅在有查询时执行
  });

  return (
    <div>
      <Input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
      />
      {isLoading && <Spin />}
      <SearchResults data={data} />
    </div>
  );
}
```

#### 搜索建议

```typescript
import { useSearchSuggestions } from '@/hooks/queries';

function SearchSuggestions({ query }: { query: string }) {
  const { data } = useSearchSuggestions(query, 5, {
    enabled: query.length >= 2,
  });

  return (
    <div>
      {data?.map(suggestion => (
        <div key={suggestion}>{suggestion}</div>
      ))}
    </div>
  );
}
```

### 操作日志

#### 获取操作日志列表

```typescript
import { useOperationLogs } from '@/hooks/queries';

function OperationLogs() {
  const { data } = useOperationLogs({
    page: 1,
    pageSize: 20,
    action: 'create',
  });

  return <LogTable data={data?.data} />;
}
```

---

## 最佳实践

### 1. 使用启用条件

仅在必要时执行查询：

```typescript
const { data } = useContentDetail(id, {
  enabled: !!id, // 仅当id存在时查询
});
```

### 2. 处理加载和错误状态

始终处理加载和错误状态：

```typescript
const { data, isLoading, error } = useContentList();

if (isLoading) return <Spin />;
if (error) return <Alert type="error" message={error.message} />;

return <div>{data?.data.map(...)}</div>;
```

### 3. 使用乐观更新

提升用户体验：

```typescript
const updateContent = useUpdateContent({
  onMutate: async (variables) => {
    // 取消相关查询
    await queryClient.cancelQueries({ queryKey: ['content', variables.id] });
    
    // 保存旧数据
    const previousData = queryClient.getQueryData(['content', variables.id]);
    
    // 乐观更新
    queryClient.setQueryData(['content', variables.id], variables.data);
    
    return { previousData };
  },
  onError: (err, variables, context) => {
    // 回滚
    if (context?.previousData) {
      queryClient.setQueryData(['content', variables.id], context.previousData);
    }
  },
  onSettled: (data, error, variables) => {
    // 刷新数据
    queryClient.invalidateQueries({ queryKey: ['content', variables.id] });
  },
});
```

### 4. 预取数据

提前加载可能需要的数据：

```typescript
import { usePrefetch } from '@/hooks/useApi';

function ContentListItem({ id }: { id: string }) {
  const { prefetchQuery } = usePrefetch();

  const handleMouseEnter = () => {
    prefetchQuery(
      queryKeys.content.detail(id),
      `/api/content/${id}`
    );
  };

  return <div onMouseEnter={handleMouseEnter}>...</div>;
}
```

### 5. 分页处理

使用分页查询hook：

```typescript
import { usePaginatedQuery } from '@/hooks/useApi';

function PaginatedList() {
  const [page, setPage] = useState(1);
  
  const { data, isLoading } = usePaginatedQuery('/api/content', {
    page,
    pageSize: 20,
  });

  return (
    <div>
      <List dataSource={data?.data} />
      <Pagination 
        current={page}
        total={data?.pagination.total}
        onChange={setPage}
      />
    </div>
  );
}
```

### 6. 无限滚动

使用无限查询hook：

```typescript
import { useInfiniteScrollQuery } from '@/hooks/useApi';

function InfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteScrollQuery('/api/content', {
    pageSize: 20,
  });

  return (
    <div>
      {data?.pages.map((page) =>
        page.data.map((item) => <Item key={item.id} {...item} />)
      )}
      {hasNextPage && (
        <Button 
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
        >
          加载更多
        </Button>
      )}
    </div>
  );
}
```

### 7. 刷新数据

使用invalidateQueries刷新缓存：

```typescript
import { useInvalidateQueries } from '@/hooks/useApi';

function RefreshButton() {
  const { invalidateContent } = useInvalidateQueries();

  const handleRefresh = () => {
    invalidateContent(); // 刷新所有内容相关查询
  };

  return <Button onClick={handleRefresh}>刷新</Button>;
}
```

### 8. 依赖查询

当一个查询依赖另一个查询的结果：

```typescript
function ContentWithCategory({ contentId }: { contentId: string }) {
  // 先获取内容
  const { data: content } = useContentDetail(contentId);
  
  // 基于内容的分类ID获取分类详情
  const { data: category } = useCategoryDetail(
    content?.categoryId,
    {
      enabled: !!content?.categoryId, // 仅当有分类ID时查询
    }
  );

  return <div>{category?.name}</div>;
}
```

---

## 迁移指南

### 从旧架构迁移

#### 旧架构（手动状态管理）

```typescript
// ❌ 旧方式
function ContentList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await apiClient.get('/api/content');
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) return <Spin />;
  if (error) return <Alert message={error.message} />;

  return <List dataSource={data} />;
}
```

#### 新架构（React Query）

```typescript
// ✅ 新方式
import { useContentList } from '@/hooks/queries';

function ContentList() {
  const { data, isLoading, error } = useContentList();

  if (isLoading) return <Spin />;
  if (error) return <Alert message={error.message} />;

  return <List dataSource={data?.data} />;
}
```

### 迁移步骤

1. **识别数据获取逻辑**: 找到所有使用 `useState` + `useEffect` 或直接 `apiClient` 调用的地方
2. **选择对应的Hook**: 从 `src/hooks/queries/` 找到对应的业务领域hook
3. **替换代码**: 使用React Query hook替换手动状态管理
4. **处理回调**: 将成功/错误处理移到mutation的 `onSuccess` / `onError` 回调
5. **测试功能**: 确保数据获取和状态管理正常工作

---

## 常见问题

### 1. 如何禁用自动重新获取？

```typescript
const { data } = useContentList({
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
});
```

### 2. 如何手动刷新数据？

```typescript
const { data, refetch } = useContentList();

// 手动刷新
const handleRefresh = () => {
  refetch();
};
```

### 3. 如何处理依赖查询？

使用 `enabled` 选项：

```typescript
const { data: user } = useUser();
const { data: posts } = useUserPosts(user?.id, {
  enabled: !!user?.id,
});
```

### 4. 如何处理表单提交？

```typescript
const createContent = useCreateContent({
  onSuccess: () => {
    message.success('创建成功');
    form.resetFields();
  },
  onError: (error) => {
    message.error(error.message);
  },
});

const handleSubmit = (values: ContentInput) => {
  createContent.mutate(values);
};
```

### 5. 如何处理文件上传？

```typescript
const uploadImage = usePost('/api/upload', {
  apiOptions: {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  },
});

const handleUpload = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  uploadImage.mutate(formData);
};
```

### 6. 如何调试查询？

使用React Query Devtools（已在项目中配置）：

```typescript
// 开发环境下自动启用
// 可在浏览器右下角看到React Query图标
```

### 7. 如何处理认证错误？

全局错误处理器会自动处理401/403错误并重定向到登录页：

```typescript
// src/lib/error-handler.ts 中已配置
// 无需额外处理
```

### 8. 如何自定义缓存时间？

```typescript
const { data } = useContentList({
  staleTime: 10 * 60 * 1000, // 10分钟
  gcTime: 30 * 60 * 1000,     // 30分钟
});
```

---

## 相关资源

- [React Query官方文档](https://tanstack.com/query/latest)
- [项目API文档](./API_RESPONSE_FORMAT.md)
- [错误处理指南](../src/lib/error-handler.ts)
- [缓存配置](../src/lib/cache-config.ts)
- [重构计划文档](../react_query_refactor_plan.md)

---

## 总结

React Query架构为项目带来了：

- ✅ 统一的数据获取模式
- ✅ 自动缓存和状态管理
- ✅ 优秀的开发体验
- ✅ 更好的性能
- ✅ 更少的样板代码

遵循本指南的最佳实践，可以充分发挥React Query的优势，构建高性能、可维护的应用。
