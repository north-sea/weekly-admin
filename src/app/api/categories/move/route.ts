import { NextRequest } from 'next/server';
import { CategoryMoveSchema } from '@/lib/validations/category';
import { CategoryService } from '@/lib/services/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { DEFAULT_MAX_DEPTH } from '@/lib/utils/category-helpers';

// POST /api/categories/move - 移动分类
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const data = CategoryMoveSchema.parse(body);

    // 从请求中获取最大深度配置（可选）
    const maxDepth = body.max_depth ?? DEFAULT_MAX_DEPTH;

    const result = await CategoryService.moveCategory(
      data,
      maxDepth,
      authResult.user.id,
      request
    );

    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('移动分类失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('MOVE_CATEGORY_ERROR', '移动分类失败', 500);
  }
}
