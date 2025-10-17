import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';
import { z } from 'zod';

const UpdateWeeklyIssueSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符').optional(),
  description: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确').optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const UpdateWeeklyContentsSchema = z.object({
  content_ids: z.array(z.number().int().positive()),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authMiddleware(request);
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的周刊ID',
          },
        },
        { status: 400 }
      );
    }

    const issue = await prisma.weekly_issues.findUnique({
      where: { id },
      include: {
        weekly_content_items: {
          orderBy: { sort_order: 'asc' },
          include: {
            content: {
              include: {
                categories: true,
                content_tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!issue) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '周刊不存在',
          },
        },
        { status: 404 }
      );
    }

    // 格式化返回数据，确保包含新增的结构化字段
    const formattedIssue = {
      ...issue,
      contents: issue.weekly_content_items.map((item) => ({
        ...item.content,
        // 周刊项目的额外字段
        sort_order: item.sort_order,
        section: item.section,
        featured: item.featured,
        // 关联数据
        tags: item.content.content_tags.map((ct) => ct.tag),
        category: item.content.categories,
        // 确保包含结构化预览字段（image_url, summary 已在 content 中）
      })),
    };

    delete (formattedIssue as any).weekly_content_items;

    return NextResponse.json({
      success: true,
      data: formattedIssue,
    });
  } catch (error) {
    console.error('Get weekly issue error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_WEEKLY_ISSUE_ERROR',
          message: error instanceof Error ? error.message : '获取周刊详情失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authMiddleware(request);
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的周刊ID',
          },
        },
        { status: 400 }
      );
    }

    const data = UpdateWeeklyIssueSchema.parse(body);

    const updateData: any = {};
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.start_date) updateData.start_date = new Date(data.start_date);
    if (data.end_date) updateData.end_date = new Date(data.end_date);
    if (data.status) updateData.status = data.status;

    // 如果发布，设置发布时间
    if (data.status === 'published') {
      updateData.published_at = new Date();
    }

    const issue = await prisma.weekly_issues.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Update weekly issue error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '数据验证失败',
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
          code: 'UPDATE_WEEKLY_ISSUE_ERROR',
          message: error instanceof Error ? error.message : '更新周刊失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authMiddleware(request);
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的周刊ID',
          },
        },
        { status: 400 }
      );
    }

    // 检查权限（只有管理员可以删除）
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: '权限不足',
          },
        },
        { status: 403 }
      );
    }

    await prisma.weekly_issues.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '周刊删除成功',
    });
  } catch (error) {
    console.error('Delete weekly issue error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_WEEKLY_ISSUE_ERROR',
          message: error instanceof Error ? error.message : '删除周刊失败',
        },
      },
      { status: 500 }
    );
  }
}