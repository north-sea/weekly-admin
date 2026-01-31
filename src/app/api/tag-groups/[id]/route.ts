import { NextRequest } from 'next/server';
import { TagGroupService } from '@/lib/services/tag-group';
import { TagGroupUpdateSchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tag-groups/[id] - 获取单个标签组
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签组ID', 400);
    }

    const group = await TagGroupService.getTagGroupById(groupId);

    if (!group) {
      return createNextErrorResponse('NOT_FOUND', '标签组不存在', 404);
    }

    return createNextSuccessResponse(group);
  } catch (error) {
    console.error('获取标签组失败:', error);
    return createNextErrorResponse('GET_TAG_GROUP_FAILED', '获取标签组失败', 500);
  }
}

// PUT /api/tag-groups/[id] - 更新标签组
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    // 检查权限
    if (authResult.user.role !== 'ADMIN') {
      return createNextErrorResponse('FORBIDDEN', '没有权限执行此操作', 403);
    }

    const { id } = await params;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签组ID', 400);
    }

    const body = await request.json();
    const validatedData = TagGroupUpdateSchema.parse({ ...body, id: groupId });

    const group = await TagGroupService.updateTagGroup(validatedData);

    return createNextSuccessResponse(group);
  } catch (error) {
    console.error('更新标签组失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('UPDATE_TAG_GROUP_ERROR', error.message, 400);
    }
    return createNextErrorResponse('UPDATE_TAG_GROUP_FAILED', '更新标签组失败', 500);
  }
}

// DELETE /api/tag-groups/[id] - 删除标签组
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    // 检查权限
    if (authResult.user.role !== 'ADMIN') {
      return createNextErrorResponse('FORBIDDEN', '没有权限执行此操作', 403);
    }

    const { id } = await params;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签组ID', 400);
    }

    await TagGroupService.deleteTagGroup(groupId);

    return createNextSuccessResponse({ message: '标签组已删除' });
  } catch (error) {
    console.error('删除标签组失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('DELETE_TAG_GROUP_ERROR', error.message, 400);
    }
    return createNextErrorResponse('DELETE_TAG_GROUP_FAILED', '删除标签组失败', 500);
  }
}
