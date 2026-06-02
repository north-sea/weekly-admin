/**
 * Karakeep API 客户端服务
 * 用于从 Karakeep Draft 列表获取书签数据
 * 
 * API 文档: 
 * - 获取列表书签: https://docs.karakeep.app/api/get-bookmarks-in-the-list
 * - 更新书签: https://docs.karakeep.app/api/update-a-bookmark
 * - 添加到列表: https://docs.karakeep.app/api/add-a-bookmark-to-a-list
 */

import ky, { HTTPError } from 'ky';

// 环境变量配置
const KARAKEEP_HOST = process.env.KARAKEEP_HOST || '';
const KARAKEEP_KEY = process.env.KARAKEEP_KEY || '';
const KARAKEEP_DRAFT_LIST_ID = process.env.KARAKEEP_DRAFT_LIST_ID || ''; // Draft 列表的 ID

let karakeepApiInstance: KarakeepApiClient | null = null;
let karakeepConfigWarned = false;

function getMissingKarakeepConfig(requireDraftListId = false): string[] {
  const missing: string[] = [];
  if (!KARAKEEP_HOST) missing.push('KARAKEEP_HOST');
  if (!KARAKEEP_KEY) missing.push('KARAKEEP_KEY');
  if (requireDraftListId && !KARAKEEP_DRAFT_LIST_ID) missing.push('KARAKEEP_DRAFT_LIST_ID');
  return missing;
}

function warnKarakeepConfigOnce(context?: string, requireDraftListId = false) {
  if (karakeepConfigWarned) return;
  const missing = getMissingKarakeepConfig(requireDraftListId);
  if (missing.length === 0) return;
  const suffix = context ? `，跳过 ${context}` : '，跳过相关操作';
  console.warn(`Karakeep 未配置${suffix}。缺少: ${missing.join(', ')}`);
  karakeepConfigWarned = true;
}

export function isKarakeepConfigured(options?: { requireDraftListId?: boolean }): boolean {
  return getMissingKarakeepConfig(options?.requireDraftListId ?? false).length === 0;
}

export function getKarakeepApi(context?: string): KarakeepApiClient | null {
  if (!isKarakeepConfigured()) {
    warnKarakeepConfigOnce(context);
    return null;
  }
  if (!karakeepApiInstance) {
    karakeepApiInstance = new KarakeepApiClient();
  }
  return karakeepApiInstance;
}

// Karakeep 书签数据类型（根据官方 API 文档）
export interface KarakeepBookmark {
  id: string;
  createdAt: string;
  modifiedAt?: string;
  title?: string;
  archived?: boolean;
  favourited?: boolean;
  taggingStatus?: string;
  summarizationStatus?: string;
  note?: string;
  summary?: string;
  tags?: Array<{
    id: string;
    name: string;
    attachedBy: 'ai' | 'human';
  }>;
  content: {
    type: 'link' | 'text' | 'image' | 'video';
    url?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    imageAssetId?: string;
    screenshotAssetId?: string;
    favicon?: string;
    htmlContent?: string;
    author?: string;
    publisher?: string;
    datePublished?: string;
    crawledAt?: string;
  };
  assets?: Array<{
    id: string;
    assetType: string;
  }>;
}

// API 响应类型
export interface KarakeepResponse {
  bookmarks: KarakeepBookmark[];
  [key: string]: any;
}

// 错误类型
export class KarakeepApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'KarakeepApiError';
  }
}

/**
 * Karakeep API 客户端类
 */
export class KarakeepApiClient {
  private kyInstance: typeof ky;

  constructor() {
    // 验证配置
    if (!KARAKEEP_HOST) {
      throw new Error('KARAKEEP_HOST 环境变量未配置');
    }
    if (!KARAKEEP_KEY) {
      throw new Error('KARAKEEP_KEY 环境变量未配置');
    }
    if (!KARAKEEP_DRAFT_LIST_ID) {
      console.warn('KARAKEEP_DRAFT_LIST_ID 环境变量未配置，默认草稿列表相关操作可能不可用');
    }

    // 创建 ky 实例
    this.kyInstance = ky.create({
      prefixUrl: KARAKEEP_HOST,
      timeout: 60000, // 60秒超时
      retry: {
        limit: 3,
        methods: ['get'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            // 添加认证头
            request.headers.set('Authorization', `Bearer ${KARAKEEP_KEY}`);
            request.headers.set('Content-Type', 'application/json');
          }
        ],
        afterResponse: [
          async (_request, _options, response) => {
            // 记录响应
            if (!response.ok) {
              console.error('Karakeep API 错误:', {
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

  /**
   * 获取 Draft 列表中的书签（支持分页）
   * GET /lists/:listId/bookmarks
   * 参考: https://docs.karakeep.app/api/get-bookmarks-in-the-list
   * @param options 查询选项
   */
  async getAllBookmarks(options?: {
    archived?: boolean;
    favourited?: boolean;
    limit?: number;
    includeContent?: boolean;
  }): Promise<KarakeepBookmark[]> {
    if (!KARAKEEP_DRAFT_LIST_ID) {
      throw new KarakeepApiError('KARAKEEP_DRAFT_LIST_ID 环境变量未配置');
    }
    try {
      console.log('正在从 Karakeep Draft 列表获取书签...', options);
      
      const allBookmarks: KarakeepBookmark[] = [];
      let cursor: string | null = null;
      let pageCount = 0;
      
      // 默认参数
      const {
        archived = false, // 默认不获取已归档的
        favourited, // 不限制
        limit = 100, // 每页最多 100 条
        includeContent = true,
      } = options || {};
      
      // 循环获取所有页
      do {
        pageCount++;
        console.log(`正在获取第 ${pageCount} 页...`);
        
        // 构建查询参数
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        if (archived !== undefined) params.append('archived', String(archived));
        if (favourited !== undefined) params.append('favourited', String(favourited));
        if (limit) params.append('limit', String(limit));
        if (includeContent !== undefined) params.append('includeContent', String(includeContent));
        
        // 使用列表 API 而不是全局书签 API
        const url: string = `lists/${KARAKEEP_DRAFT_LIST_ID}/bookmarks?${params.toString()}`;
        const response: any = await this.kyInstance.get(url).json<any>();
        
        // 处理不同的响应格式
        let bookmarks: KarakeepBookmark[] = [];
        let nextCursor: string | null = null;
        
        if (Array.isArray(response)) {
          // 直接是数组（无分页）
          bookmarks = response;
          nextCursor = null;
        } else if (response.bookmarks && Array.isArray(response.bookmarks)) {
          // { bookmarks: [...], nextCursor: "..." }
          bookmarks = response.bookmarks;
          nextCursor = response.nextCursor || null;
        } else if (response.data?.bookmarks && Array.isArray(response.data.bookmarks)) {
          // { data: { bookmarks: [...], nextCursor: "..." } }
          bookmarks = response.data.bookmarks;
          nextCursor = response.data.nextCursor || null;
        } else {
          console.warn('未知的 Karakeep API 响应格式:', response);
          throw new KarakeepApiError('无法解析 Karakeep API 响应');
        }

        console.log(`第 ${pageCount} 页获取了 ${bookmarks.length} 条书签`);
        allBookmarks.push(...bookmarks);
        
        // 更新 cursor
        cursor = nextCursor;
        
        // 安全检查：防止无限循环
        if (pageCount > 100) {
          console.warn('已获取超过 100 页，停止分页');
          break;
        }
        
      } while (cursor);

      console.log(`成功从 Draft 列表获取所有书签，共 ${allBookmarks.length} 条，分 ${pageCount} 页`);
      
      // 开发环境下打印第一条书签的结构（用于验证数据格式）
      if (process.env.NODE_ENV === 'development' && allBookmarks.length > 0) {
        console.log('第一条书签结构示例:', JSON.stringify(allBookmarks[0], null, 2));
      }
      
      return allBookmarks;
      
    } catch (error) {
      // 错误处理
      if (error instanceof HTTPError) {
        const status = error.response.status;
        let message = `Karakeep API 请求失败 (${status})`;
        
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // 无法解析错误响应
        }
        
        throw new KarakeepApiError(message, status, error);
      }
      
      if (error instanceof Error) {
        throw new KarakeepApiError(
          `Karakeep API 请求失败: ${error.message}`,
          undefined,
          error
        );
      }
      
      throw new KarakeepApiError('未知错误');
    }
  }

  /**
   * 获取所有书签（全局，不限列表）
   * GET /bookmarks
   * 参考: https://docs.karakeep.app/api/get-all-bookmarks
   * @param options 查询选项
   */
  async getBookmarks(options?: {
    archived?: boolean;
    favourited?: boolean;
    limit?: number;
    includeContent?: boolean;
  }): Promise<KarakeepBookmark[]> {
    try {
      console.log('正在获取 Karakeep 所有书签...', options);
      
      const allBookmarks: KarakeepBookmark[] = [];
      let cursor: string | null = null;
      let pageCount = 0;
      
      const {
        archived, // 不加默认，交给 API 处理
        favourited,
        limit = 100,
        includeContent = true,
      } = options || {};
      
      do {
        pageCount++;
        console.log(`正在获取第 ${pageCount} 页...`);
        
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        if (archived !== undefined) params.append('archived', String(archived));
        if (favourited !== undefined) params.append('favourited', String(favourited));
        if (limit) params.append('limit', String(limit));
        if (includeContent !== undefined) params.append('includeContent', String(includeContent));
        
        const url: string = `bookmarks?${params.toString()}`;
        const response: any = await this.kyInstance.get(url).json<any>();
        
        let bookmarks: KarakeepBookmark[] = [];
        let nextCursor: string | null = null;
        
        if (Array.isArray(response)) {
          bookmarks = response;
          nextCursor = null;
        } else if (response.bookmarks && Array.isArray(response.bookmarks)) {
          bookmarks = response.bookmarks;
          nextCursor = response.nextCursor || null;
        } else if (response.data?.bookmarks && Array.isArray(response.data.bookmarks)) {
          bookmarks = response.data.bookmarks;
          nextCursor = response.data.nextCursor || null;
        } else {
          console.warn('未知的 Karakeep API 响应格式:', response);
          throw new KarakeepApiError('无法解析 Karakeep API 响应');
        }

        console.log(`第 ${pageCount} 页获取了 ${bookmarks.length} 条书签`);
        allBookmarks.push(...bookmarks);
        
        cursor = nextCursor;
        
        if (pageCount > 100) {
          console.warn('已获取超过 100 页，停止分页');
          break;
        }
        
      } while (cursor);

      console.log(`成功获取所有书签，共 ${allBookmarks.length} 条，分 ${pageCount} 页`);
      return allBookmarks;
      
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        let message = `Karakeep API 请求失败 (${status})`;
        
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // 无法解析错误响应
        }
        
        throw new KarakeepApiError(message, status, error);
      }
      
      if (error instanceof Error) {
        throw new KarakeepApiError(
          `Karakeep API 请求失败: ${error.message}`,
          undefined,
          error
        );
      }
      
      throw new KarakeepApiError('未知错误');
    }
  }

  /**
   * 获取单个书签
   * GET /bookmarks/:bookmarkId
   */
  async getBookmark(bookmarkId: string): Promise<KarakeepBookmark> {
    try {
      const response = await this.kyInstance.get(`bookmarks/${bookmarkId}`).json<KarakeepBookmark>();
      return response;
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        throw new KarakeepApiError(`获取书签失败 (${status})`, status, error);
      }
      throw new KarakeepApiError('获取书签失败', undefined, error as Error);
    }
  }

  /**
   * 更新书签状态
   * PATCH /bookmarks/:bookmarkId
   * 参考: https://docs.karakeep.app/api/update-a-bookmark/
   */
  async updateBookmark(bookmarkId: string, data: {
    archived?: boolean;
    favourited?: boolean;
    note?: string;
    url?: string;
    title?: string;
  }): Promise<KarakeepBookmark> {
    try {
      console.log(`更新 Karakeep 书签 ${bookmarkId}:`, data);
      
      const response = await this.kyInstance.patch(`bookmarks/${bookmarkId}`, {
        json: data,
      }).json<KarakeepBookmark>();
      
      console.log(`成功更新书签 ${bookmarkId}`);
      return response;
      
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        let message = `更新 Karakeep 书签失败 (${status})`;
        
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // 无法解析错误响应
        }
        
        throw new KarakeepApiError(message, status, error);
      }
      
      throw new KarakeepApiError('更新书签失败', undefined, error as Error);
    }
  }

  /**
   * 归档书签（标记为已处理）
   */
  async archiveBookmark(bookmarkId: string): Promise<KarakeepBookmark> {
    return this.updateBookmark(bookmarkId, { archived: true });
  }

  /**
   * 将书签添加到列表
   * PUT /lists/:listId/bookmarks/:bookmarkId
   * 参考: https://docs.karakeep.app/api/add-a-bookmark-to-a-list
   */
  async addBookmarkToList(listId: string, bookmarkId: string): Promise<void> {
    try {
      console.log(`添加书签 ${bookmarkId} 到列表 ${listId}`);
      
      await this.kyInstance.put(`lists/${listId}/bookmarks/${bookmarkId}`);
      
      console.log(`成功添加书签到列表`);
      
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        if (status === 404) {
          throw new KarakeepApiError('列表或书签不存在', status, error);
        }
        
        let message = `添加书签到列表失败 (${status})`;
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // 无法解析错误响应
        }
        
        throw new KarakeepApiError(message, status, error);
      }
      
      throw new KarakeepApiError('添加书签到列表失败', undefined, error as Error);
    }
  }

  /**
   * 从列表移除书签
   * DELETE /lists/:listId/bookmarks/:bookmarkId
   */
  async removeBookmarkFromList(listId: string, bookmarkId: string): Promise<void> {
    try {
      console.log(`从列表 ${listId} 移除书签 ${bookmarkId}`);
      
      await this.kyInstance.delete(`lists/${listId}/bookmarks/${bookmarkId}`);
      
      console.log('成功从列表移除书签');
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        if (status === 404) {
          throw new KarakeepApiError('列表或书签不存在', status, error);
        }
        
        let message = `从列表移除书签失败 (${status})`;
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // ignore
        }
        
        throw new KarakeepApiError(message, status, error);
      }
      
      throw new KarakeepApiError('从列表移除书签失败', undefined, error as Error);
    }
  }

  /**
   * v1 API: 创建书签
   * POST /bookmarks
   */
  async createBookmark(data: { url: string; title?: string; description?: string; type?: string }): Promise<KarakeepBookmark> {
    try {
      const payload = { ...data, type: data.type || 'link' };
      console.log('创建 Karakeep 书签:', payload.url, 'type:', payload.type);
      const response = await this.kyInstance.post('bookmarks', {
        json: payload,
      }).json<KarakeepBookmark>();
      return response;
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        let message = `创建 Karakeep 书签失败 (${status})`;
        try {
          const errorBody = await error.response.json();
          if (typeof errorBody === 'string') {
            message = errorBody;
          } else if (errorBody?.message) {
            message = typeof errorBody.message === 'string' ? errorBody.message : JSON.stringify(errorBody.message);
          } else if (errorBody?.error) {
            message = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
          } else {
            message = JSON.stringify(errorBody);
          }
        } catch {
          try {
            message = await error.response.text();
          } catch {
            // ignore
          }
        }
        throw new KarakeepApiError(message, status, error);
      }
      throw new KarakeepApiError('创建书签失败', undefined, error as Error);
    }
  }

  /**
   * v1 API: 获取书签
   * GET /bookmarks/:bookmarkId
   */
  async getBookmarkV1(bookmarkId: string): Promise<KarakeepBookmark> {
    try {
      const response = await this.kyInstance.get(`bookmarks/${bookmarkId}`).json<KarakeepBookmark>();
      return response;
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        throw new KarakeepApiError(`获取书签失败 (${status})`, status, error);
      }
      throw new KarakeepApiError('获取书签失败', undefined, error as Error);
    }
  }

  /**
   * v1 API: 将书签添加到列表
   * PUT /lists/:listId/bookmarks/:bookmarkId
   */
  async addBookmarkToListV1(listId: string, bookmarkId: string): Promise<void> {
    try {
      console.log(`添加书签 ${bookmarkId} 到列表 ${listId} (v1)`);
      await this.kyInstance.put(`lists/${listId}/bookmarks/${bookmarkId}`);
      console.log('成功添加书签到列表 (v1)');
    } catch (error) {
      if (error instanceof HTTPError) {
        const status = error.response.status;
        let message = `添加书签到列表失败 (${status})`;
        try {
          const errorBody = await error.response.json();
          message = errorBody.message || errorBody.error || message;
        } catch {
          // ignore
        }
        throw new KarakeepApiError(message, status, error);
      }
      throw new KarakeepApiError('添加书签到列表失败', undefined, error as Error);
    }
  }

  /**
   * 测试连接
   * 验证 API 配置是否正确
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAllBookmarks({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Karakeep API 连接测试失败:', error);
      return false;
    }
  }
}

// 导出便捷方法
export async function fetchKarakeepBookmarks(options?: {
  archived?: boolean;
  favourited?: boolean;
  limit?: number;
  includeContent?: boolean;
}): Promise<KarakeepBookmark[]> {
  const api = getKarakeepApi('获取书签');
  if (!api) return [];
  return api.getAllBookmarks(options);
}

export async function fetchAllKarakeepBookmarks(options?: {
  archived?: boolean;
  favourited?: boolean;
  limit?: number;
  includeContent?: boolean;
}): Promise<KarakeepBookmark[]> {
  const api = getKarakeepApi('获取书签');
  if (!api) return [];
  return api.getBookmarks(options);
}

export async function updateKarakeepBookmark(bookmarkId: string, data: {
  archived?: boolean;
  favourited?: boolean;
  note?: string;
}): Promise<KarakeepBookmark | null> {
  const api = getKarakeepApi('更新书签');
  if (!api) return null;
  return api.updateBookmark(bookmarkId, data);
}

export async function archiveKarakeepBookmark(bookmarkId: string): Promise<void> {
  const api = getKarakeepApi('归档书签');
  if (!api) return;
  await api.archiveBookmark(bookmarkId);
}

export async function addBookmarkToKarakeepList(listId: string, bookmarkId: string): Promise<void> {
  const api = getKarakeepApi('添加书签到列表');
  if (!api) return;
  return api.addBookmarkToList(listId, bookmarkId);
}

export async function removeBookmarkFromKarakeepList(listId: string, bookmarkId: string): Promise<void> {
  const api = getKarakeepApi('从列表移除书签');
  if (!api) return;
  return api.removeBookmarkFromList(listId, bookmarkId);
}

export async function testKarakeepConnection(): Promise<boolean> {
  const api = getKarakeepApi('连接测试');
  if (!api) return false;
  return api.testConnection();
}

export async function createKarakeepBookmark(data: { url: string; title?: string; description?: string }): Promise<KarakeepBookmark | null> {
  const api = getKarakeepApi('创建书签');
  if (!api) return null;
  return api.createBookmark(data);
}

export async function getKarakeepBookmarkV1(bookmarkId: string): Promise<KarakeepBookmark | null> {
  const api = getKarakeepApi('获取书签');
  if (!api) return null;
  return api.getBookmarkV1(bookmarkId);
}

export async function addBookmarkToKarakeepListV1(listId: string, bookmarkId: string): Promise<void> {
  const api = getKarakeepApi('添加书签到列表');
  if (!api) return;
  return api.addBookmarkToListV1(listId, bookmarkId);
}
