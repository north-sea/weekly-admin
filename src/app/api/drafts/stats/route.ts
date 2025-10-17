/**
 * 草稿统计 API 路由
 * GET /api/drafts/stats - 返回草稿池统计与编辑草稿统计
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    // drafts 池统计
    const [inboxAll, inboxPending, inboxAdopted] = await Promise.all([
      prisma.drafts.count({}),
      prisma.drafts.count({ where: { status: 'pending' } }),
      prisma.drafts.count({ where: { status: 'adopted' } }),
    ]);

    // 编辑草稿（内容库，status=draft）统计
    const editorAll = await prisma.contents.count({ where: { status: 'draft' } });

    return createNextSuccessResponse({
      inbox: {
        all: inboxAll,
        pending: inboxPending,
        adopted: inboxAdopted,
      },
      editor: {
        all: editorAll,
      },
    });
  } catch (error) {
    console.error('获取草稿统计失败:', error);
    return createNextErrorResponse('GET_DRAFTS_STATS_ERROR', '获取草稿统计失败', 500);
  }
}


