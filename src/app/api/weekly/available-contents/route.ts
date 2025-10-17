import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';
import { z } from 'zod';

const GetAvailableContentsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
  pageSize: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(20),
  search: z.string().optional(),
  categoryId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  tagIds: z.string().optional(),
  excludeIssueId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  dateRange: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    
    const params = GetAvailableContentsSchema.parse({
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      search: searchParams.get('search') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      tagIds: searchParams.get('tagIds') || undefined,
      excludeIssueId: searchParams.get('excludeIssueId') || undefined,
      dateRange: searchParams.get('dateRange') || undefined,
    });

    const where: any = {
      content_type_id: 3, // Weekly 类型
      status: 'published',
    };

    // 搜索条件
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
        { content: { contains: params.search } },
        { source: { contains: params.search } },
      ];
    }

    // 分类筛选
    if (params.categoryId) {
      where.category_id = params.categoryId;
    }

    // 标签筛选
    if (params.tagIds) {
      const tagIdArray = params.tagIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (tagIdArray.length > 0) {
        where.content_tags = {
          some: {
            tag_id: { in: tagIdArray },
          },
        };
      }
    }

    // 时间范围筛选
    if (params.dateRange) {
      try {
        const [startDate, endDate] = params.dateRange.split(',');
        if (startDate && endDate) {
          where.created_at = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }
      } catch (error) {
        // 忽略无效的日期范围
      }
    }

    // 排除已在指定周刊中的内容
    if (params.excludeIssueId) {
      const existingContentIds = await prisma.weekly_content_items.findMany({
        where: { weekly_issue_id: params.excludeIssueId },
        select: { content_id: true },
      });

      if (existingContentIds.length > 0) {
        where.id = {
          notIn: existingContentIds.map(item => item.content_id),
        };
      }
    }

    const [contents, total] = await Promise.all([
      prisma.contents.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          categories: true,
          content_tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      prisma.contents.count({ where }),
    ]);

    // 格式化返回数据
    const formattedContents = contents.map((content) => ({
      ...content,
      tags: content.content_tags.map((ct) => ct.tag),
      category: content.categories,
    }));

    // 按分类分组
    const groupedByCategory = formattedContents.reduce((groups: any, content) => {
      const categoryName = content.category?.name || '未分类';
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(content);
      return groups;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        contents: formattedContents,
        groupedByCategory,
        total,
        page: params.page,
        pageSize: params.pageSize,
      },
    });
  } catch (error) {
    console.error('Get available contents error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_AVAILABLE_CONTENTS_ERROR',
          message: error instanceof Error ? error.message : '获取可用内容失败',
        },
      },
      { status: 500 }
    );
  }
}