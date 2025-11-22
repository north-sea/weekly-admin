import { NextRequest } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

// GET /api/categories/all - 获取所有分类（扁平列表）
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const categories = await CategoryService.getAllCategories();
    return createNextSuccessResponse(categories);
  } catch (error) {
    console.error('获取全部分类失败:', error);
    return createNextErrorResponse('GET_ALL_CATEGORIES_ERROR', '获取全部分类失败', 500);
  }
}
