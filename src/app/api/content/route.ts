import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content';
import { ContentSchema, ContentQuerySchema } from '@/lib/validations/content';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/content - 获取内容列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = ContentQuerySchema.parse(queryParams);
    const result = await ContentService.getContentList(validatedQuery);
    
    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('获取内容列表失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('GET_CONTENT_LIST_ERROR', '获取内容列表失败', 500);
  }
}

// POST /api/content - 创建内容
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validatedData = ContentSchema.parse(body);
    
    const content = await ContentService.createContent(validatedData, authResult.user.id, request);
    
    return createNextSuccessResponse(content, 201);
  } catch (error) {
    console.error('创建内容失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('CREATE_CONTENT_ERROR', '创建内容失败', 500);
  }
}