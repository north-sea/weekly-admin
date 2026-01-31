import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import {
  getContentWeeklyInfo,
  linkContentToWeekly,
  unlinkContentFromWeekly,
} from '@/lib/services/weekly-automation';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = await params;
    const contentId = parseInt(resolvedParams.id);

    if (isNaN(contentId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的内容ID',
          },
        },
        { status: 400 }
      );
    }

    const result = await getContentWeeklyInfo(contentId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '内容不存在',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get content weekly info error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_CONTENT_WEEKLY_ERROR',
          message: error instanceof Error ? error.message : '获取周刊关联信息失败',
        },
      },
      { status: 500 }
    );
  }
}

const LinkActionSchema = z.object({
  action: z.enum(['link', 'unlink']),
  weeklyIssueId: z.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = await params;
    const contentId = parseInt(resolvedParams.id);

    if (isNaN(contentId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的内容ID',
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, weeklyIssueId } = LinkActionSchema.parse(body);

    let result;

    if (action === 'link') {
      if (!weeklyIssueId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MISSING_WEEKLY_ID',
              message: '关联操作需要提供周刊ID',
            },
          },
          { status: 400 }
        );
      }
      result = await linkContentToWeekly(contentId, weeklyIssueId);
    } else {
      result = await unlinkContentFromWeekly(contentId);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Content weekly link action error:', error);

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
          code: 'LINK_ACTION_ERROR',
          message: error instanceof Error ? error.message : '操作失败',
        },
      },
      { status: 500 }
    );
  }
}
