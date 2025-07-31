/**
 * 数据序列化工具 - 处理 BigInt、Date 和其他特殊类型的序列化
 */

import dayjs from 'dayjs';

/**
 * 递归转换对象中的特殊类型为可序列化的格式
 * 处理 BigInt、Date、Buffer、RegExp、Error、Map、Set、URL 等类型
 */
export function serializeSpecialTypes<T>(obj: T): T {
  // 处理 null 和 undefined
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // 处理 BigInt
  if (typeof obj === 'bigint') {
    return String(obj) as T;
  }
  
  // 处理 Date - 使用 dayjs 格式化
  if (obj instanceof Date) {
    return dayjs(obj).format('YYYY-MM-DD HH:mm:ss') as T;
  }
  
  // 处理 Buffer/Uint8Array - 转换为 base64
  if (obj instanceof Buffer || obj instanceof Uint8Array) {
    return Buffer.from(obj).toString('base64') as T;
  }
  
  // 处理 RegExp - 转换为字符串表示
  if (obj instanceof RegExp) {
    return obj.toString() as T;
  }
  
  // 处理 Error - 提取关键信息
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack
    } as T;
  }
  
  // 处理 URL - 转换为字符串
  if (obj instanceof URL) {
    return obj.toString() as T;
  }
  
  // 处理 Map - 转换为对象
  if (obj instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of obj.entries()) {
      result[String(key)] = serializeSpecialTypes(value);
    }
    return result as T;
  }
  
  // 处理 Set - 转换为数组
  if (obj instanceof Set) {
    return Array.from(obj).map(item => serializeSpecialTypes(item)) as T;
  }
  
  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => serializeSpecialTypes(item)) as T;
  }
  
  // 处理函数 - 转换为字符串描述
  if (typeof obj === 'function') {
    return `[Function: ${obj.name || 'anonymous'}]` as T;
  }
  
  // 处理普通对象
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeSpecialTypes(value);
    }
    return result as T;
  }
  
  // 原始类型直接返回
  return obj;
}

/**
 * 保持向后兼容的函数别名
 * @deprecated 使用 serializeSpecialTypes 替代
 */
export const serializeBigInt = serializeSpecialTypes;

/**
 * 为 API 响应准备数据，处理所有序列化问题
 */
export function prepareApiResponse<T>(data: T): T {
  return serializeSpecialTypes(data);
}

/**
 * 自定义 JSON.stringify 的 replacer 函数，处理特殊类型
 */
export function jsonReplacer(key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  }
  if (value instanceof Buffer || value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (value instanceof URL) {
    return value.toString();
  }
  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      result[String(k)] = v;
    }
    return result;
  }
  if (value instanceof Set) {
    return Array.from(value);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  return value;
}

/**
 * 安全的 JSON.stringify，自动处理特殊类型
 */
export function safeJsonStringify(obj: unknown, space?: string | number): string {
  return JSON.stringify(obj, jsonReplacer, space);
}

/**
 * 用于 Next.js API 路由的响应包装器
 */
export function createApiResponse<T>(data: T, status = 200): Response {
  const serializedData = prepareApiResponse(data);
  return Response.json(serializedData, { status });
}

/**
 * 检查对象是否包含特殊类型值
 */
export function containsSpecialTypes(obj: unknown): boolean {
  if (typeof obj === 'bigint') {
    return true;
  }
  
  if (obj instanceof Date || obj instanceof Buffer || obj instanceof Uint8Array ||
      obj instanceof RegExp || obj instanceof Error || obj instanceof URL ||
      obj instanceof Map || obj instanceof Set) {
    return true;
  }
  
  if (Array.isArray(obj)) {
    return obj.some(item => containsSpecialTypes(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj).some(value => containsSpecialTypes(value));
  }
  
  return false;
}

/**
 * 保持向后兼容的函数别名
 * @deprecated 使用 containsSpecialTypes 替代
 */
export const containsBigInt = containsSpecialTypes;