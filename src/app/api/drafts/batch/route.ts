/**
 * 草稿批量操作 API 路由
 * POST /api/drafts/batch - 批量更新草稿状态
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

/**
 * POST /api/drafts/batch
 * 批量更新草稿状态
 */
export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    const body = await request.json();
    const { ids, action, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return createNextErrorResponse('INVALID_PARAMS', 'ids 参数必须是非空数组', 400);
    }

    let count = 0;

    switch (action) {
      case 'updateStatus':
        if (!status || !['pending', 'adopted', 'rejected'].includes(status)) {
          return createNextErrorResponse('INVALID_PARAMS', 'status 参数无效', 400);
        }
        const mappedStatus = status === 'adopted' ? 'promoted' : status;
        const result = await prisma.inbox_items.updateMany({
          where: { id: { in: ids.map((id: string) => BigInt(id)) } },
          data: { status: mappedStatus },
        });
        count = result.count;
        break;

      default:
        return createNextErrorResponse('INVALID_PARAMS', '不支持的操作类型', 400);
    }

    return createNextSuccessResponse({ count }, 200, { message: `成功更新 ${count} 条记录` });
  } catch (error) {
    console.error('批量操作失败:', error);
    return createNextErrorResponse('BATCH_UPDATE_ERROR', '批量操作失败', 500);
  }
}
