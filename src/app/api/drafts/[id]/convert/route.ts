/**
 * 草稿转换 API 路由
 * POST /api/drafts/:id/convert - 将草稿转换为正式内容
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { InboxService } from '@/lib/services/inbox';
import {
  addBookmarkToKarakeepList,
  archiveKarakeepBookmark,
  removeBookmarkFromKarakeepList,
} from '@/lib/services/karakeep-api';

const KARAKEEP_WEEKLY_LIST_ID = process.env.KARAKEEP_WEEKLY_LIST_ID || 'tsoo93d9t052gp46p6rpalgk';
const KARAKEEP_DRAFT_LIST_ID = process.env.KARAKEEP_DRAFT_LIST_ID || '';

/**
 * POST /api/drafts/:id/convert
 * 将草稿转换为正式内容
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    const { id } = await params;
    const body = await request.json();
    
    // 从请求体获取额外信息
    const {
      content_type_id = 3, // 默认 Weekly 类型
      category_id,
      tags = [],
      content_format = 'markdown',
    } = body;

    const inboxItem = await prisma.inbox_items.findUnique({
      where: { id: BigInt(id) },
      include: { data_source: true },
    });

    if (!inboxItem) {
      return createNextErrorResponse('NOT_FOUND', '草稿不存在', 404);
    }

    if (inboxItem.content_id) {
      return createNextErrorResponse('ALREADY_CONVERTED', '该草稿已经转换为内容', 400);
    }

    const content = await InboxService.promoteInboxItem(BigInt(id), {
      content_type_id,
      category_id: category_id ?? null,
      tag_ids: tags,
      content_format,
    });

    // 【双向同步】在 Karakeep 中归档并移动列表
    if (inboxItem.data_source?.type === 'karakeep' && inboxItem.source_item_id) {
      const karakeepId = inboxItem.source_item_id;

      if (KARAKEEP_WEEKLY_LIST_ID) {
        try {
          await addBookmarkToKarakeepList(KARAKEEP_WEEKLY_LIST_ID, karakeepId);
          console.log(`已将书签添加到 Karakeep 周刊列表: ${KARAKEEP_WEEKLY_LIST_ID}`);
        } catch (error) {
          console.error('添加到 Karakeep 周刊列表失败:', error);
        }
      } else {
        console.warn('KARAKEEP_WEEKLY_LIST_ID 未配置，跳过移动到周刊列表');
      }

      if (KARAKEEP_DRAFT_LIST_ID) {
        try {
          await removeBookmarkFromKarakeepList(KARAKEEP_DRAFT_LIST_ID, karakeepId);
          console.log(`已从 Karakeep Draft 列表移除书签: ${KARAKEEP_DRAFT_LIST_ID}`);
        } catch (error) {
          console.error('从 Karakeep Draft 列表移除失败:', error);
        }
      } else {
        console.warn('KARAKEEP_DRAFT_LIST_ID 未配置，跳过从 Draft 列表移除');
      }

      try {
        await archiveKarakeepBookmark(karakeepId);
        console.log(`已在 Karakeep 中归档书签: ${karakeepId}`);
      } catch (error) {
        // 归档失败不影响转换流程，只记录日志
        console.error('归档 Karakeep 书签失败:', error);
      }
    }

    return createNextSuccessResponse(content, 200, { message: '成功转换为内容，已在 Karakeep 中归档' });
  } catch (error) {
    console.error('转换草稿失败:', error);
    return createNextErrorResponse('CONVERT_DRAFT_ERROR', '转换草稿失败', 500);
  }
}
