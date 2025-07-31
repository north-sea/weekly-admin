import { NextRequest, NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category';
import { CategoryUpdateSchema } from '@/lib/validations/category';
import { authenticateRequest } from '@/lib/auth';

// GET /api/categories/[id] - 获取单个分类
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的分类ID' }, { status: 400 });
    }

    const category = await CategoryService.getCategoryById(id);
    if (!category) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('获取分类失败:', error);
    return NextResponse.json(
      { error: '获取分类失败' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的分类ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = CategoryUpdateSchema.parse({ ...body, id });
    
    const category = await CategoryService.updateCategory(validatedData);
    
    return NextResponse.json(category);
  } catch (error) {
    console.error('更新分类失败:', error);
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
      { error: '更新分类失败' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的分类ID' }, { status: 400 });
    }

    await CategoryService.deleteCategory(id);
    
    return NextResponse.json({ message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '删除分类失败' },
      { status: 500 }
    );
  }
}