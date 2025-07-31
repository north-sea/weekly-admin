import { NextRequest, NextResponse } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { TagUpdateSchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';

// GET /api/tags/[id] - 获取单个标签
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
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    const tag = await TagService.getTagById(id);
    if (!tag) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('获取标签失败:', error);
    return NextResponse.json(
      { error: '获取标签失败' },
      { status: 500 }
    );
  }
}

// PUT /api/tags/[id] - 更新标签
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
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = TagUpdateSchema.parse({ ...body, id });
    
    const tag = await TagService.updateTag(validatedData);
    
    return NextResponse.json(tag);
  } catch (error) {
    console.error('更新标签失败:', error);
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
      { error: '更新标签失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/tags/[id] - 删除标签
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
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    await TagService.deleteTag(id);
    
    return NextResponse.json({ message: '标签删除成功' });
  } catch (error) {
    console.error('删除标签失败:', error);
    return NextResponse.json(
      { error: '删除标签失败' },
      { status: 500 }
    );
  }
}