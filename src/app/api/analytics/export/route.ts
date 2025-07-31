import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const { reportType, timeRange, format } = await request.json();
    
    const days = parseInt(timeRange) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let reportData: any = {};
    let fileName = '';

    switch (reportType) {
      case 'overview':
        // 生成概览报告
        const [
          totalContents,
          publishedContents,
          totalCategories,
          totalTags,
          totalWeeklyIssues,
        ] = await Promise.all([
          prisma.contents.count(),
          prisma.contents.count({ where: { status: 'published' } }),
          prisma.categories.count(),
          prisma.tags.count(),
          prisma.weekly_issues.count(),
        ]);

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

        reportData = {
          summary: {
            totalContents,
            publishedContents,
            totalCategories,
            totalTags,
            totalWeeklyIssues,
            publishRate: totalContents > 0 ? Math.round((publishedContents / totalContents) * 100) : 0,
          },
          trends: publishTrend.map(item => ({
            date: item.date,
            count: Number(item.count)
          })),
          generatedAt: new Date().toISOString(),
          timeRange: { days, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        };
        fileName = `overview-report-${days}days-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'sources':
        // 生成来源分析报告
        const sourceRanking = await prisma.$queryRaw<Array<{
          source: string;
          total_count: bigint;
          published_count: bigint;
          avg_word_count: number;
          total_views: bigint;
        }>>`
          SELECT 
            COALESCE(source, '未知来源') as source,
            COUNT(*) as total_count,
            COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
            AVG(word_count) as avg_word_count,
            SUM(view_count) as total_views
          FROM contents
          WHERE content_type_id = 4
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY source
          ORDER BY total_count DESC
        `;

        reportData = {
          sources: sourceRanking.map(item => ({
            source: item.source,
            totalCount: Number(item.total_count),
            publishedCount: Number(item.published_count),
            avgWordCount: Math.round(item.avg_word_count || 0),
            totalViews: Number(item.total_views),
            publishRate: Number(item.total_count) > 0 
              ? Math.round((Number(item.published_count) / Number(item.total_count)) * 100) 
              : 0,
          })),
          generatedAt: new Date().toISOString(),
          timeRange: { days, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        };
        fileName = `sources-report-${days}days-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'quality':
        // 生成质量分析报告
        const qualityAnalysis = await prisma.$queryRaw<Array<{
          content_type: string;
          avg_word_count: number;
          avg_reading_time: number;
          avg_view_count: number;
          total_contents: bigint;
          high_quality_contents: bigint;
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
            COUNT(*) as total_contents,
            COUNT(CASE 
              WHEN word_count >= 500 AND description IS NOT NULL AND description != '' THEN 1 
            END) as high_quality_contents
          FROM contents
          WHERE status = 'published'
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY content_type_id
        `;

        const topPerformers = await prisma.contents.findMany({
          where: {
            status: 'published',
            created_at: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            id: true,
            title: true,
            word_count: true,
            view_count: true,
            reading_time: true,
            created_at: true,
            categories: {
              select: { name: true }
            }
          },
          orderBy: { view_count: 'desc' },
          take: 20,
        });

        reportData = {
          qualityMetrics: qualityAnalysis.map(item => ({
            contentType: item.content_type,
            avgWordCount: Math.round(item.avg_word_count || 0),
            avgReadingTime: Math.round(item.avg_reading_time || 0),
            avgViewCount: Math.round(item.avg_view_count || 0),
            totalContents: Number(item.total_contents),
            highQualityContents: Number(item.high_quality_contents),
            qualityRate: Number(item.total_contents) > 0 
              ? Math.round((Number(item.high_quality_contents) / Number(item.total_contents)) * 100) 
              : 0,
          })),
          topPerformers: topPerformers.map(content => ({
            id: content.id,
            title: content.title,
            wordCount: content.word_count || 0,
            viewCount: content.view_count || 0,
            readingTime: content.reading_time || 0,
            categoryName: content.categories?.name || '未分类',
            createdAt: content.created_at,
          })),
          generatedAt: new Date().toISOString(),
          timeRange: { days, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        };
        fileName = `quality-report-${days}days-${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REPORT_TYPE',
              message: '无效的报告类型',
            },
          },
          { status: 400 }
        );
    }

    // 根据格式返回数据
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: reportData,
        fileName: `${fileName}.json`,
      });
    } else if (format === 'csv') {
      // 简单的CSV格式转换
      let csvContent = '';
      
      if (reportType === 'overview') {
        csvContent = 'Date,Published Count\n';
        reportData.trends.forEach((item: any) => {
          csvContent += `${item.date},${item.count}\n`;
        });
      } else if (reportType === 'sources') {
        csvContent = 'Source,Total Count,Published Count,Publish Rate,Avg Word Count,Total Views\n';
        reportData.sources.forEach((item: any) => {
          csvContent += `${item.source},${item.totalCount},${item.publishedCount},${item.publishRate}%,${item.avgWordCount},${item.totalViews}\n`;
        });
      } else if (reportType === 'quality') {
        csvContent = 'Content Type,Total Contents,High Quality Contents,Quality Rate,Avg Word Count,Avg Views\n';
        reportData.qualityMetrics.forEach((item: any) => {
          csvContent += `${item.contentType},${item.totalContents},${item.highQualityContents},${item.qualityRate}%,${item.avgWordCount},${item.avgViewCount}\n`;
        });
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      fileName: `${fileName}.json`,
    });
  } catch (error) {
    console.error('Export analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : '导出分析报告失败',
        },
      },
      { status: 500 }
    );
  }
}