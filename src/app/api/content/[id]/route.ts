import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content';
import { ContentUpdateSchema } from '@/lib/validations/content';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/content/[id] - 获取单个内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return createNextErrorResponse('INVALID_ID', '无效的内容ID', 400);
    }

    const content = await ContentService.getContentById(id);
    if (!content) {
      return createNextErrorResponse('NOT_FOUND', '内容不存在', 404);
    }

    return createNextSuccessResponse(content);
  } catch (error) {
    console.error('获取内容失败:', error);
    return createNextErrorResponse('GET_CONTENT_ERROR', '获取内容失败', 500);
  }
}

// PUT /api/content/[id] - 更新内容
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return createNextErrorResponse('INVALID_ID', '无效的内容ID', 400);
    }

    const body = await request.json();
    const validatedData = ContentUpdateSchema.parse({ ...body, id });
    
    const content = await ContentService.updateContent(validatedData, authResult.user.id, request);
    
    return createNextSuccessResponse(content);
  } catch (error) {
    console.error('更新内容失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('UPDATE_CONTENT_ERROR', '更新内容失败', 500);
  }
}

// DELETE /api/content/[id] - 删除内容
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return createNextErrorResponse('INVALID_ID', '无效的内容ID', 400);
    }

    await ContentService.deleteContent(id, authResult.user.id, request);
    
    return createNextSuccessResponse({ message: '内容删除成功' });
  } catch (error) {
    console.error('删除内容失败:', error);
    return createNextErrorResponse('DELETE_CONTENT_ERROR', '删除内容失败', 500);
  }
}