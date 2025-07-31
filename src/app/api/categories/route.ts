import { NextRequest, NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { CategorySchema, CategoryQuerySchema } from '@/lib/validations/category';
import { authenticateRequest } from '@/lib/auth';

// GET /api/categories - 获取分类列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = CategoryQuerySchema.parse(queryParams);
    const categories = await CategoryService.getCategoryList(validatedQuery);
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/categories - 创建分类
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CategorySchema.parse(body);
    
    const category = await CategoryService.createCategory(validatedData);
    
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('创建分类失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: '数据验证失败', details: error.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '创建分类失败' },
      { status: 500 }
    );
  }
}