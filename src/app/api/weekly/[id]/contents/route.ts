import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';
import { z } from 'zod';

const UpdateWeeklyContentsSchema = z.object({
  contents: z.array(z.object({
    content_id: z.number().int().positive(),
    sort_order: z.number().int().min(0).default(0),
    section: z.string().optional(),
    featured: z.boolean().default(false),
  })),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    const issueId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(issueId)) {
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

    const data = UpdateWeeklyContentsSchema.parse(body);

    // 检查周刊是否存在
    const issue = await prisma.weekly_issues.findUnique({
      where: { id: issueId },
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

    // 验证所有内容都是已发布的 Weekly 类型
    const contentIds = data.contents.map(c => c.content_id);
    const contents = await prisma.contents.findMany({
      where: {
        id: { in: contentIds },
        content_type_id: 4, // Weekly 类型
        status: 'published',
      },
    });

    if (contents.length !== contentIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT',
            message: '只能添加已发布的 Weekly 类型内容',
          },
        },
        { status: 400 }
      );
    }

    // 使用事务更新周刊内容
    await prisma.$transaction(async (tx) => {
      // 删除现有关联
      await tx.weekly_content_items.deleteMany({
        where: { weekly_issue_id: issueId },
      });

      // 添加新关联
      if (data.contents.length > 0) {
        await tx.weekly_content_items.createMany({
          data: data.contents.map((content) => ({
            weekly_issue_id: issueId,
            content_id: BigInt(content.content_id),
            sort_order: content.sort_order,
            section: content.section,
            featured: content.featured,
          })),
        });
      }

      // 更新周刊统计信息
      const stats = await tx.contents.aggregate({
        where: {
          id: { in: contentIds },
        },
        _sum: {
          word_count: true,
          reading_time: true,
        },
      });

      await tx.weekly_issues.update({
        where: { id: issueId },
        data: {
          total_items: data.contents.length,
          total_word_count: stats._sum.word_count || 0,
          reading_time: stats._sum.reading_time || 0,
        },
      });
    });

    // 获取更新后的周刊信息
    const updatedIssue = await prisma.weekly_issues.findUnique({
      where: { id: issueId },
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

    return NextResponse.json({
      success: true,
      data: updatedIssue,
    });
  } catch (error) {
    console.error('Update weekly contents error:', error);
    
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
          code: 'UPDATE_WEEKLY_CONTENTS_ERROR',
          message: error instanceof Error ? error.message : '更新周刊内容失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    const issueId = parseInt(params.id);

    if (isNaN(issueId)) {
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

    const contents = await prisma.weekly_content_items.findMany({
      where: { weekly_issue_id: issueId },
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
    });

    const formattedContents = contents.map((item) => ({
      ...item.content,
      sort_order: item.sort_order,
      section: item.section,
      featured: item.featured,
      tags: item.content.content_tags.map((ct) => ct.tag),
      category: item.content.categories,
    }));

    return NextResponse.json({
      success: true,
      data: formattedContents,
    });
  } catch (error) {
    console.error('Get weekly contents error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_WEEKLY_CONTENTS_ERROR',
          message: error instanceof Error ? error.message : '获取周刊内容失败',
        },
      },
      { status: 500 }
    );
  }
}