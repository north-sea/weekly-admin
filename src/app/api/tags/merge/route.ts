import { NextRequest, NextResponse } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { TagMergeSchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';

// POST /api/tags/merge - 合并标签
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = TagMergeSchema.parse(body);
    
    await TagService.mergeTags(validatedData);
    
    return NextResponse.json({ message: '标签合并成功' });
  } catch (error) {
    console.error('合并标签失败:', error);
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
      { error: '合并标签失败' },
      { status: 500 }
    );
  }
}