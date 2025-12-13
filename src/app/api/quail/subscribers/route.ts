import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { getQuailApi, isQuailConfigured, AddSubscriberRequest } from '@/lib/services/quail-api';
import { z } from 'zod';

const AddSubscriberSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  name: z.string().optional(),
});

/**
 * POST /api/quail/subscribers
 * 添加单个订阅者
 */
export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);

    if (!isQuailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Quail API 未配置',
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = AddSubscriberSchema.parse(body);

    const quailApi = getQuailApi();
    await quailApi.addSubscriber({
      email: data.email,
      name: data.name,
    });

    return NextResponse.json({
      success: true,
      message: '订阅者添加成功',
    });
  } catch (error) {
    console.error('Add subscriber error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADD_SUBSCRIBER_ERROR',
          message: error instanceof Error ? error.message : '添加订阅者失败',
        },
      },
      { status: 500 }
    );
  }
}
