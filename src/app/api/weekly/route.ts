import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';
import { z } from 'zod';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

const CreateWeeklyIssueSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  desc: z.string().optional(),
  cover: z.string().optional(),
});

const GetWeeklyIssuesSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
  pageSize: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(10),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    
    const params = GetWeeklyIssuesSchema.parse({
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '10',
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const where: any = {};
    
    if (params.status) {
      where.status = params.status;
    }
    
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { desc: { contains: params.search } },
      ];
    }

    const [issues, total] = await Promise.all([
      prisma.weekly_issues.findMany({
        where,
        orderBy: { issue_number: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          _count: {
            select: {
              weekly_content_items: true,
            },
          },
        },
      }),
      prisma.weekly_issues.count({ where }),
    ]);

    return NextResponse.json(
      serializeSpecialTypes({
        success: true,
        data: {
          issues,
          total,
          page: params.page,
          pageSize: params.pageSize,
        },
      })
    );
  } catch (error) {
    console.error('Get weekly issues error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_WEEKLY_ISSUES_ERROR',
          message: error instanceof Error ? error.message : '获取周刊列表失败',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const body = await request.json();
    const data = CreateWeeklyIssueSchema.parse(body);

    // 获取下一个期号
    const lastIssue = await prisma.weekly_issues.findFirst({
      orderBy: { issue_number: 'desc' },
      select: { issue_number: true },
    });

    const nextIssueNumber = (lastIssue?.issue_number || 0) + 1;

    // 生成 slug
    const slug = `issue-${nextIssueNumber}`;

    const issue = await prisma.weekly_issues.create({
      data: {
        issue_number: nextIssueNumber,
        title: data.title,
        slug,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        status: data.status as any,
        desc: data.desc,
        created_by: user.id,
      },
    });

    return NextResponse.json(
      serializeSpecialTypes({
        success: true,
        data: issue,
      })
    );
  } catch (error) {
    console.error('Create weekly issue error:', error);
    
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
          code: 'CREATE_WEEKLY_ISSUE_ERROR',
          message: error instanceof Error ? error.message : '创建周刊失败',
        },
      },
      { status: 500 }
    );
  }
}
