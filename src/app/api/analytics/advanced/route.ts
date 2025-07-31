import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30';
    const days = parseInt(timeRange);

    // 计算时间范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 内容质量分析
    const contentQualityAnalysis = await prisma.$queryRaw<Array<{
      content_type: string;
      avg_word_count: number;
      avg_reading_time: number;
      avg_view_count: number;
      quality_score: number;
      total_contents: bigint;
      high_quality_contents: bigint;
      low_quality_contents: bigint;
    }>>`
      SELECT 
        CASE 
          WHEN content_type_id = 3 THEN 'Blog'
          WHEN content_type_id = 4 THEN 'Weekly'
          ELSE 'Other'
        END as content_type,
        AVG(word_count) as avg_word_count,
        AVG(reading_time) as avg_reading_time,
        AVG(view_count) as avg_view_count,
        AVG(
          (CASE WHEN word_count >= 500 THEN 1 ELSE 0 END * 0.3) +
          (CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END * 0.2) +
          (CASE WHEN view_count >= 10 THEN 1 ELSE 0 END * 0.2) +
          (CASE WHEN content_type_id = 4 AND source IS NOT NULL AND source != '' THEN 1 ELSE 0 END * 0.3)
        ) as quality_score,
        COUNT(*) as total_contents,
        COUNT(CASE 
          WHEN (
            (CASE WHEN word_count >= 500 THEN 1 ELSE 0 END * 0.3) +
            (CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END * 0.2) +
            (CASE WHEN view_count >= 10 THEN 1 ELSE 0 END * 0.2) +
            (CASE WHEN content_type_id = 4 AND source IS NOT NULL AND source != '' THEN 1 ELSE 0 END * 0.3)
          ) >= 0.7 THEN 1 
        END) as high_quality_contents,
        COUNT(CASE 
          WHEN (
            (CASE WHEN word_count >= 500 THEN 1 ELSE 0 END * 0.3) +
            (CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END * 0.2) +
            (CASE WHEN view_count >= 10 THEN 1 ELSE 0 END * 0.2) +
            (CASE WHEN content_type_id = 4 AND source IS NOT NULL AND source != '' THEN 1 ELSE 0 END * 0.3)
          ) < 0.3 THEN 1 
        END) as low_quality_contents
      FROM contents
      WHERE status = 'published'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY content_type_id
    `;

    // 用户活跃度分析
    const userActivityAnalysis = await prisma.$queryRaw<Array<{
      username: string;
      display_name: string;
      total_operations: bigint;
      content_created: bigint;
      content_updated: bigint;
      last_activity: Date;
      activity_score: number;
      avg_daily_operations: number;
    }>>`
      SELECT 
        u.username,
        u.display_name,
        COUNT(ol.id) as total_operations,
        COUNT(CASE WHEN ol.operation_type = 'CREATE' AND ol.resource_type = 'content' THEN 1 END) as content_created,
        COUNT(CASE WHEN ol.operation_type = 'UPDATE' AND ol.resource_type = 'content' THEN 1 END) as content_updated,
        MAX(ol.created_at) as last_activity,
        (
          COUNT(ol.id) / ${days} * 0.4 +
          COUNT(CASE WHEN ol.operation_type = 'CREATE' THEN 1 END) / ${days} * 0.6
        ) as activity_score,
        COUNT(ol.id) / ${days} as avg_daily_operations
      FROM users u
      LEFT JOIN operation_logs ol ON u.id = ol.user_id 
        AND ol.created_at >= ${startDate}
        AND ol.created_at <= ${endDate}
      GROUP BY u.id, u.username, u.display_name
      ORDER BY activity_score DESC
    `;

    // 内容关联度分析（基于标签和分类的相似性）
    const contentCorrelationAnalysis = await prisma.$queryRaw<Array<{
      category_name: string;
      tag_name: string;
      content_count: bigint;
      avg_word_count: number;
      avg_views: number;
      correlation_strength: number;
    }>>`
      SELECT 
        c.name as category_name,
        t.name as tag_name,
        COUNT(co.id) as content_count,
        AVG(co.word_count) as avg_word_count,
        AVG(co.view_count) as avg_views,
        (COUNT(co.id) * AVG(co.view_count) / 100.0) as correlation_strength
      FROM categories c
      JOIN contents co ON c.id = co.category_id
      JOIN content_tags ct ON co.id = ct.content_id
      JOIN tags t ON ct.tag_id = t.id
      WHERE co.status = 'published'
        AND co.created_at >= ${startDate}
        AND co.created_at <= ${endDate}
      GROUP BY c.id, c.name, t.id, t.name
      HAVING content_count >= 2
      ORDER BY correlation_strength DESC
      LIMIT 20
    `;

    // 预测性分析 - 发布趋势预测
    const publishTrendPrediction = await prisma.$queryRaw<Array<{
      date: string;
      actual_count: bigint;
      predicted_count: number;
      trend_direction: string;
    }>>`
      WITH daily_counts AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM contents 
        WHERE status = 'published'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      ),
      trend_analysis AS (
        SELECT 
          date,
          count,
          LAG(count, 1) OVER (ORDER BY date) as prev_count,
          LAG(count, 7) OVER (ORDER BY date) as week_ago_count,
          AVG(count) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg
        FROM daily_counts
      )
      SELECT 
        date,
        count as actual_count,
        ROUND(moving_avg * 1.1) as predicted_count,
        CASE 
          WHEN count > prev_count THEN 'up'
          WHEN count < prev_count THEN 'down'
          ELSE 'stable'
        END as trend_direction
      FROM trend_analysis
      WHERE prev_count IS NOT NULL
      ORDER BY date DESC
      LIMIT 30
    `;

    // 内容表现分析
    const contentPerformanceAnalysis = await prisma.$queryRaw<Array<{
      id: number;
      title: string;
      content_type: string;
      word_count: number;
      view_count: number;
      reading_time: number;
      performance_score: number;
      created_at: Date;
      category_name: string;
      tag_count: bigint;
    }>>`
      SELECT 
        co.id,
        co.title,
        CASE 
          WHEN co.content_type_id = 3 THEN 'Blog'
          WHEN co.content_type_id = 4 THEN 'Weekly'
          ELSE 'Other'
        END as content_type,
        co.word_count,
        co.view_count,
        co.reading_time,
        (
          (co.view_count / 100.0 * 0.4) +
          (co.word_count / 1000.0 * 0.2) +
          (CASE WHEN co.description IS NOT NULL AND co.description != '' THEN 1 ELSE 0 END * 0.2) +
          (COUNT(ct.tag_id) / 5.0 * 0.2)
        ) as performance_score,
        co.created_at,
        c.name as category_name,
        COUNT(ct.tag_id) as tag_count
      FROM contents co
      LEFT JOIN categories c ON co.category_id = c.id
      LEFT JOIN content_tags ct ON co.id = ct.content_id
      WHERE co.status = 'published'
        AND co.created_at >= ${startDate}
        AND co.created_at <= ${endDate}
      GROUP BY co.id, co.title, co.content_type_id, co.word_count, co.view_count, 
               co.reading_time, co.description, co.created_at, c.name
      ORDER BY performance_score DESC
      LIMIT 20
    `;

    // 时间段分析
    const timeAnalysis = await prisma.$queryRaw<Array<{
      hour: number;
      day_of_week: number;
      content_count: bigint;
      avg_views: number;
      performance_index: number;
    }>>`
      SELECT 
        HOUR(created_at) as hour,
        DAYOFWEEK(created_at) as day_of_week,
        COUNT(*) as content_count,
        AVG(view_count) as avg_views,
        (COUNT(*) * AVG(view_count) / 100.0) as performance_index
      FROM contents
      WHERE status = 'published'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY HOUR(created_at), DAYOFWEEK(created_at)
      HAVING content_count >= 2
      ORDER BY performance_index DESC
      LIMIT 50
    `;

    const result = {
      contentQuality: contentQualityAnalysis.map(item => ({
        contentType: item.content_type,
        avgWordCount: Math.round(item.avg_word_count || 0),
        avgReadingTime: Math.round(item.avg_reading_time || 0),
        avgViewCount: Math.round(item.avg_view_count || 0),
        qualityScore: Math.round((item.quality_score || 0) * 100) / 100,
        totalContents: Number(item.total_contents),
        highQualityContents: Number(item.high_quality_contents),
        lowQualityContents: Number(item.low_quality_contents),
        qualityRate: Number(item.total_contents) > 0 
          ? Math.round((Number(item.high_quality_contents) / Number(item.total_contents)) * 100) 
          : 0,
      })),
      userActivity: userActivityAnalysis.map(item => ({
        username: item.username,
        displayName: item.display_name,
        totalOperations: Number(item.total_operations),
        contentCreated: Number(item.content_created),
        contentUpdated: Number(item.content_updated),
        lastActivity: item.last_activity,
        activityScore: Math.round((item.activity_score || 0) * 100) / 100,
        avgDailyOperations: Math.round((item.avg_daily_operations || 0) * 100) / 100,
        isActive: item.last_activity && 
          (Date.now() - new Date(item.last_activity).getTime()) < (7 * 24 * 60 * 60 * 1000),
      })),
      contentCorrelation: contentCorrelationAnalysis.map(item => ({
        categoryName: item.category_name,
        tagName: item.tag_name,
        contentCount: Number(item.content_count),
        avgWordCount: Math.round(item.avg_word_count || 0),
        avgViews: Math.round(item.avg_views || 0),
        correlationStrength: Math.round((item.correlation_strength || 0) * 100) / 100,
      })),
      trendPrediction: publishTrendPrediction.map(item => ({
        date: item.date,
        actualCount: Number(item.actual_count),
        predictedCount: item.predicted_count,
        trendDirection: item.trend_direction,
        accuracy: Math.abs(Number(item.actual_count) - item.predicted_count) <= 2 ? 'high' : 'medium',
      })),
      contentPerformance: contentPerformanceAnalysis.map(item => ({
        id: item.id,
        title: item.title,
        contentType: item.content_type,
        wordCount: item.word_count || 0,
        viewCount: item.view_count || 0,
        readingTime: item.reading_time || 0,
        performanceScore: Math.round((item.performance_score || 0) * 100) / 100,
        createdAt: item.created_at,
        categoryName: item.category_name,
        tagCount: Number(item.tag_count),
      })),
      timeAnalysis: {
        hourly: timeAnalysis
          .filter(item => item.hour !== null)
          .map(item => ({
            hour: item.hour,
            contentCount: Number(item.content_count),
            avgViews: Math.round(item.avg_views || 0),
            performanceIndex: Math.round((item.performance_index || 0) * 100) / 100,
          }))
          .sort((a, b) => a.hour - b.hour),
        weekly: timeAnalysis
          .filter(item => item.day_of_week !== null)
          .reduce((acc: Record<number, any>, item) => {
            if (!acc[item.day_of_week]) {
              acc[item.day_of_week] = {
                dayOfWeek: item.day_of_week,
                contentCount: 0,
                avgViews: 0,
                performanceIndex: 0,
              };
            }
            acc[item.day_of_week].contentCount += Number(item.content_count);
            acc[item.day_of_week].avgViews += item.avg_views || 0;
            acc[item.day_of_week].performanceIndex += item.performance_index || 0;
            return acc;
          }, {}),
      },
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    // 转换weekly数据为数组
    result.timeAnalysis.weekly = Object.values(result.timeAnalysis.weekly)
      .map((item: any) => ({
        ...item,
        avgViews: Math.round(item.avgViews),
        performanceIndex: Math.round(item.performanceIndex * 100) / 100,
        dayName: ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六'][item.dayOfWeek] || '未知',
      }))
      .sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get advanced analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_ADVANCED_ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : '获取高级分析数据失败',
        },
      },
      { status: 500 }
    );
  }
}