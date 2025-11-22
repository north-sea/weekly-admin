import { NextRequest } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { authenticateRequest } from '@/lib/auth';
import { CategoryMergeSchema } from '@/lib/validations/category';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

// POST /api/categories/merge - 合并分类
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = CategoryMergeSchema.parse(body);

    await CategoryService.mergeCategories(validated);

    return createNextSuccessResponse({ message: '分类合并成功' });
  } catch (error) {
    console.error('合并分类失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('MERGE_CATEGORIES_ERROR', error instanceof Error ? error.message : '合并分类失败', 400);
  }
}
