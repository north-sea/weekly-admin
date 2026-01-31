import { NextRequest } from 'next/server';
import { TagGroupService } from '@/lib/services/tag-group';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/tag-groups/all - 获取所有标签组（用于下拉选择）
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const groups = await TagGroupService.getAllTagGroups();

    return createNextSuccessResponse(groups);
  } catch (error) {
    console.error('获取所有标签组失败:', error);
    return createNextErrorResponse('GET_ALL_TAG_GROUPS_FAILED', '获取所有标签组失败', 500);
  }
}
