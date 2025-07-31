# Weekly内容管理系统设计文档

## 概述

Weekly内容管理系统是一个基于Next.js 15的全栈应用，采用现代化的技术栈构建专业的内容管理平台。系统支持Blog和Weekly两种内容类型，提供完整的内容生命周期管理、周刊编辑发布、高级搜索筛选等功能。

## 技术架构

### 整体架构图

```mermaid
graph TB
    subgraph "前端层"
        A[Next.js 15 + TypeScript]
        B[Ant Design + Pro-component]
        C[React Hook Form + Zod]
        D[Zustand状态管理]
    end
    
    subgraph "API层"
        E[Next.js API Routes]
        F[JWT认证中间件]
        G[数据验证层]
    end
    
    subgraph "业务逻辑层"
        H[内容管理服务]
        I[用户认证服务]
        J[搜索服务]
        K[周刊管理服务]
    end
    
    subgraph "数据层"
        L[Prisma ORM]
        M[MySQL数据库]
        N[Meilisearch搜索引擎]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    E --> F
    F --> G
    G --> H
    G --> I
    G --> J
    G --> K
    H --> L
    I --> L
    J --> N
    K --> L
    L --> M
```

### 技术栈选择

**前端技术栈**：
- **Next.js 15**: React全栈框架，支持SSR/SSG，API Routes
- **TypeScript**: 类型安全，提升开发效率和代码质量
- **Ant Design + Pro-component**: 企业级UI组件库，专业中后台解决方案
- **ProLayout**: 标准中后台布局组件，提供侧边栏+顶部导航的专业布局
- **PageContainer**: 页面容器组件，提供统一的页面结构和面包屑导航
- **React Hook Form + Zod**: 高性能表单处理和运行时类型验证
- **Zustand**: 轻量级状态管理，简单易用

**后端技术栈**：
- **Next.js API Routes**: 基于文件系统的API路由，与前端无缝集成
- **Prisma ORM**: 类型安全的数据库ORM，自动生成类型定义
- **bcryptjs**: 密码加密和验证
- **jsonwebtoken**: JWT token生成和验证
- **Meilisearch**: 高性能全文搜索引擎，支持中文分词

**数据存储**：
- **MySQL 8.0**: 关系型数据库，存储结构化数据
- **Meilisearch**: 搜索引擎，提供全文搜索功能

## 系统架构设计

### 目录结构

```
src/
├── app/                    # Next.js 13+ App Router
│   ├── (auth)/            # 认证相关页面
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/       # 主要功能页面（使用ProLayout）
│   │   ├── contents/      # 内容管理
│   │   ├── weekly/        # 周刊管理
│   │   ├── analytics/     # 数据分析
│   │   ├── settings/      # 系统设置
│   │   └── layout.tsx     # ProLayout布局配置
│   ├── api/               # API路由
│   │   ├── auth/
│   │   ├── contents/
│   │   ├── weekly/
│   │   ├── search/
│   │   └── analytics/
│   ├── globals.css
│   └── layout.tsx
├── components/            # 共享组件
│   ├── layout/           # 布局相关组件
│   │   ├── ProLayoutWrapper.tsx  # ProLayout包装组件
│   │   ├── MenuConfig.tsx        # 菜单配置
│   │   └── HeaderActions.tsx     # 顶部操作组件
│   ├── ui/               # 基础UI组件
│   ├── forms/            # 表单组件
│   ├── editors/          # 编辑器组件
│   └── charts/           # 图表组件
├── lib/                  # 工具库
│   ├── auth.ts           # 认证工具
│   ├── db.ts             # 数据库连接
│   ├── search.ts         # 搜索引擎
│   ├── validations.ts    # 数据验证
│   └── utils.ts          # 通用工具
├── hooks/                # 自定义Hooks
├── stores/               # Zustand状态管理
├── types/                # TypeScript类型定义
└── middleware.ts         # Next.js中间件
```

### 数据库设计

#### 核心表结构

```sql
-- 用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    display_name VARCHAR(100),
    role ENUM('admin', 'editor') DEFAULT 'editor',
    status ENUM('active', 'inactive') DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_status (status)
);

-- 内容表（扩展现有表）
-- content_type_id: 3=Blog, 4=Weekly
ALTER TABLE contents ADD COLUMN IF NOT EXISTS user_id INT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS reading_time INT DEFAULT 0;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS seo_title VARCHAR(500);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(500);

-- 周刊期号表
CREATE TABLE weekly_issues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    issue_number INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    start_date DATE,
    end_date DATE,
    published_at TIMESTAMP NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_issue_number (issue_number),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_published_at (published_at)
);

-- 周刊内容关联表
CREATE TABLE weekly_issue_contents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    weekly_issue_id INT NOT NULL,
    content_id INT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_issue_content (weekly_issue_id, content_id),
    FOREIGN KEY (weekly_issue_id) REFERENCES weekly_issues(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
    INDEX idx_sort_order (weekly_issue_id, sort_order)
);

-- 操作日志表
CREATE TABLE operation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    operation_type ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INT,
    operation_details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_operation (user_id, operation_type),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created_at (created_at)
);

-- 内容版本历史表
CREATE TABLE content_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_id INT NOT NULL,
    version_number INT NOT NULL,
    title VARCHAR(500),
    content LONGTEXT,
    description TEXT,
    source VARCHAR(500),
    source_url VARCHAR(1000),
    changes_summary TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY uk_content_version (content_id, version_number),
    INDEX idx_content_id (content_id),
    INDEX idx_created_at (created_at)
);
```

#### 数据关系图

```mermaid
erDiagram
    users ||--o{ contents : creates
    users ||--o{ weekly_issues : creates
    users ||--o{ operation_logs : performs
    users ||--o{ content_versions : creates
    
    contents ||--o{ content_tags : has
    contents ||--o{ weekly_issue_contents : belongs_to
    contents ||--o{ content_versions : has_versions
    contents }o--|| categories : belongs_to
    contents }o--|| content_types : has_type
    
    weekly_issues ||--o{ weekly_issue_contents : contains
    
    tags ||--o{ content_tags : tagged_in
    
    content_tags }o--|| contents : tags
    content_tags }o--|| tags : references
    
    weekly_issue_contents }o--|| weekly_issues : part_of
    weekly_issue_contents }o--|| contents : includes
```

## 布局设计

### ProLayout配置

系统采用ProLayout作为主要布局框架，提供标准的中后台管理界面。

#### 布局结构

```typescript
// components/layout/ProLayoutWrapper.tsx
import { ProLayout } from '@ant-design/pro-components';
import { MenuDataItem } from '@ant-design/pro-components';

interface ProLayoutWrapperProps {
  children: React.ReactNode;
}

const ProLayoutWrapper: React.FC<ProLayoutWrapperProps> = ({ children }) => {
  const menuData: MenuDataItem[] = [
    {
      path: '/dashboard',
      name: '仪表板',
      icon: 'DashboardOutlined',
    },
    {
      path: '/content',
      name: '内容管理',
      icon: 'FileTextOutlined',
      children: [
        {
          path: '/content',
          name: '内容列表',
        },
        {
          path: '/content/create',
          name: '创建内容',
        },
      ],
    },
    {
      path: '/weekly',
      name: '周刊管理',
      icon: 'CalendarOutlined',
      children: [
        {
          path: '/weekly',
          name: '周刊列表',
        },
        {
          path: '/weekly/editor',
          name: '周刊编辑',
        },
      ],
    },
    {
      path: '/search',
      name: '搜索',
      icon: 'SearchOutlined',
    },
    {
      path: '/analytics',
      name: '数据分析',
      icon: 'BarChartOutlined',
      children: [
        {
          path: '/analytics',
          name: '基础统计',
        },
        {
          path: '/analytics/advanced',
          name: '高级分析',
        },
        {
          path: '/analytics/sources',
          name: '来源分析',
        },
      ],
    },
    {
      path: '/operation-logs',
      name: '操作日志',
      icon: 'AuditOutlined',
    },
    {
      path: '/settings',
      name: '系统设置',
      icon: 'SettingOutlined',
      children: [
        {
          path: '/settings/users',
          name: '用户管理',
        },
        {
          path: '/settings/categories',
          name: '分类管理',
        },
        {
          path: '/settings/tags',
          name: '标签管理',
        },
      ],
    },
  ];

  return (
    <ProLayout
      title="Weekly内容管理系统"
      logo="/logo.svg"
      layout="mix"
      navTheme="light"
      primaryColor="#1890ff"
      fixedHeader
      fixSiderbar
      menu={{
        type: 'group',
        request: async () => menuData,
      }}
      avatarProps={{
        src: '/avatar.png',
        title: '管理员',
        size: 'small',
      }}
      actionsRender={() => [
        <HeaderActions key="actions" />,
      ]}
      menuFooterRender={(props) => (
        <div style={{ textAlign: 'center', paddingBlockStart: 12 }}>
          <div>Weekly CMS v1.0</div>
        </div>
      )}
    >
      {children}
    </ProLayout>
  );
};
```

#### PageContainer使用规范

每个功能页面都必须使用PageContainer包装：

```typescript
// 页面组件示例
import { PageContainer } from '@ant-design/pro-components';

const ContentListPage: React.FC = () => {
  return (
    <PageContainer
      title="内容管理"
      subTitle="管理Blog和Weekly内容"
      breadcrumb={{
        items: [
          { title: '首页', href: '/dashboard' },
          { title: '内容管理' },
        ],
      }}
      extra={[
        <Button key="create" type="primary" href="/content/create">
          创建内容
        </Button>,
      ]}
      tabList={[
        { tab: '全部内容', key: 'all' },
        { tab: 'Blog', key: 'blog' },
        { tab: 'Weekly', key: 'weekly' },
      ]}
      onTabChange={(key) => handleTabChange(key)}
    >
      <ContentList />
    </PageContainer>
  );
};
```

#### 响应式布局配置

```typescript
// ProLayout响应式配置
const layoutSettings = {
  // 桌面端配置
  breakpoint: {
    xs: 480,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1600,
  },
  
  // 移动端适配
  isMobile: false,
  collapsed: false,
  
  // 布局配置
  layout: 'mix', // 混合布局
  contentWidth: 'Fluid', // 流式宽度
  fixedHeader: true, // 固定头部
  fixSiderbar: true, // 固定侧边栏
  
  // 主题配置
  navTheme: 'light',
  headerTheme: 'light',
  primaryColor: '#1890ff',
  
  // 多标签页配置
  multiTab: false,
  
  // 面包屑配置
  breadcrumb: true,
};
```

## 组件设计

### 核心组件架构

#### 1. 内容管理组件

```typescript
// 内容列表组件
interface ContentListProps {
  contentType?: 'blog' | 'weekly' | 'all';
  initialFilters?: ContentFilters;
}

const ContentList: React.FC<ContentListProps> = ({
  contentType = 'all',
  initialFilters
}) => {
  // 使用ProTable实现高级表格功能
  return (
    <ProTable<Content>
      columns={getColumns(contentType)}
      request={fetchContents}
      search={{
        labelWidth: 'auto',
      }}
      options={{
        setting: true,
        reload: true,
        density: true,
      }}
      rowSelection={{
        type: 'checkbox',
      }}
      tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
        <BatchOperations
          selectedIds={selectedRowKeys}
          onComplete={onCleanSelected}
        />
      )}
    />
  );
};

// 内容编辑器组件
interface ContentEditorProps {
  contentId?: number;
  contentType: 'blog' | 'weekly';
  onSave: (content: Content) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  contentId,
  contentType,
  onSave
}) => {
  return (
    <div className="content-editor">
      <ProForm
        form={form}
        onFinish={handleSubmit}
        submitter={{
          render: (props, doms) => (
            <EditorToolbar {...props} doms={doms} />
          ),
        }}
      >
        {/* 动态字段渲染 */}
        <DynamicFields contentType={contentType} />
        
        {/* Markdown编辑器 */}
        <MarkdownEditor
          value={content}
          onChange={setContent}
          preview={previewMode}
        />
      </ProForm>
    </div>
  );
};
```

#### 2. 周刊管理组件

```typescript
// 周刊编辑器组件
interface WeeklyEditorProps {
  issueId?: number;
  onSave: (issue: WeeklyIssue) => void;
}

const WeeklyEditor: React.FC<WeeklyEditorProps> = ({
  issueId,
  onSave
}) => {
  return (
    <div className="weekly-editor">
      <div className="editor-layout">
        {/* 左侧：可选内容列表 */}
        <div className="available-contents">
          <AvailableContentsList
            onAddContent={handleAddContent}
            filters={contentFilters}
          />
        </div>
        
        {/* 中间：已选内容列表 */}
        <div className="selected-contents">
          <DragDropContext onDragEnd={handleDragEnd}>
            <SelectedContentsList
              contents={selectedContents}
              onRemove={handleRemoveContent}
            />
          </DragDropContext>
        </div>
        
        {/* 右侧：实时预览 */}
        <div className="preview-panel">
          <WeeklyPreview
            issue={currentIssue}
            contents={selectedContents}
          />
        </div>
      </div>
    </div>
  );
};
```

#### 3. 搜索组件

```typescript
// 高级搜索组件
interface AdvancedSearchProps {
  onSearch: (query: SearchQuery) => void;
  initialQuery?: SearchQuery;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  initialQuery
}) => {
  return (
    <ProForm
      form={form}
      onFinish={onSearch}
      initialValues={initialQuery}
      layout="inline"
    >
      {/* 即时搜索输入框 */}
      <ProFormText
        name="keyword"
        placeholder="搜索标题、内容..."
        fieldProps={{
          onChange: debounce(handleInstantSearch, 300),
          suffix: <SearchOutlined />,
        }}
      />
      
      {/* 高级筛选器 */}
      <ProFormSelect
        name="contentType"
        label="内容类型"
        options={contentTypeOptions}
      />
      
      <ProFormSelect
        name="status"
        label="状态"
        options={statusOptions}
      />
      
      <ProFormDateRangePicker
        name="dateRange"
        label="时间范围"
      />
      
      {/* 保存的筛选条件 */}
      <SavedFilters
        onApply={handleApplyFilter}
        onSave={handleSaveFilter}
      />
    </ProForm>
  );
};
```

### UI组件设计规范

#### Ant Design定制主题

```typescript
// theme.config.ts
export const themeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    borderRadius: 6,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: '#001529',
      triggerBg: '#002140',
    },
    Menu: {
      darkItemBg: '#001529',
      darkSubMenuItemBg: '#000c17',
    },
    Table: {
      headerBg: '#fafafa',
    },
  },
};
```

## 接口设计

### API路由设计

#### 认证相关API

```typescript
// /api/auth/login
interface LoginRequest {
  username: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    expiresIn: number;
  };
}

// /api/auth/me
interface MeResponse {
  success: boolean;
  data: {
    user: User;
  };
}
```

#### 内容管理API

```typescript
// /api/contents
interface GetContentsRequest {
  page?: number;
  pageSize?: number;
  contentType?: 'blog' | 'weekly';
  status?: ContentStatus;
  categoryId?: number;
  tagIds?: number[];
  keyword?: string;
  dateRange?: [string, string];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface GetContentsResponse {
  success: boolean;
  data: {
    contents: Content[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// /api/contents/[id]
interface UpdateContentRequest {
  title: string;
  content: string;
  description?: string; // Blog专用
  source?: string; // Weekly专用
  source_url?: string; // Weekly专用
  screenshot_api_type?: string; // Weekly专用
  recommendation_reason?: string; // Weekly专用
  category_id?: number;
  tag_ids: number[];
  status: ContentStatus;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
}
```

#### 搜索API

```typescript
// /api/search
interface SearchRequest {
  q: string;
  contentType?: 'blog' | 'weekly';
  filters?: {
    status?: ContentStatus[];
    categoryIds?: number[];
    tagIds?: number[];
    dateRange?: [string, string];
    sources?: string[]; // Weekly专用
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
}

interface SearchResponse {
  success: boolean;
  data: {
    hits: SearchHit[];
    total: number;
    page: number;
    limit: number;
    processingTimeMs: number;
    query: string;
  };
}

interface SearchHit {
  id: number;
  title: string;
  content: string;
  description?: string;
  source?: string;
  contentType: 'blog' | 'weekly';
  status: ContentStatus;
  category: Category;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  _formatted?: {
    title: string;
    content: string;
    description?: string;
  };
}
```

### 数据验证Schema

```typescript
// 使用Zod进行数据验证
export const ContentSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  content: z.string().min(1, '内容不能为空'),
  content_type_id: z.number().int().positive(),
  category_id: z.number().int().positive().optional(),
  tag_ids: z.array(z.number().int().positive()).default([]),
  status: z.enum(['draft', 'published', 'archived', 'hidden']).default('draft'),
  
  // Blog专用字段
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  cover_image: z.string().url('封面图片必须是有效的URL').optional(),
  
  // Weekly专用字段
  source: z.string().max(200, '来源名称长度不能超过200字符').optional(),
  source_url: z.string().url('来源链接必须是有效的URL').optional(),
  screenshot_api_type: z.enum(['ScreenshotLayer', 'HCTI', 'manual']).optional(),
  recommendation_reason: z.string().max(500, '推荐理由长度不能超过500字符').optional(),
  
  // SEO字段
  seo_title: z.string().max(500, 'SEO标题长度不能超过500字符').optional(),
  seo_description: z.string().max(1000, 'SEO描述长度不能超过1000字符').optional(),
  seo_keywords: z.string().max(500, 'SEO关键词长度不能超过500字符').optional(),
});

export const WeeklyIssueSchema = z.object({
  issue_number: z.number().int().positive('期号必须是正整数'),
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确'),
  content_ids: z.array(z.number().int().positive()).default([]),
});
```

## 搜索引擎集成

### Meilisearch配置

```typescript
// lib/search.ts
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_MASTER_KEY,
});

// 内容索引配置
export const setupContentIndex = async () => {
  const index = client.index('contents');
  
  // 设置可搜索字段
  await index.updateSearchableAttributes([
    'title',
    'description',
    'content',
    'source',
    'category_name',
    'tag_names'
  ]);
  
  // 设置可筛选字段
  await index.updateFilterableAttributes([
    'content_type_id',
    'status',
    'category_id',
    'tag_ids',
    'created_at',
    'published_at',
    'source'
  ]);
  
  // 设置可排序字段
  await index.updateSortableAttributes([
    'created_at',
    'updated_at',
    'published_at',
    'view_count',
    'word_count'
  ]);
  
  // 设置排序规则
  await index.updateRankingRules([
    'words',
    'typo',
    'exactness',
    'proximity',
    'attribute',
    'sort'
  ]);
  
  // 设置中文分词
  await index.updateSettings({
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8
      }
    },
    pagination: {
      maxTotalHits: 1000
    }
  });
};

// 数据同步函数
export const syncContentToSearch = async (content: Content) => {
  const index = client.index('contents');
  
  const searchDocument = {
    id: content.id,
    title: content.title,
    description: content.description,
    content: content.content,
    source: content.source,
    content_type_id: content.content_type_id,
    status: content.status,
    category_id: content.category_id,
    category_name: content.category?.name,
    tag_ids: content.tags?.map(t => t.id) || [],
    tag_names: content.tags?.map(t => t.name).join(' ') || '',
    created_at: content.created_at,
    updated_at: content.updated_at,
    published_at: content.published_at,
    view_count: content.view_count || 0,
    word_count: content.word_count || 0,
  };
  
  await index.addDocuments([searchDocument]);
};
```

## 错误处理

### 统一错误处理机制

```typescript
// lib/errors.ts
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SEARCH_ERROR: 'SEARCH_ERROR',
} as const;

// API错误处理中间件
export const errorHandler = (error: Error, req: NextRequest) => {
  if (error instanceof AppError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    }, { status: error.statusCode });
  }

  // 未知错误
  console.error('Unexpected error:', error);
  return NextResponse.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
    },
    timestamp: new Date().toISOString(),
  }, { status: 500 });
};
```

## 测试策略

### 测试架构

```typescript
// 单元测试示例
describe('ContentService', () => {
  describe('createContent', () => {
    it('should create blog content with required fields', async () => {
      const blogData = {
        title: '测试博客',
        content: '博客内容',
        description: '博客描述',
        content_type_id: 3, // Blog
        status: 'draft' as const,
      };

      const result = await ContentService.create(blogData);
      
      expect(result.success).toBe(true);
      expect(result.data.title).toBe(blogData.title);
      expect(result.data.content_type_id).toBe(3);
    });

    it('should create weekly content with source information', async () => {
      const weeklyData = {
        title: '测试周刊内容',
        content: '周刊内容',
        source: '测试来源',
        source_url: 'https://example.com',
        content_type_id: 4, // Weekly
        status: 'published' as const,
      };

      const result = await ContentService.create(weeklyData);
      
      expect(result.success).toBe(true);
      expect(result.data.source).toBe(weeklyData.source);
      expect(result.data.content_type_id).toBe(4);
    });
  });
});

// 集成测试示例
describe('Content API', () => {
  it('should return filtered contents', async () => {
    const response = await fetch('/api/contents?contentType=blog&status=published');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.contents).toBeInstanceOf(Array);
    expect(data.data.contents.every(c => c.content_type_id === 3)).toBe(true);
  });
});
```

## 性能优化

### 前端性能优化

1. **代码分割**: 使用Next.js动态导入和路由级别的代码分割
2. **图片优化**: 使用Next.js Image组件进行图片优化
3. **缓存策略**: 使用React Query进行数据缓存和状态管理
4. **虚拟滚动**: 大列表使用虚拟滚动技术
5. **懒加载**: 非关键组件使用懒加载

### 后端性能优化

1. **数据库索引**: 为常用查询字段添加索引
2. **查询优化**: 使用Prisma的include和select优化查询
3. **分页处理**: 所有列表接口使用分页
4. **缓存机制**: 使用Redis缓存热点数据（可选）
5. **搜索优化**: Meilisearch索引优化和增量同步

### 监控和分析

```typescript
// 性能监控
export const performanceMonitor = {
  // API响应时间监控
  trackApiResponse: (endpoint: string, duration: number) => {
    if (duration > 1000) {
      console.warn(`Slow API response: ${endpoint} took ${duration}ms`);
    }
  },

  // 搜索性能监控
  trackSearchPerformance: (query: string, duration: number, hits: number) => {
    console.log(`Search "${query}" took ${duration}ms, found ${hits} results`);
  },

  // 数据库查询监控
  trackDatabaseQuery: (query: string, duration: number) => {
    if (duration > 500) {
      console.warn(`Slow database query: ${query} took ${duration}ms`);
    }
  },
};
```

## 安全设计

### 认证和授权

```typescript
// JWT认证中间件
export const authMiddleware = async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('未提供认证令牌', 401, ErrorCodes.AUTHENTICATION_ERROR);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, role: true, status: true }
    });

    if (!user || user.status !== 'active') {
      throw new AppError('用户不存在或已被禁用', 401, ErrorCodes.AUTHENTICATION_ERROR);
    }

    return user;
  } catch (error) {
    throw new AppError('无效的认证令牌', 401, ErrorCodes.AUTHENTICATION_ERROR);
  }
};

// 权限检查
export const requireRole = (requiredRole: 'admin' | 'editor') => {
  return (user: User) => {
    if (requiredRole === 'admin' && user.role !== 'admin') {
      throw new AppError('权限不足', 403, ErrorCodes.AUTHORIZATION_ERROR);
    }
  };
};
```

### 数据验证和清理

```typescript
// 输入清理
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
    .replace(/javascript:/gi, '') // 移除javascript:协议
    .replace(/on\w+\s*=/gi, ''); // 移除事件处理器
};

// SQL注入防护（Prisma自动处理，但仍需注意动态查询）
export const buildSafeQuery = (filters: ContentFilters) => {
  const where: Prisma.ContentWhereInput = {};
  
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword } },
      { content: { contains: filters.keyword } },
      { description: { contains: filters.keyword } },
    ];
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.contentType) {
    where.content_type_id = filters.contentType === 'blog' ? 3 : 4;
  }
  
  return where;
};
```

## 部署配置

### Docker配置

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# 安装依赖
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 构建应用
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 生产镜像
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://weekly_user:password@mysql:3306/weekly_blog
      - JWT_SECRET=your-jwt-secret
      - MEILISEARCH_HOST=http://meilisearch:7700
      - MEILISEARCH_MASTER_KEY=your-master-key
    depends_on:
      - mysql
      - meilisearch
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=weekly_blog
      - MYSQL_USER=weekly_user
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "3306:3306"
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.5
    environment:
      - MEILI_MASTER_KEY=your-master-key
      - MEILI_ENV=production
    volumes:
      - meilisearch_data:/meili_data
    ports:
      - "7700:7700"
    restart: unless-stopped

volumes:
  mysql_data:
  meilisearch_data:
```

这个设计文档涵盖了系统的技术架构、数据库设计、组件设计、API接口、搜索引擎集成、错误处理、测试策略、性能优化、安全设计和部署配置等各个方面，为开发团队提供了完整的技术实现指导。