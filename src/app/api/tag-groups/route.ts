import { NextRequest } from 'next/server';
import { TagGroupService } from '@/lib/services/tag-group';
import { TagGroupSchema, TagGroupQuerySchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/tag-groups - 获取标签组列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validatedQuery = TagGroupQuerySchema.parse(queryParams);
    const groups = await TagGroupService.getTagGroupList(validatedQuery);

    return createNextSuccessResponse(groups);
  } catch (error) {
    console.error('获取标签组列表失败:', error);
    return createNextErrorResponse('GET_TAG_GROUPS_FAILED', '获取标签组列表失败', 500);
  }
}

// POST /api/tag-groups - 创建标签组
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    // 检查权限（只有 ADMIN 可以创建标签组）
    if (authResult.user.role !== 'ADMIN') {
      return createNextErrorResponse('FORBIDDEN', '没有权限执行此操作', 403);
    }

    const body = await request.json();
    const validatedData = TagGroupSchema.parse(body);

    const group = await TagGroupService.createTagGroup(validatedData);

    return createNextSuccessResponse(group, 201);
  } catch (error) {
    console.error('创建标签组失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('CREATE_TAG_GROUP_ERROR', error.message, 400);
    }
    return createNextErrorResponse('CREATE_TAG_GROUP_FAILED', '创建标签组失败', 500);
  }
}
