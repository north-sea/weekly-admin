# 去重和聚合内容处理方案

## 问题 1：基于 Karakeep 的去重

### 去重策略

Karakeep 是用户的个人收藏服务，内容存储在 `drafts` 表中。需要确保从 RSS 等外部源抓取的内容不会与 Karakeep 已有的内容重复。

### 去重检查流程

```
新抓取的内容（URL）
    ↓
检查 1: drafts 表（Karakeep 同步）
    ↓ 不存在
检查 2: contents 表（已发布内容）
    ↓ 不存在
检查 3: URL 规范化对比
    ↓ 不重复
写入 contents 表
```

### 实现方案

#### 1. 数据库查询去重

**文件**: `admin/src/lib/rss/deduplicator.ts`

```typescript
export class Deduplicator {
  /**
   * 检查 URL 是否已存在
   */
  async isDuplicate(url: string): Promise<{
    exists: boolean
    source?: 'drafts' | 'contents'
    id?: number
  }> {
    // 规范化 URL
    const normalizedUrl = this.normalizeUrl(url)

    // 1. 检查 drafts 表（Karakeep 同步）
    const draft = await prisma.draft.findFirst({
      where: {
        OR: [
          { url: normalizedUrl },
          { url: url },
        ],
      },
      select: { id: true },
    })

    if (draft) {
      return { exists: true, source: 'drafts', id: draft.id }
    }

    // 2. 检查 contents 表
    const content = await prisma.content.findFirst({
      where: {
        OR: [
          { sourceUrl: normalizedUrl },
          { sourceUrl: url },
        ],
      },
      select: { id: true },
    })

    if (content) {
      return { exists: true, source: 'contents', id: content.id }
    }

    return { exists: false }
  }

  /**
   * 批量去重检查
   */
  async batchCheck(urls: string[]): Promise<Map<string, boolean>> {
    const normalizedUrls = urls.map(url => this.normalizeUrl(url))
    const allUrls = [...urls, ...normalizedUrls]

    // 批量查询 drafts
    const drafts = await prisma.draft.findMany({
      where: { url: { in: allUrls } },
      select: { url: true },
    })

    // 批量查询 contents
    const contents = await prisma.content.findMany({
      where: { sourceUrl: { in: allUrls } },
      select: { sourceUrl: true },
    })

    // 构建去重映射
    const existingUrls = new Set([
      ...drafts.map(d => d.url),
      ...contents.map(c => c.sourceUrl),
    ])

    const result = new Map<string, boolean>()
    for (const url of urls) {
      const normalized = this.normalizeUrl(url)
      const exists = existingUrls.has(url) || existingUrls.has(normalized)
      result.set(url, exists)
    }

    return result
  }

  /**
   * URL 规范化
   * 处理常见的 URL 变体
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)

      // 移除 www 前缀
      urlObj.hostname = urlObj.hostname.replace(/^www\./, '')

      // 移除尾部斜杠
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '')

      // 移除常见的跟踪参数
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign',
        'utm_term', 'utm_content',
        'ref', 'source', 'from',
      ]
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param)
      })

      // 排序查询参数（确保一致性）
      const sortedParams = new URLSearchParams(
        Array.from(urlObj.searchParams.entries()).sort()
      )
      urlObj.search = sortedParams.toString()

      return urlObj.toString()
    } catch {
      // 如果 URL 无效，返回原始值
      return url
    }
  }

  /**
   * 相似度检查（可选）
   * 检查标题相似度，防止同一内容的不同 URL
   */
  async checkSimilarity(title: string, threshold = 0.8): Promise<boolean> {
    // 查询最近的内容
    const recentContents = await prisma.content.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近 30 天
        },
      },
      select: { title: true },
      take: 1000,
    })

    // 计算相似度
    for (const content of recentContents) {
      const similarity = this.calculateSimilarity(title, content.title)
      if (similarity >= threshold) {
        return true // 发现相似内容
      }
    }

    return false
  }

  /**
   * 计算字符串相似度（Levenshtein 距离）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    const matrix: number[][] = []

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    const distance = matrix[len1][len2]
    const maxLen = Math.max(len1, len2)
    return 1 - distance / maxLen
  }
}
```

#### 2. 去重报告

在抓取完成后，生成去重报告：

```typescript
interface DeduplicationReport {
  total: number
  new: number
  duplicates: {
    fromDrafts: number
    fromContents: number
  }
  details: Array<{
    url: string
    title: string
    reason: 'draft' | 'content' | 'similar'
    existingId?: number
  }>
}
```

---

## 问题 2：RSS 聚合内容处理

### 聚合内容识别

某些 RSS 源本身就是聚合平台，一个 RSS 条目包含多个子内容链接。

**常见聚合源**：
- Hacker News：讨论帖 + 外部链接
- daily.dev：文章聚合
- 周刊类 RSS：多个推荐链接
- Reddit：帖子 + 外部链接

### 处理策略

#### 策略 1：配置驱动（推荐）

在 RSS 源配置中标记是否为聚合源：

```yaml
sources:
  - name: "Hacker News"
    url: "https://hnrss.org/frontpage"
    category: "文章"
    type: "aggregator"  # 标记为聚合源
    aggregator_config:
      extract_links: true
      max_links_per_item: 10
      link_selector: "a[href]"  # CSS 选择器
      exclude_domains: ["news.ycombinator.com"]  # 排除的域名
```

#### 策略 2：智能识别

自动识别聚合内容：

```typescript
export class AggregatorDetector {
  /**
   * 检测是否为聚合内容
   */
  isAggregator(item: RSSItem): boolean {
    // 1. 检查链接数量
    const linkCount = this.extractLinks(item.content).length
    if (linkCount > 5) return true

    // 2. 检查标题模式
    const aggregatorPatterns = [
      /周刊/,
      /weekly/i,
      /digest/i,
      /roundup/i,
      /collection/i,
    ]
    if (aggregatorPatterns.some(p => p.test(item.title))) {
      return true
    }

    // 3. 检查内容结构
    if (this.hasListStructure(item.content)) {
      return true
    }

    return false
  }

  /**
   * 检查是否有列表结构
   */
  private hasListStructure(html: string): boolean {
    const $ = cheerio.load(html)
    const lists = $('ul, ol')

    // 如果有多个列表项，且每个都包含链接
    for (const list of lists) {
      const items = $(list).find('li')
      if (items.length >= 5) {
        const itemsWithLinks = items.filter((_, el) =>
          $(el).find('a').length > 0
        ).length

        if (itemsWithLinks / items.length > 0.8) {
          return true
        }
      }
    }

    return false
  }
}
```

### 聚合内容处理流程

```
RSS 条目
    ↓
检测是否为聚合内容
    ↓ 是
提取所有子链接
    ↓
过滤和去重
    ↓
为每个子链接创建独立的 content
    ↓
（可选）保留聚合关系
```

### 实现方案

**文件**: `admin/src/lib/rss/aggregator-handler.ts`

```typescript
export interface AggregatedLink {
  url: string
  title?: string
  description?: string
  order: number
}

export class AggregatorHandler {
  /**
   * 处理聚合内容
   */
  async processAggregator(
    item: RSSItem,
    config: AggregatorConfig
  ): Promise<AggregatedLink[]> {
    const links = this.extractLinks(item.content, config)

    // 过滤和去重
    const filtered = await this.filterLinks(links, config)

    return filtered
  }

  /**
   * 提取链接
   */
  private extractLinks(
    html: string,
    config: AggregatorConfig
  ): AggregatedLink[] {
    const $ = cheerio.load(html)
    const links: AggregatedLink[] = []
    let order = 0

    // 使用配置的选择器
    const selector = config.link_selector || 'a[href]'
    $(selector).each((_, el) => {
      const $el = $(el)
      const url = $el.attr('href')

      if (!url) return

      // 过滤排除的域名
      if (this.isExcluded(url, config.exclude_domains)) {
        return
      }

      // 提取标题和描述
      const title = $el.text().trim() || $el.attr('title')
      const description = $el.closest('li, p').text().trim()

      links.push({
        url: this.normalizeUrl(url),
        title,
        description,
        order: order++,
      })
    })

    // 限制数量
    return links.slice(0, config.max_links_per_item || 10)
  }

  /**
   * 过滤链接
   */
  private async filterLinks(
    links: AggregatedLink[],
    config: AggregatorConfig
  ): Promise<AggregatedLink[]> {
    const filtered: AggregatedLink[] = []

    for (const link of links) {
      // 1. URL 有效性检查
      if (!this.isValidUrl(link.url)) continue

      // 2. 去重检查
      const deduplicator = new Deduplicator()
      const duplicate = await deduplicator.isDuplicate(link.url)
      if (duplicate.exists) continue

      // 3. 域名白名单/黑名单
      if (!this.isAllowedDomain(link.url, config)) continue

      filtered.push(link)
    }

    return filtered
  }

  /**
   * 检查是否为排除的域名
   */
  private isExcluded(url: string, excludeDomains?: string[]): boolean {
    if (!excludeDomains || excludeDomains.length === 0) return false

    try {
      const urlObj = new URL(url)
      return excludeDomains.some(domain =>
        urlObj.hostname.includes(domain)
      )
    } catch {
      return false
    }
  }

  /**
   * 检查 URL 有效性
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      // 只接受 http 和 https
      return ['http:', 'https:'].includes(urlObj.protocol)
    } catch {
      return false
    }
  }

  /**
   * 检查是否为允许的域名
   */
  private isAllowedDomain(url: string, config: AggregatorConfig): boolean {
    // 如果没有配置白名单，则允许所有
    if (!config.allowed_domains || config.allowed_domains.length === 0) {
      return true
    }

    try {
      const urlObj = new URL(url)
      return config.allowed_domains.some(domain =>
        urlObj.hostname.includes(domain)
      )
    } catch {
      return false
    }
  }

  private normalizeUrl(url: string): string {
    // 复用 Deduplicator 的 normalizeUrl 方法
    return new Deduplicator().normalizeUrl(url)
  }
}
```

### 聚合关系保留（可选）

如果需要保留聚合源和子内容的关系：

```prisma
model ContentRelation {
  id          Int      @id @default(autoincrement())
  parentId    Int      @map("parent_id")  // 聚合源
  childId     Int      @map("child_id")   // 子内容
  relationType String  @map("relation_type") // "aggregated_from"
  order       Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")

  parent      Content  @relation("ParentContent", fields: [parentId], references: [id])
  child       Content  @relation("ChildContent", fields: [childId], references: [id])

  @@map("content_relations")
}
```

---

## 完整的 RSS 抓取流程（更新）

```
1. 抓取 RSS 源
    ↓
2. 解析 RSS 条目
    ↓
3. 检测是否为聚合内容
    ↓
    ├─ 是 → 提取子链接 → 为每个子链接执行 4-8
    └─ 否 → 继续
    ↓
4. URL 规范化
    ↓
5. 去重检查（drafts + contents）
    ↓ 不重复
6. 抓取原文内容
    ↓
7. AI 评分和生成摘要
    ↓
8. 提取图片
    ↓
9. 写入 contents 表
```

---

## 配置文件更新

**文件**: `weekly/config/rss-sources.yaml`

```yaml
sources:
  # 普通 RSS 源
  - name: "OpenAI Blog"
    url: "https://openai.com/blog/rss.xml"
    category: "文章"
    type: "normal"  # 普通源
    enabled: true

  # 聚合 RSS 源
  - name: "Hacker News"
    url: "https://hnrss.org/frontpage"
    category: "文章"
    type: "aggregator"  # 聚合源
    enabled: true
    aggregator_config:
      # 是否提取子链接
      extract_links: true

      # 每个条目最多提取几个链接
      max_links_per_item: 5

      # CSS 选择器（提取哪些链接）
      link_selector: "a[href]"

      # 排除的域名（不提取这些域名的链接）
      exclude_domains:
        - "news.ycombinator.com"
        - "ycombinator.com"

      # 允许的域名（只提取这些域名的链接，为空则不限制）
      allowed_domains: []

      # 是否保留聚合关系
      keep_relation: false

  - name: "daily.dev"
    url: "https://daily.dev/rss"
    category: "文章"
    type: "aggregator"
    enabled: true
    aggregator_config:
      extract_links: true
      max_links_per_item: 10
      exclude_domains: ["daily.dev"]

# 去重配置
deduplication:
  # 是否启用 URL 规范化
  normalize_url: true

  # 是否检查标题相似度
  check_similarity: true

  # 标题相似度阈值（0-1）
  similarity_threshold: 0.8

  # 检查范围（天数）
  check_days: 30
```

---

## API 接口设计

### 去重检查 API

```typescript
// POST /api/rss/check-duplicate
{
  "url": "https://example.com/article"
}

// Response
{
  "exists": true,
  "source": "drafts",  // "drafts" | "contents"
  "id": 123,
  "title": "已存在的内容标题"
}
```

### 聚合内容预览 API

```typescript
// POST /api/rss/preview-aggregator
{
  "url": "https://hnrss.org/frontpage",
  "item_index": 0  // 预览第几个条目
}

// Response
{
  "is_aggregator": true,
  "links": [
    {
      "url": "https://example.com/article1",
      "title": "Article 1",
      "is_duplicate": false
    },
    {
      "url": "https://example.com/article2",
      "title": "Article 2",
      "is_duplicate": true,
      "existing_source": "drafts"
    }
  ]
}
```

---

## UI 设计

### RSS 抓取结果页面

```
┌─────────────────────────────────────────────────────┐
│  RSS 抓取结果                                        │
├─────────────────────────────────────────────────────┤
│  来源: Hacker News                                   │
│  抓取时间: 2024-01-23 10:00                         │
│  总条目: 30                                          │
│                                                      │
│  ✅ 新增内容: 12 条                                  │
│  ⚠️  重复内容: 18 条                                 │
│     - 来自 Karakeep: 8 条                           │
│     - 来自已发布内容: 10 条                          │
│                                                      │
│  📊 聚合内容处理:                                    │
│     - 检测到聚合条目: 5 条                           │
│     - 提取子链接: 25 条                              │
│     - 去重后: 12 条                                  │
│                                                      │
│  [查看详情] [查看重复内容]                           │
└─────────────────────────────────────────────────────┘
```

### 重复内容详情

```
┌─────────────────────────────────────────────────────┐
│  重复内容详情                                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ 标题: How to Build a Startup                 │   │
│  │ URL: https://example.com/startup             │   │
│  │ 来源: Karakeep (drafts 表)                   │   │
│  │ 添加时间: 2024-01-20                         │   │
│  │ [查看原内容]                                  │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 标题: AI Safety Research                     │   │
│  │ URL: https://example.com/ai-safety           │   │
│  │ 来源: 已发布内容 (contents 表)               │   │
│  │ 发布时间: 2024-01-15                         │   │
│  │ [查看原内容]                                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 性能优化

### 批量去重

使用批量查询减少数据库请求：

```typescript
// 一次查询检查所有 URL
const urls = items.map(item => item.url)
const duplicateMap = await deduplicator.batchCheck(urls)

// 过滤重复
const newItems = items.filter(item => !duplicateMap.get(item.url))
```

### 缓存策略

```typescript
// 缓存最近检查的 URL（避免重复查询）
const urlCache = new Map<string, boolean>()

async function isDuplicateWithCache(url: string): Promise<boolean> {
  if (urlCache.has(url)) {
    return urlCache.get(url)!
  }

  const result = await deduplicator.isDuplicate(url)
  urlCache.set(url, result.exists)

  return result.exists
}
```

---

## 测试用例

### 去重测试

```typescript
describe('Deduplicator', () => {
  it('should detect duplicate from drafts', async () => {
    const url = 'https://example.com/article'
    // 先插入到 drafts
    await prisma.draft.create({ data: { url } })

    const result = await deduplicator.isDuplicate(url)
    expect(result.exists).toBe(true)
    expect(result.source).toBe('drafts')
  })

  it('should normalize URL correctly', async () => {
    const url1 = 'https://www.example.com/article?utm_source=twitter'
    const url2 = 'https://example.com/article'

    const normalized1 = deduplicator.normalizeUrl(url1)
    const normalized2 = deduplicator.normalizeUrl(url2)

    expect(normalized1).toBe(normalized2)
  })
})
```

### 聚合内容测试

```typescript
describe('AggregatorHandler', () => {
  it('should extract links from aggregator', async () => {
    const html = `
      <ul>
        <li><a href="https://example.com/1">Article 1</a></li>
        <li><a href="https://example.com/2">Article 2</a></li>
      </ul>
    `

    const links = await handler.extractLinks(html, config)
    expect(links).toHaveLength(2)
  })

  it('should exclude specified domains', async () => {
    const config = {
      exclude_domains: ['example.com']
    }

    const links = [
      { url: 'https://example.com/article' },
      { url: 'https://other.com/article' }
    ]

    const filtered = await handler.filterLinks(links, config)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].url).toContain('other.com')
  })
})
```
