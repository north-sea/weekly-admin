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

    // inbox 统计（统一收件箱）
    const [inboxAll, inboxPending, inboxPromoted] = await Promise.all([
      prisma.inbox_items.count({}),
      prisma.inbox_items.count({ where: { status: 'pending' } }),
      prisma.inbox_items.count({ where: { status: 'promoted' } }),
    ]);

    // 编辑草稿（内容库，status=draft）统计
    const editorAll = await prisma.contents.count({ where: { status: 'draft' } });

    // 获取所有来源域名（从 URL 中提取）
    const draftsWithUrls = await prisma.inbox_items.findMany({
      select: { url: true },
      where: { url: { not: '' } },
    });

    // 提取并统计域名
    const sourceCountMap = new Map<string, number>();
    for (const draft of draftsWithUrls) {
      try {
        const hostname = new URL(draft.url).hostname.replace(/^www\./, '');
        sourceCountMap.set(hostname, (sourceCountMap.get(hostname) || 0) + 1);
      } catch {
        // 忽略无效 URL
      }
    }

    // 转换为数组并按数量排序，取前 20 个
    const sources = Array.from(sourceCountMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return createNextSuccessResponse({
      inbox: {
        all: inboxAll,
        pending: inboxPending,
        adopted: inboxPromoted,
      },
      editor: {
        all: editorAll,
      },
      sources,
    });
  } catch (error) {
    console.error('获取草稿统计失败:', error);
    return createNextErrorResponse('GET_DRAFTS_STATS_ERROR', '获取草稿统计失败', 500);
  }
}

