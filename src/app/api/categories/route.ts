import { NextRequest, NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { CategorySchema, CategoryQuerySchema } from '@/lib/validations/category';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// GET /api/categories - 获取分类列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = CategoryQuerySchema.parse(queryParams);
    const categories = await CategoryService.getCategoryList(validatedQuery);
    
    return createNextSuccessResponse(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    return createNextErrorResponse('GET_CATEGORIES_ERROR', '获取分类列表失败', 500);
  }
}

// POST /api/categories - 创建分类
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validatedData = CategorySchema.parse(body);
    
    const category = await CategoryService.createCategory(validatedData, authResult.user.id, request);
    
    return createNextSuccessResponse(category, 201);
  } catch (error) {
    console.error('创建分类失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('CREATE_CATEGORY_ERROR', '创建分类失败', 500);
  }
}
