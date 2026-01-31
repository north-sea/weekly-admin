import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth';
import { recommendCategory } from '@/lib/ai/server/category-recommender';

const RequestSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  summary: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
});

// POST /api/ai/recommend-category - 获取分类推荐
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const data = RequestSchema.parse(body);

    const result = await recommendCategory(
      data.title,
      data.summary,
      data.content
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('分类推荐失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '分类推荐失败' },
      { status: 500 }
    );
  }
}
