import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30'; // 默认30天
    const days = parseInt(timeRange);

    // 计算时间范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 基础统计
    const [
      totalContents,
      totalBlogContents,
      totalWeeklyContents,
      publishedContents,
      draftContents,
      totalCategories,
      totalTags,
      totalWeeklyIssues,
      publishedWeeklyIssues,
    ] = await Promise.all([
      // 总内容数
      prisma.contents.count(),
      // Blog内容数
      prisma.contents.count({
        where: { content_type_id: 3 }
      }),
      // Weekly内容数
      prisma.contents.count({
        where: { content_type_id: 4 }
      }),
      // 已发布内容数
      prisma.contents.count({
        where: { status: 'published' }
      }),
      // 草稿内容数
      prisma.contents.count({
        where: { status: 'draft' }
      }),
      // 分类总数
      prisma.categories.count(),
      // 标签总数
      prisma.tags.count(),
      // 周刊期号总数
      prisma.weekly_issues.count(),
      // 已发布周刊期号数
      prisma.weekly_issues.count({
        where: { status: 'published' }
      }),
    ]);

    // 发布趋势分析（按日统计）
    const publishTrend = await prisma.$queryRaw<Array<{date: string, count: bigint}>>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM contents 
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status = 'published'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // 内容类型分布
    const contentTypeDistribution = await prisma.$queryRaw<Array<{type: string, count: bigint}>>`
      SELECT 
        CASE 
          WHEN content_type_id = 3 THEN 'Blog'
          WHEN content_type_id = 4 THEN 'Weekly'
          ELSE 'Other'
        END as type,
        COUNT(*) as count
      FROM contents
      GROUP BY content_type_id
    `;

    // 分类使用统计（前10）
    const categoryStats = await prisma.$queryRaw<Array<{name: string, count: bigint}>>`
      SELECT 
        c.name,
        COUNT(co.id) as count
      FROM categories c
      LEFT JOIN contents co ON c.id = co.category_id
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // 标签使用统计（前20）
    const tagStats = await prisma.$queryRaw<Array<{name: string, count: bigint}>>`
      SELECT 
        t.name,
        COUNT(ct.content_id) as count
      FROM tags t
      LEFT JOIN content_tags ct ON t.id = ct.tag_id
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 20
    `;

    // Weekly来源统计（前10）
    const sourceStats = await prisma.$queryRaw<Array<{source: string, count: bigint}>>`
      SELECT 
        COALESCE(source, '未知来源') as source,
        COUNT(*) as count
      FROM contents
      WHERE content_type_id = 4
        AND status = 'published'
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `;

    // 最近活动（最近10条操作日志）
    const recentActivities = await prisma.operation_logs.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            display_name: true,
          }
        }
      }
    });

    // 内容质量分析
    const qualityAnalysis = await prisma.$queryRaw<Array<{
      avg_word_count: number,
      avg_reading_time: number,
      total_views: bigint,
      contents_with_description: bigint,
      contents_with_source: bigint
    }>>`
      SELECT 
        AVG(word_count) as avg_word_count,
        AVG(reading_time) as avg_reading_time,
        SUM(view_count) as total_views,
        COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as contents_with_description,
        COUNT(CASE WHEN source IS NOT NULL AND source != '' THEN 1 END) as contents_with_source
      FROM contents
      WHERE status = 'published'
    `;

    const stats = {
      overview: {
        totalContents,
        totalBlogContents,
        totalWeeklyContents,
        publishedContents,
        draftContents,
        totalCategories,
        totalTags,
        totalWeeklyIssues,
        publishedWeeklyIssues,
        publishRate: totalContents > 0 ? Math.round((publishedContents / totalContents) * 100) : 0,
      },
      trends: {
        publishTrend: publishTrend.map(item => ({
          date: item.date,
          count: Number(item.count)
        })),
        contentTypeDistribution: contentTypeDistribution.map(item => ({
          type: item.type,
          count: Number(item.count)
        })),
      },
      categories: {
        stats: categoryStats.map(item => ({
          name: item.name,
          count: Number(item.count)
        })),
        total: totalCategories,
      },
      tags: {
        stats: tagStats.map(item => ({
          name: item.name,
          count: Number(item.count)
        })),
        total: totalTags,
      },
      sources: {
        stats: sourceStats.map(item => ({
          source: item.source,
          count: Number(item.count)
        })),
      },
      quality: qualityAnalysis[0] ? {
        avgWordCount: Math.round(qualityAnalysis[0].avg_word_count || 0),
        avgReadingTime: Math.round(qualityAnalysis[0].avg_reading_time || 0),
        totalViews: Number(qualityAnalysis[0].total_views || 0),
        contentsWithDescription: Number(qualityAnalysis[0].contents_with_description || 0),
        contentsWithSource: Number(qualityAnalysis[0].contents_with_source || 0),
        descriptionRate: totalContents > 0 ? Math.round((Number(qualityAnalysis[0].contents_with_description || 0) / totalContents) * 100) : 0,
        sourceRate: totalWeeklyContents > 0 ? Math.round((Number(qualityAnalysis[0].contents_with_source || 0) / totalWeeklyContents) * 100) : 0,
      } : {
        avgWordCount: 0,
        avgReadingTime: 0,
        totalViews: 0,
        contentsWithDescription: 0,
        contentsWithSource: 0,
        descriptionRate: 0,
        sourceRate: 0,
      },
      activities: recentActivities.map(activity => ({
        id: activity.id,
        operationType: activity.operation_type,
        resourceType: activity.resource_type,
        resourceId: activity.resource_id,
        details: activity.operation_details,
        user: {
          username: activity.user.username,
          displayName: activity.user.display_name,
        },
        createdAt: activity.created_at,
      })),
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : '获取统计数据失败',
        },
      },
      { status: 500 }
    );
  }
}