import { NextRequest, NextResponse } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { TagSchema, TagQuerySchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/tags - 获取标签列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = TagQuerySchema.parse(queryParams);
    const tags = await TagService.getTagList(validatedQuery);
    
    return createNextSuccessResponse(tags);
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return createNextErrorResponse('GET_TAGS_FAILED', '获取标签列表失败', 500);
  }
}

// POST /api/tags - 创建标签
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validatedData = TagSchema.parse(body);
    
    const tag = await TagService.createTag(validatedData);
    
    return createNextSuccessResponse(tag, 201);
  } catch (error) {
    console.error('创建标签失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('CREATE_TAG_ERROR', error.message, 400);
    }
    return createNextErrorResponse('CREATE_TAG_FAILED', '创建标签失败', 500);
  }
}
