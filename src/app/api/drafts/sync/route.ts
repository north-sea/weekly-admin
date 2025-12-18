/**
 * 草稿同步 API 路由
 * POST /api/drafts/sync - 从 Karakeep 同步书签
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFromKarakeep } from '@/lib/services/draft';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

/**
 * POST /api/drafts/sync
 * 从 Karakeep 同步书签到草稿库
 */
export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    console.log('开始同步 Karakeep 书签...');
    
    const stats = await syncFromKarakeep();

    const messageParts = [`新增 ${stats.created} 条`, `更新 ${stats.updated} 条`];
    if (stats.deleted > 0) {
      messageParts.push(`删除 ${stats.deleted} 条`);
    }
    if (stats.duplicatesDetected > 0) {
      messageParts.push(`检测到 ${stats.duplicatesDetected} 条重复`);
    }

    return createNextSuccessResponse(stats, 200, {
      message: `同步完成：${messageParts.join('，')}`
    });
  } catch (error) {
    console.error('同步失败:', error);
    return createNextErrorResponse('SYNC_ERROR', '同步失败，请检查 Karakeep 配置', 500);
  }
}

