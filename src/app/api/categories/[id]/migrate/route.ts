import { NextRequest } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/categories/[id]/migrate - 获取迁移预览信息
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的分类 ID', 400);
    }

    const preview = await CategoryService.getMigrationPreview(categoryId);
    const availableTargets = await CategoryService.getAvailableMigrationTargets(categoryId);

    return createNextSuccessResponse({
      ...preview,
      availableTargets,
    });
  } catch (error) {
    console.error('获取迁移预览失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('GET_MIGRATION_PREVIEW_ERROR', '获取迁移预览失败', 500);
  }
}
