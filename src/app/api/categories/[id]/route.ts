import { NextRequest, NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { CategoryUpdateSchema } from '@/lib/validations/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/categories/[id] - 获取单个分类
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
      return createNextErrorResponse('INVALID_ID', '无效的分类ID', 400);
    }

    const category = await CategoryService.getCategoryById(id);
    if (!category) {
      return createNextErrorResponse('NOT_FOUND', '分类不存在', 404);
    }

    return createNextSuccessResponse(category);
  } catch (error) {
    console.error('获取分类失败:', error);
    return createNextErrorResponse('GET_CATEGORY_ERROR', '获取分类失败', 500);
  }
}

// PUT /api/categories/[id] - 更新分类
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
      return NextResponse.json({ error: '无效的分类ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = CategoryUpdateSchema.parse({ ...body, id });
    
    const category = await CategoryService.updateCategory(validatedData);
    
    return createNextSuccessResponse(category);
  } catch (error) {
    console.error('更新分类失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('UPDATE_CATEGORY_ERROR', error instanceof Error ? error.message : '更新分类失败', 400);
  }
}

// DELETE /api/categories/[id] - 删除分类
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
      return NextResponse.json({ error: '无效的分类ID' }, { status: 400 });
    }

    await CategoryService.deleteCategory(id);
    
    return createNextSuccessResponse({ message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    return createNextErrorResponse('DELETE_CATEGORY_ERROR', error instanceof Error ? error.message : '删除分类失败', 400);
  }
}
