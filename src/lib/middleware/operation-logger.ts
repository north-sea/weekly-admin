import { NextRequest } from 'next/server';
import { OperationLogService, OperationType } from '@/lib/services/operation-log';

export interface LoggingContext {
  userId: number;
  operationType: OperationType;
  resourceType: string;
  resourceId?: number;
  operationDetails?: Record<string, any>;
}

export class OperationLogger {
  // 记录操作日志的中间件函数
  static async logOperation(
    context: LoggingContext,
    request?: NextRequest
  ): Promise<void> {
    const {
      userId,
      operationType,
      resourceType,
      resourceId,
      operationDetails
    } = context;
    
    await OperationLogService.logOperation(
      userId,
      operationType,
      resourceType,
      resourceId,
      operationDetails,
      request
    );
  }
  
  // 内容相关操作日志记录器
  static async logContentOperation(
    userId: number,
    operationType: OperationType,
    contentId: number,
    details: {
      title?: string;
      contentType?: string;
      status?: string;
      changes?: Record<string, any>;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType: 'content',
      resourceId: contentId,
      operationDetails: {
        title: details.title,
        contentType: details.contentType,
        status: details.status,
        changes: details.changes,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 周刊相关操作日志记录器
  static async logWeeklyOperation(
    userId: number,
    operationType: OperationType,
    weeklyId: number,
    details: {
      issueNumber?: number;
      title?: string;
      status?: string;
      contentCount?: number;
      changes?: Record<string, any>;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType: 'weekly_issue',
      resourceId: weeklyId,
      operationDetails: {
        issueNumber: details.issueNumber,
        title: details.title,
        status: details.status,
        contentCount: details.contentCount,
        changes: details.changes,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 用户认证相关操作日志记录器
  static async logAuthOperation(
    userId: number,
    operationType: 'LOGIN' | 'LOGOUT',
    details: {
      success?: boolean;
      reason?: string;
      sessionDuration?: number;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType: 'user_session',
      operationDetails: {
        success: details.success,
        reason: details.reason,
        sessionDuration: details.sessionDuration,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 分类和标签相关操作日志记录器
  static async logTaxonomyOperation(
    userId: number,
    operationType: OperationType,
    resourceType: 'category' | 'tag',
    resourceId: number,
    details: {
      name?: string;
      action?: string;
      affectedContentCount?: number;
      changes?: Record<string, any>;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType,
      resourceId,
      operationDetails: {
        name: details.name,
        action: details.action,
        affectedContentCount: details.affectedContentCount,
        changes: details.changes,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 批量操作日志记录器
  static async logBatchOperation(
    userId: number,
    operationType: OperationType,
    resourceType: string,
    details: {
      operation: string;
      resourceIds: number[];
      affectedCount: number;
      criteria?: Record<string, any>;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType: `${resourceType}_batch`,
      operationDetails: {
        operation: details.operation,
        resourceIds: details.resourceIds,
        affectedCount: details.affectedCount,
        criteria: details.criteria,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 系统管理相关操作日志记录器
  static async logSystemOperation(
    userId: number,
    operationType: OperationType,
    details: {
      action: string;
      target?: string;
      parameters?: Record<string, any>;
      result?: Record<string, any>;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType,
      resourceType: 'system',
      operationDetails: {
        action: details.action,
        target: details.target,
        parameters: details.parameters,
        result: details.result,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
  
  // 搜索操作日志记录器
  static async logSearchOperation(
    userId: number,
    details: {
      query: string;
      filters?: Record<string, any>;
      resultCount: number;
      responseTime: number;
    },
    request?: NextRequest
  ): Promise<void> {
    await this.logOperation({
      userId,
      operationType: 'CREATE', // 搜索视为创建搜索记录
      resourceType: 'search',
      operationDetails: {
        query: details.query,
        filters: details.filters,
        resultCount: details.resultCount,
        responseTime: details.responseTime,
        timestamp: new Date().toISOString()
      }
    }, request);
  }
}