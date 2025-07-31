import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    const id = parseInt(params.id);

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

    // 获取周刊基本信息
    const issue = await prisma.weekly_issues.findUnique({
      where: { id },
      include: {
        weekly_content_items: {
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

    // 计算统计信息
    const contents = issue.weekly_content_items.map(item => item.content);
    
    // 来源统计
    const sourceStats = contents.reduce((stats: Record<string, number>, content) => {
      const source = content.source || '未知来源';
      stats[source] = (stats[source] || 0) + 1;
      return stats;
    }, {});

    // 分类统计
    const categoryStats = contents.reduce((stats: Record<string, number>, content) => {
      const category = content.categories?.name || '未分类';
      stats[category] = (stats[category] || 0) + 1;
      return stats;
    }, {});

    // 标签统计
    const tagStats: Record<string, number> = {};
    contents.forEach(content => {
      content.content_tags.forEach(ct => {
        const tagName = ct.tag.name;
        tagStats[tagName] = (tagStats[tagName] || 0) + 1;
      });
    });

    // 时间分布统计（按创建日期）
    const timeStats = contents.reduce((stats: Record<string, number>, content) => {
      const date = new Date(content.created_at).toISOString().split('T')[0];
      stats[date] = (stats[date] || 0) + 1;
      return stats;
    }, {});

    // 内容质量统计
    const qualityStats = {
      totalContents: contents.length,
      totalWordCount: contents.reduce((sum, content) => sum + (content.word_count || 0), 0),
      totalReadingTime: contents.reduce((sum, content) => sum + (content.reading_time || 0), 0),
      averageWordCount: contents.length > 0 
        ? Math.round(contents.reduce((sum, content) => sum + (content.word_count || 0), 0) / contents.length)
        : 0,
      withDescription: contents.filter(content => content.description).length,
      withSource: contents.filter(content => content.source).length,
      withSourceUrl: contents.filter(content => content.source_url).length,
    };

    const stats = {
      issue: {
        id: issue.id,
        issue_number: issue.issue_number,
        title: issue.title,
        status: issue.status,
        total_items: issue.total_items,
        total_word_count: issue.total_word_count,
        reading_time: issue.reading_time,
        created_at: issue.created_at,
        published_at: issue.published_at,
      },
      sourceStats: Object.entries(sourceStats)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      categoryStats: Object.entries(categoryStats)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      tagStats: Object.entries(tagStats)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // 只返回前20个标签
      timeStats: Object.entries(timeStats)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      qualityStats,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get weekly stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_WEEKLY_STATS_ERROR',
          message: error instanceof Error ? error.message : '获取周刊统计失败',
        },
      },
      { status: 500 }
    );
  }
}