import { NextRequest } from 'next/server';
import { CategoryArchiveSchema } from '@/lib/validations/category';
import { CategoryService } from '@/lib/services/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// POST /api/categories/archive - 归档/取消归档分类
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const data = CategoryArchiveSchema.parse(body);

    const result = await CategoryService.archiveCategory(
      data,
      authResult.user.id,
      request
    );

    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('归档分类失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('ARCHIVE_CATEGORY_ERROR', '归档分类失败', 500);
  }
}
