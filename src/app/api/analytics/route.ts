import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30'; // 默认30天
    const days = parseInt(timeRange);

    // 限制时间范围，避免查询过大数据集
    if (days > 365) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_RANGE', message: '时间范围不能超过365天' } },
        { status: 400 }
      );
    }

    // 计算时间范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 基础统计 - 使用单个查询获取内容统计，减少数据库往返
    const contentStats = await prisma.$queryRaw<Array<{
      content_type_id: number,
      status: string,
      count: bigint
    }>>`
      SELECT 
        content_type_id,
        status,
        COUNT(*) as count
      FROM contents
      GROUP BY content_type_id, status
    `;

    // 其他基础统计
    const [totalCategories, totalTags, totalWeeklyIssues, publishedWeeklyIssues] = await Promise.all([
      prisma.categories.count(),
      prisma.tags.count(),
      prisma.weekly_issues.count(),
      prisma.weekly_issues.count({ where: { status: 'published' } }),
    ]);

    // 从聚合结果中计算各项统计
    const totalContents = contentStats.reduce((sum, stat) => sum + Number(stat.count), 0);
    const totalBlogContents = contentStats
      .filter(stat => stat.content_type_id === 4)  // 博客 (blog)
      .reduce((sum, stat) => sum + Number(stat.count), 0);
    const totalWeeklyContents = contentStats
      .filter(stat => stat.content_type_id === 3)  // 周刊 (weekly)
      .reduce((sum, stat) => sum + Number(stat.count), 0);
    const publishedContents = contentStats
      .filter(stat => stat.status === 'published')
      .reduce((sum, stat) => sum + Number(stat.count), 0);
    const draftContents = contentStats
      .filter(stat => stat.status === 'draft')
      .reduce((sum, stat) => sum + Number(stat.count), 0);

    // 第一组查询：趋势和分布分析
    const [publishTrend, contentTypeDistribution] = await Promise.all([
      // 发布趋势分析（按日统计）
      prisma.$queryRaw<Array<{date: string, count: bigint}>>`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM contents 
        WHERE created_at >= ${startDate}
          AND created_at <= ${endDate}
          AND status = 'published'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      // 内容类型分布
      prisma.$queryRaw<Array<{type: string, count: bigint}>>`
        SELECT 
          CASE 
            WHEN content_type_id = 4 THEN 'Blog'    -- 博客
            WHEN content_type_id = 3 THEN 'Weekly'  -- 周刊
            ELSE 'Other'
          END as type,
          COUNT(*) as count
        FROM contents
        GROUP BY content_type_id
      `
    ]);

    // 第二组查询：分类和标签统计
    const [categoryStats, tagStats] = await Promise.all([
      // 分类使用统计（前10）
      prisma.$queryRaw<Array<{name: string, count: bigint}>>`
        SELECT 
          c.name,
          COUNT(co.id) as count
        FROM categories c
        LEFT JOIN contents co ON c.id = co.category_id
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 10
      `,
      // 标签使用统计（前20）
      prisma.$queryRaw<Array<{name: string, count: bigint}>>`
        SELECT 
          t.name,
          COUNT(ct.content_id) as count
        FROM tags t
        LEFT JOIN content_tags ct ON t.id = ct.tag_id
        GROUP BY t.id, t.name
        ORDER BY count DESC
        LIMIT 20
      `
    ]);

    // 第三组查询：来源统计和质量分析
    const [sourceStats, qualityAnalysis] = await Promise.all([
      // Weekly来源统计（前10）
      prisma.$queryRaw<Array<{source: string, count: bigint}>>`
        SELECT 
          COALESCE(source, '未知来源') as source,
          COUNT(*) as count
        FROM contents
        WHERE content_type_id = 3  -- 周刊 (weekly)
          AND status = 'published'
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
      `,
      // 内容质量分析
      prisma.$queryRaw<Array<{
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
      `
    ]);

    // 最后查询：最近活动（较轻量的查询）
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

    const executionTime = Date.now() - startTime;
    
    // 性能监控日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`Analytics API executed in ${executionTime}ms for ${days} days range`);
    }

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        executionTime,
        timeRange: days,
        queriedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('Get analytics error:', {
      error: error instanceof Error ? error.message : error,
      executionTime,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : '获取统计数据失败',
        },
        meta: {
          executionTime,
          failedAt: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}