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

    // 来源网站排行榜
    const sourceRanking = await prisma.$queryRaw<Array<{
      source: string;
      total_count: bigint;
      published_count: bigint;
      draft_count: bigint;
      avg_word_count: number;
      total_views: bigint;
      latest_content_date: Date;
    }>>`
      SELECT 
        COALESCE(source, '未知来源') as source,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        AVG(word_count) as avg_word_count,
        SUM(view_count) as total_views,
        MAX(created_at) as latest_content_date
      FROM contents
      WHERE content_type_id = 4
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY source
      ORDER BY total_count DESC
      LIMIT 20
    `;

    // 来源趋势分析（按日统计）
    const sourceTrend = await prisma.$queryRaw<Array<{
      date: string;
      source: string;
      count: bigint;
    }>>`
      SELECT 
        DATE(created_at) as date,
        COALESCE(source, '未知来源') as source,
        COUNT(*) as count
      FROM contents 
      WHERE content_type_id = 4
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status = 'published'
      GROUP BY DATE(created_at), source
      ORDER BY date ASC, count DESC
    `;

    // 来源质量分析
    const sourceQuality = await prisma.$queryRaw<Array<{
      source: string;
      avg_word_count: number;
      avg_reading_time: number;
      avg_views: number;
      description_rate: number;
      source_url_rate: number;
      quality_score: number;
    }>>`
      SELECT 
        COALESCE(source, '未知来源') as source,
        AVG(word_count) as avg_word_count,
        AVG(reading_time) as avg_reading_time,
        AVG(view_count) as avg_views,
        (COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) * 100.0 / COUNT(*)) as description_rate,
        (COUNT(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 END) * 100.0 / COUNT(*)) as source_url_rate,
        (
          (AVG(word_count) / 1000.0 * 0.3) +
          (AVG(view_count) / 100.0 * 0.2) +
          ((COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) * 100.0 / COUNT(*)) / 100.0 * 0.3) +
          ((COUNT(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 END) * 100.0 / COUNT(*)) / 100.0 * 0.2)
        ) as quality_score
      FROM contents
      WHERE content_type_id = 4
        AND status = 'published'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY source
      HAVING COUNT(*) >= 3
      ORDER BY quality_score DESC
      LIMIT 15
    `;

    // 来源域名分析
    const domainAnalysis = await prisma.$queryRaw<Array<{
      domain: string;
      source_count: bigint;
      content_count: bigint;
      avg_quality: number;
    }>>`
      SELECT 
        CASE 
          WHEN source_url IS NOT NULL AND source_url != '' THEN
            REGEXP_REPLACE(
              REGEXP_REPLACE(source_url, '^https?://', ''),
              '/.*$', ''
            )
          ELSE '未知域名'
        END as domain,
        COUNT(DISTINCT source) as source_count,
        COUNT(*) as content_count,
        AVG(
          (word_count / 1000.0 * 0.4) +
          (view_count / 100.0 * 0.3) +
          (CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END * 0.3)
        ) as avg_quality
      FROM contents
      WHERE content_type_id = 4
        AND status = 'published'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY domain
      HAVING content_count >= 2
      ORDER BY content_count DESC
      LIMIT 10
    `;

    // 月度来源变化趋势
    const monthlySourceTrend = await prisma.$queryRaw<Array<{
      month: string;
      source: string;
      count: bigint;
    }>>`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COALESCE(source, '未知来源') as source,
        COUNT(*) as count
      FROM contents 
      WHERE content_type_id = 4
        AND status = 'published'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month, source
      HAVING count >= 2
      ORDER BY month ASC, count DESC
    `;

    // 来源活跃度分析
    const sourceActivity = await prisma.$queryRaw<Array<{
      source: string;
      first_content_date: Date;
      last_content_date: Date;
      active_days: number;
      content_frequency: number;
      is_active: boolean;
    }>>`
      SELECT 
        COALESCE(source, '未知来源') as source,
        MIN(created_at) as first_content_date,
        MAX(created_at) as last_content_date,
        DATEDIFF(MAX(created_at), MIN(created_at)) + 1 as active_days,
        COUNT(*) / (DATEDIFF(MAX(created_at), MIN(created_at)) + 1) as content_frequency,
        (DATEDIFF(NOW(), MAX(created_at)) <= 30) as is_active
      FROM contents
      WHERE content_type_id = 4
        AND status = 'published'
      GROUP BY source
      HAVING COUNT(*) >= 3
      ORDER BY content_frequency DESC
      LIMIT 15
    `;

    const result = {
      ranking: sourceRanking.map(item => ({
        source: item.source,
        totalCount: Number(item.total_count),
        publishedCount: Number(item.published_count),
        draftCount: Number(item.draft_count),
        avgWordCount: Math.round(item.avg_word_count || 0),
        totalViews: Number(item.total_views),
        latestContentDate: item.latest_content_date,
        publishRate: Number(item.total_count) > 0 
          ? Math.round((Number(item.published_count) / Number(item.total_count)) * 100) 
          : 0,
      })),
      trends: {
        daily: sourceTrend.map(item => ({
          date: item.date,
          source: item.source,
          count: Number(item.count),
        })),
        monthly: monthlySourceTrend.map(item => ({
          month: item.month,
          source: item.source,
          count: Number(item.count),
        })),
      },
      quality: sourceQuality.map(item => ({
        source: item.source,
        avgWordCount: Math.round(item.avg_word_count || 0),
        avgReadingTime: Math.round(item.avg_reading_time || 0),
        avgViews: Math.round(item.avg_views || 0),
        descriptionRate: Math.round(item.description_rate || 0),
        sourceUrlRate: Math.round(item.source_url_rate || 0),
        qualityScore: Math.round((item.quality_score || 0) * 100) / 100,
      })),
      domains: domainAnalysis.map(item => ({
        domain: item.domain,
        sourceCount: Number(item.source_count),
        contentCount: Number(item.content_count),
        avgQuality: Math.round((item.avg_quality || 0) * 100) / 100,
      })),
      activity: sourceActivity.map(item => ({
        source: item.source,
        firstContentDate: item.first_content_date,
        lastContentDate: item.last_content_date,
        activeDays: item.active_days,
        contentFrequency: Math.round((item.content_frequency || 0) * 100) / 100,
        isActive: Boolean(item.is_active),
      })),
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get source analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_SOURCE_ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : '获取来源分析数据失败',
        },
      },
      { status: 500 }
    );
  }
}