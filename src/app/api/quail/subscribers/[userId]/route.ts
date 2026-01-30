import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { getQuailApi, isQuailConfigured } from '@/lib/services/quail-api';
import { z } from 'zod';

const UpdateEmailSchema = z.object({
  enabled: z.boolean(),
});

/**
 * GET /api/quail/subscribers/:userId
 * 获取订阅者的订阅信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.userId);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的用户 ID',
          },
        },
        { status: 400 }
      );
    }

    const quailApi = getQuailApi();
    const response = await quailApi.getMemberSubscriptions(userId);

    return NextResponse.json({
      success: true,
      data: response.items,
    });
  } catch (error) {
    console.error('Get subscriber error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_SUBSCRIBER_ERROR',
          message: error instanceof Error ? error.message : '获取订阅者信息失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/quail/subscribers/:userId
 * 更新订阅者邮件设置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.userId);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的用户 ID',
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = UpdateEmailSchema.parse(body);

    const quailApi = getQuailApi();
    await quailApi.updateMemberEmail(userId, data.enabled);

    return NextResponse.json({
      success: true,
      message: '邮件设置更新成功',
    });
  } catch (error) {
    console.error('Update subscriber error:', error);

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
          code: 'UPDATE_SUBSCRIBER_ERROR',
          message: error instanceof Error ? error.message : '更新订阅者失败',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quail/subscribers/:userId
 * 删除订阅者
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.userId);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的用户 ID',
          },
        },
        { status: 400 }
      );
    }

    const quailApi = getQuailApi();
    await quailApi.deleteMember(userId);

    return NextResponse.json({
      success: true,
      message: '订阅者删除成功',
    });
  } catch (error) {
    console.error('Delete subscriber error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_SUBSCRIBER_ERROR',
          message: error instanceof Error ? error.message : '删除订阅者失败',
        },
      },
      { status: 500 }
    );
  }
}
