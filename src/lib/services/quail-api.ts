/**
 * Quail API 客户端服务
 * 用于发布周刊到 Quail Newsletter 平台并管理订阅者
 *
 * API 文档: https://docs.quaily.com/developer/
 */

import ky, { HTTPError } from 'ky';

// 环境变量配置
const QUAIL_API_HOST = process.env.QUAIL_API_HOST || 'https://api.quail.ink';
const QUAIL_API_KEY = process.env.QUAIL_API_KEY || '';
const QUAIL_CHANNEL_SLUG = process.env.QUAIL_CHANNEL_SLUG || '';
const QUAIL_LIST_ID = process.env.QUAIL_LIST_ID || '';

// ============ 类型定义 ============

// 用户对象
export interface QuailUser {
  id: number;
  name: string;
  bio?: string;
  email?: string;
  avatar_url?: string;
  social_ids?: Array<{ platform: string; value: string }>;
}

// 频道对象
export interface QuailChannel {
  id: number;
  slug: string;
  title: string;
  description?: string;
  avatar_url?: string;
  subscriber_count?: number;
  user: QuailUser;
  created_at: string;
  updated_at: string;
}

// 文章对象
export interface QuailPost {
  id: string;
  slug: string;
  title: string;
  content?: string;
  content_free?: string;
  content_paid?: string;
  summary?: string;
  cover_image?: string;
  tags?: string[];
  theme?: string;
  page_view_count: number;
  email_view_count: number;
  publish_at?: string;
  first_published_at?: string;
  created_at: string;
  updated_at: string;
}

// 订阅对象
export interface QuailSubscription {
  id: number;
  type: 'free' | 'silver' | 'gold';
  paid_expiry?: string;
  email_enabled: boolean;
  user: QuailUser;
  channel?: QuailChannel;
  created_at: string;
  updated_at: string;
}

// 创建文章请求
export interface CreatePostRequest {
  title: string;
  slug: string;
  content: string;
  summary?: string;
  cover_image?: string;
  tags?: string; // 逗号分隔的字符串，如 "tag1,tag2,tag3"
  theme?: string;
  publish_at?: string;
}

// 更新文章请求
export interface UpdatePostRequest {
  title?: string;
  content?: string;
  summary?: string;
  cover_image?: string;
  tags?: string; // 逗号分隔的字符串
  theme?: string;
  publish_at?: string;
}

// 添加订阅者请求
export interface AddSubscriberRequest {
  email: string;
  name?: string;
}

// API 响应类型
export interface QuailResponse<T> {
  data: T;
  ts: number;
}

// 分页响应（Quail API 实际返回格式）
export interface QuailPaginatedResponse<T> {
  pagination: {
    current: number;
    offset: number;
    limit: number;
    next_offset: number;
    total: number;
  };
  items: T[];
}

// 错误类型
export class QuailApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'QuailApiError';
  }
}

/**
 * Quail API 客户端类
 */
export class QuailApiClient {
  private kyInstance: typeof ky;
  private channelSlug: string;
  private listId: string;

  constructor(options?: {
    channelSlug?: string;
    listId?: string;
  }) {
    this.channelSlug = options?.channelSlug || QUAIL_CHANNEL_SLUG;
    this.listId = options?.listId || QUAIL_LIST_ID;

    this.kyInstance = ky.create({
      prefixUrl: QUAIL_API_HOST,
      timeout: 30000,
      retry: {
        limit: 2,
        methods: ['get'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            if (QUAIL_API_KEY) {
              request.headers.set('Authorization', `Bearer ${QUAIL_API_KEY}`);
            }
            request.headers.set('Content-Type', 'application/json');
          }
        ],
        afterResponse: [
          async (_request, _options, response) => {
            if (!response.ok) {
              console.error('Quail API 错误:', {
                status: response.status,
                statusText: response.statusText,
              });
            }
            return response;
          }
        ],
      }
    });
  }

  // ============ Post API ============

  /**
   * 获取文章列表
   * GET /lists/:channel_slug/posts
   */
  async getPosts(options?: {
    page?: number;
    limit?: number;
    public?: boolean;
  }): Promise<QuailPaginatedResponse<QuailPost>> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', String(options.page));
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.public !== undefined) params.append('public', String(options.public));

      const url = `lists/${this.channelSlug}/posts${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.kyInstance.get(url).json<QuailPaginatedResponse<QuailPost>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取文章列表失败');
    }
  }

  /**
   * 获取单篇文章
   * GET /lists/:channel_slug/posts/:post_id
   */
  async getPost(postId: string): Promise<QuailResponse<QuailPost>> {
    try {
      const response = await this.kyInstance
        .get(`lists/${this.channelSlug}/posts/${postId}`)
        .json<QuailResponse<QuailPost>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取文章失败');
    }
  }

  /**
   * 通过 slug 获取文章
   * GET /lists/:channel_slug/posts/:post_slug
   */
  async getPostBySlug(postSlug: string): Promise<QuailResponse<QuailPost> | null> {
    try {
      const response = await this.kyInstance
        .get(`lists/${this.channelSlug}/posts/${postSlug}`)
        .json<QuailResponse<QuailPost>>();
      return response;
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return null;
      }
      throw this.handleError(error, '获取文章失败');
    }
  }

  /**
   * 创建文章
   * POST /lists/:channel_slug/posts
   */
  async createPost(data: CreatePostRequest): Promise<QuailResponse<QuailPost>> {
    try {
      const response = await this.kyInstance
        .post(`lists/${this.channelSlug}/posts`, { json: data })
        .json<QuailResponse<QuailPost>>();
      return response;
    } catch (error) {
      // 尝试获取详细错误信息
      if (error instanceof HTTPError) {
        try {
          const errorBody = await error.response.clone().json();
          console.error('Quail API 错误详情:', errorBody);
        } catch {
          // 忽略解析错误
        }
      }
      throw this.handleError(error, '创建文章失败');
    }
  }

  /**
   * 更新文章
   * PUT /lists/:channel_slug/posts/:post_slug
   */
  async updatePost(postSlug: string, data: UpdatePostRequest): Promise<QuailResponse<QuailPost>> {
    try {
      console.log('更新 Quail 文章:', postSlug);
      const response = await this.kyInstance
        .put(`lists/${this.channelSlug}/posts/${postSlug}`, { json: data })
        .json<QuailResponse<QuailPost>>();
      console.log('成功更新 Quail 文章:', postSlug);
      return response;
    } catch (error) {
      throw this.handleError(error, '更新文章失败');
    }
  }

  /**
   * 删除文章
   * DELETE /lists/:channel_slug/posts/:post_slug
   */
  async deletePost(postSlug: string): Promise<void> {
    try {
      console.log('删除 Quail 文章:', postSlug);
      await this.kyInstance.delete(`lists/${this.channelSlug}/posts/${postSlug}`);
      console.log('成功删除 Quail 文章:', postSlug);
    } catch (error) {
      throw this.handleError(error, '删除文章失败');
    }
  }

  /**
   * 发布文章（公开可见）
   * PUT /lists/:channel_slug/posts/:post_slug/publish
   */
  async publishPost(postSlug: string): Promise<QuailResponse<QuailPost>> {
    try {
      console.log('发布 Quail 文章:', postSlug);
      const response = await this.kyInstance
        .put(`lists/${this.channelSlug}/posts/${postSlug}/publish`)
        .json<QuailResponse<QuailPost>>();
      console.log('成功发布 Quail 文章:', postSlug);
      return response;
    } catch (error) {
      throw this.handleError(error, '发布文章失败');
    }
  }

  /**
   * 取消发布
   * PUT /lists/:channel_slug/posts/:post_slug/unpublish
   */
  async unpublishPost(postSlug: string): Promise<QuailResponse<QuailPost>> {
    try {
      console.log('取消发布 Quail 文章:', postSlug);
      const response = await this.kyInstance
        .put(`lists/${this.channelSlug}/posts/${postSlug}/unpublish`)
        .json<QuailResponse<QuailPost>>();
      console.log('成功取消发布 Quail 文章:', postSlug);
      return response;
    } catch (error) {
      throw this.handleError(error, '取消发布失败');
    }
  }

  /**
   * 发送/分发文章（发送邮件给订阅者）
   * PUT /lists/:channel_slug/posts/:post_slug/deliver
   */
  async deliverPost(postSlug: string): Promise<QuailResponse<QuailPost>> {
    try {
      console.log('发送 Quail 文章邮件:', postSlug);
      const response = await this.kyInstance
        .put(`lists/${this.channelSlug}/posts/${postSlug}/deliver`)
        .json<QuailResponse<QuailPost>>();
      console.log('成功发送 Quail 文章邮件:', postSlug);
      return response;
    } catch (error) {
      throw this.handleError(error, '发送邮件失败');
    }
  }

  /**
   * 获取文章内容
   * GET /lists/:channel_slug/posts/:post_slug/content
   */
  async getPostContent(postSlug: string): Promise<QuailResponse<{ free: string; paid?: string }>> {
    try {
      const response = await this.kyInstance
        .get(`lists/${this.channelSlug}/posts/${postSlug}/content`)
        .json<QuailResponse<{ free: string; paid?: string }>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取文章内容失败');
    }
  }

  // ============ Channel API ============

  /**
   * 获取频道信息
   * GET /lists/:channel_slug
   */
  async getChannel(channelSlug?: string): Promise<QuailResponse<QuailChannel>> {
    try {
      const slug = channelSlug || this.channelSlug;
      const response = await this.kyInstance
        .get(`lists/${slug}`)
        .json<QuailResponse<QuailChannel>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取频道信息失败');
    }
  }

  /**
   * 获取用户的频道列表
   * GET /users/:user_id/lists
   */
  async getUserChannels(userId: number): Promise<QuailPaginatedResponse<QuailChannel>> {
    try {
      const response = await this.kyInstance
        .get(`users/${userId}/lists`)
        .json<QuailPaginatedResponse<QuailChannel>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取用户频道列表失败');
    }
  }

  // ============ Subscription API ============

  /**
   * 获取成员订阅列表
   * GET /subscriptions/:list_id/members/:user_id/subs
   */
  async getMemberSubscriptions(userId: number): Promise<QuailPaginatedResponse<QuailSubscription>> {
    try {
      const response = await this.kyInstance
        .get(`subscriptions/${this.listId}/members/${userId}/subs`)
        .json<QuailPaginatedResponse<QuailSubscription>>();
      return response;
    } catch (error) {
      throw this.handleError(error, '获取成员订阅列表失败');
    }
  }

  /**
   * 删除成员
   * DELETE /subscriptions/:list_id/members/:user_id
   */
  async deleteMember(userId: number): Promise<void> {
    try {
      console.log('删除 Quail 订阅者:', userId);
      await this.kyInstance.delete(`subscriptions/${this.listId}/members/${userId}`);
      console.log('成功删除 Quail 订阅者:', userId);
    } catch (error) {
      throw this.handleError(error, '删除订阅者失败');
    }
  }

  /**
   * 更新成员邮件设置
   * PUT /subscriptions/:list_id/members/:user_id/email
   */
  async updateMemberEmail(userId: number, enabled: boolean): Promise<void> {
    try {
      console.log('更新 Quail 订阅者邮件设置:', userId, enabled);
      await this.kyInstance.put(`subscriptions/${this.listId}/members/${userId}/email`, {
        json: { enabled }
      });
      console.log('成功更新 Quail 订阅者邮件设置:', userId);
    } catch (error) {
      throw this.handleError(error, '更新邮件设置失败');
    }
  }

  /**
   * 转移成员
   * POST /subscriptions/:list_id/members/:user_id/transfer
   */
  async transferMember(userId: number, targetListId: string): Promise<void> {
    try {
      console.log('转移 Quail 订阅者:', userId, '到', targetListId);
      await this.kyInstance.post(`subscriptions/${this.listId}/members/${userId}/transfer`, {
        json: { target_list_id: targetListId }
      });
      console.log('成功转移 Quail 订阅者:', userId);
    } catch (error) {
      throw this.handleError(error, '转移订阅者失败');
    }
  }

  /**
   * 添加单个订阅者
   * 注意：这个 API 可能需要 Quaily+ 计划
   * POST /auxilia/subscriptions/:list_id/members/add
   */
  async addSubscriber(subscriber: AddSubscriberRequest): Promise<void> {
    try {
      console.log('添加 Quail 订阅者:', subscriber.email);
      await this.kyInstance.post(`auxilia/subscriptions/${this.listId}/members/add`, {
        json: [subscriber]
      });
      console.log('成功添加 Quail 订阅者:', subscriber.email);
    } catch (error) {
      throw this.handleError(error, '添加订阅者失败');
    }
  }

  // ============ 工具方法 ============

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!QUAIL_API_KEY) {
        console.warn('QUAIL_API_KEY 未配置');
        return false;
      }
      if (!this.channelSlug) {
        console.warn('QUAIL_CHANNEL_SLUG 未配置');
        return false;
      }
      await this.getChannel();
      return true;
    } catch (error) {
      console.error('Quail API 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 检查配置是否完整
   */
  isConfigured(): boolean {
    return !!(QUAIL_API_KEY && this.channelSlug);
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown, defaultMessage: string): QuailApiError {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      let message = `${defaultMessage} (${status})`;

      // 尝试解析错误响应
      error.response.json().then((body: any) => {
        if (body?.message) {
          message = body.message;
        } else if (body?.error) {
          message = body.error;
        }
      }).catch(() => {
        // 忽略解析错误
      });

      return new QuailApiError(message, status, error);
    }

    if (error instanceof Error) {
      return new QuailApiError(
        `${defaultMessage}: ${error.message}`,
        undefined,
        error
      );
    }

    return new QuailApiError(defaultMessage);
  }
}

// 导出单例实例（延迟初始化，避免环境变量未加载时报错）
let _quailApi: QuailApiClient | null = null;

export function getQuailApi(): QuailApiClient {
  if (!_quailApi) {
    _quailApi = new QuailApiClient();
  }
  return _quailApi;
}

// 导出便捷方法
export async function testQuailConnection(): Promise<boolean> {
  return getQuailApi().testConnection();
}

export function isQuailConfigured(): boolean {
  return !!(QUAIL_API_KEY && QUAIL_CHANNEL_SLUG);
}
