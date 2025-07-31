import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';

export interface OperationLog {
  id: number;
  user_id: number;
  operation_type: OperationType;
  resource_type: string;
  resource_id?: number;
  operation_details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: Date;
  user?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

export interface OperationLogQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  operationType?: OperationType;
  resourceType?: string;
  resourceId?: number;
  startDate?: Date;
  endDate?: Date;
  keyword?: string;
}

export interface OperationLogResponse {
  data: OperationLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface OperationStats {
  totalOperations: number;
  operationsByType: Record<OperationType, number>;
  operationsByUser: Array<{
    userId: number;
    username: string;
    count: number;
  }>;
  operationsByResource: Array<{
    resourceType: string;
    count: number;
  }>;
  recentOperations: OperationLog[];
}

export class OperationLogService {
  // 记录操作日志
  static async logOperation(
    userId: number,
    operationType: OperationType,
    resourceType: string,
    resourceId?: number,
    operationDetails?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    try {
      const ipAddress = this.getClientIP(request);
      const userAgent = request?.headers.get('user-agent') || undefined;
      
      await prisma.operation_logs.create({
        data: {
          user_id: userId,
          operation_type: operationType,
          resource_type: resourceType,
          resource_id: resourceId,
          operation_details: operationDetails ? JSON.stringify(operationDetails) : undefined,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      });
    } catch (error) {
      console.error('Failed to log operation:', error);
      // 不抛出错误，避免影响主要业务逻辑
    }
  }
  
  // 获取操作日志列表
  static async getOperationLogs(query: OperationLogQuery): Promise<OperationLogResponse> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      operationType,
      resourceType,
      resourceId,
      startDate,
      endDate,
      keyword
    } = query;
    
    // 构建查询条件
    const where: Record<string, any> = {};
    
    if (userId) {
      where.user_id = userId;
    }
    
    if (operationType) {
      where.operation_type = operationType;
    }
    
    if (resourceType) {
      where.resource_type = resourceType;
    }
    
    if (resourceId) {
      where.resource_id = resourceId;
    }
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = startDate;
      }
      if (endDate) {
        where.created_at.lte = endDate;
      }
    }
    
    if (keyword) {
      where.OR = [
        { operation_details: { contains: keyword } },
        { resource_type: { contains: keyword } }
      ];
    }
    
    // 计算分页
    const skip = (page - 1) * pageSize;
    
    // 执行查询
    const [logs, total] = await Promise.all([
      prisma.operation_logs.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' }
      }),
      prisma.operation_logs.count({ where })
    ]);
    
    // 丰富数据，添加用户信息
    const data = await Promise.all(
      logs.map(async (log) => this.enrichLogWithUser(log))
    );
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
  
  // 获取操作统计信息
  static async getOperationStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<OperationStats> {
    const where: Record<string, any> = {};
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = startDate;
      }
      if (endDate) {
        where.created_at.lte = endDate;
      }
    }
    
    // 总操作数
    const totalOperations = await prisma.operation_logs.count({ where });
    
    // 按操作类型统计
    const operationTypeStats = await prisma.operation_logs.groupBy({
      by: ['operation_type'],
      where,
      _count: { operation_type: true }
    });
    
    const operationsByType: Record<OperationType, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      LOGIN: 0,
      LOGOUT: 0
    };
    
    operationTypeStats.forEach(stat => {
      operationsByType[stat.operation_type] = stat._count.operation_type;
    });
    
    // 按用户统计
    const userStats = await prisma.operation_logs.groupBy({
      by: ['user_id'],
      where,
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } },
      take: 10
    });
    
    const operationsByUser = await Promise.all(
      userStats.map(async (stat) => {
        const user = await prisma.users.findUnique({
          where: { id: stat.user_id },
          select: { id: true, username: true }
        });
        
        return {
          userId: stat.user_id,
          username: user?.username || 'Unknown',
          count: stat._count.user_id
        };
      })
    );
    
    // 按资源类型统计
    const resourceStats = await prisma.operation_logs.groupBy({
      by: ['resource_type'],
      where,
      _count: { resource_type: true },
      orderBy: { _count: { resource_type: 'desc' } }
    });
    
    const operationsByResource = resourceStats.map(stat => ({
      resourceType: stat.resource_type,
      count: stat._count.resource_type
    }));
    
    // 最近操作
    const recentLogs = await prisma.operation_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10
    });
    
    const recentOperations = await Promise.all(
      recentLogs.map(log => this.enrichLogWithUser(log))
    );
    
    return {
      totalOperations,
      operationsByType,
      operationsByUser,
      operationsByResource,
      recentOperations
    };
  }
  
  // 检测异常操作
  static async detectAnomalousOperations(
    timeWindowMinutes: number = 60,
    threshold: number = 50
  ): Promise<Array<{
    userId: number;
    username: string;
    operationCount: number;
    timeWindow: string;
  }>> {
    const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const suspiciousUsers = await prisma.operation_logs.groupBy({
      by: ['user_id'],
      where: {
        created_at: { gte: startTime }
      },
      _count: { user_id: true },
      having: {
        user_id: { _count: { gte: threshold } }
      }
    });
    
    const results = await Promise.all(
      suspiciousUsers.map(async (stat) => {
        const user = await prisma.users.findUnique({
          where: { id: stat.user_id },
          select: { id: true, username: true }
        });
        
        return {
          userId: stat.user_id,
          username: user?.username || 'Unknown',
          operationCount: stat._count.user_id,
          timeWindow: `${timeWindowMinutes} minutes`
        };
      })
    );
    
    return results;
  }
  
  // 清理旧日志
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await prisma.operation_logs.deleteMany({
      where: {
        created_at: { lt: cutoffDate }
      }
    });
    
    return result.count;
  }
  
  // 导出操作日志
  static async exportOperationLogs(
    query: OperationLogQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    // 获取所有匹配的日志（不分页）
    const allLogsQuery = { ...query, page: 1, pageSize: 10000 };
    const result = await this.getOperationLogs(allLogsQuery);
    
    if (format === 'csv') {
      return this.convertToCSV(result.data);
    }
    
    return JSON.stringify(result.data, null, 2);
  }
  
  // 获取客户端IP地址
  private static getClientIP(request?: NextRequest): string | undefined {
    if (!request) return undefined;
    
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return realIP || remoteAddr || undefined;
  }
  
  // 丰富日志数据，添加用户信息
  private static async enrichLogWithUser(log: {
    id: number;
    user_id: number;
    operation_type: OperationType;
    resource_type: string;
    resource_id?: number | null;
    operation_details?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    created_at?: Date | null;
  }): Promise<OperationLog> {
    const user = await prisma.users.findUnique({
      where: { id: log.user_id },
      select: { id: true, username: true, display_name: true }
    });
    
    return {
      id: log.id,
      user_id: log.user_id,
      operation_type: log.operation_type,
      resource_type: log.resource_type,
      resource_id: log.resource_id || undefined,
      operation_details: log.operation_details || undefined,
      ip_address: log.ip_address || undefined,
      user_agent: log.user_agent || undefined,
      created_at: log.created_at || undefined,
      user: user || undefined
    };
  }
  
  // 转换为CSV格式
  private static convertToCSV(logs: OperationLog[]): string {
    const headers = [
      'ID',
      'User ID',
      'Username',
      'Operation Type',
      'Resource Type',
      'Resource ID',
      'Operation Details',
      'IP Address',
      'User Agent',
      'Created At'
    ];
    
    const rows = logs.map(log => [
      log.id,
      log.user_id,
      log.user?.username || '',
      log.operation_type,
      log.resource_type,
      log.resource_id || '',
      log.operation_details || '',
      log.ip_address || '',
      log.user_agent || '',
      log.created_at?.toISOString() || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }
}