'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Typography, 
  Button, 
  Space, 
  Row, 
  Col, 
  Select, 
  Alert,
  Tag,
  Divider
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { 
  BarChartOutlined,
  LineChartOutlined,
  GlobalOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  FolderOutlined,
  EditOutlined,
  BookOutlined
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/dashboard/StatCard';
import { PublishTrendChart } from '@/components/charts/PublishTrendChart';
import { ContentTypeChart } from '@/components/charts/ContentTypeChart';
import { CategoryChart } from '@/components/charts/CategoryChart';

const { Title, Text } = Typography;

export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(30);
  const { data: analytics, loading, error, refetch } = useAnalytics(timeRange);

  const handleTimeRangeChange = (value: number) => {
    setTimeRange(value);
  };

  if (!user) {
    return null;
  }

  return (
    <PageContainer
      title="数据分析"
      subTitle="内容发布趋势、分类分布和质量统计"
      extra={[
        <Select
          key="timeRange"
          value={timeRange}
          onChange={handleTimeRangeChange}
          style={{ width: 120 }}
          options={[
            { label: '最近7天', value: 7 },
            { label: '最近30天', value: 30 },
            { label: '最近90天', value: 90 },
            { label: '最近365天', value: 365 },
          ]}
        />,
        <Button 
          key="advanced"
          icon={<LineChartOutlined />}
          onClick={() => router.push('/analytics/advanced')}
        >
          高级分析
        </Button>,
        <Button 
          key="sources"
          icon={<GlobalOutlined />}
          onClick={() => router.push('/analytics/sources')}
        >
          来源分析
        </Button>,
      ]}
    >

      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      )}

      {/* Overview Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="总内容数"
            value={analytics?.overview.totalContents || 0}
            prefix={<FileTextOutlined />}
            loading={loading}
            extra={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                发布率: {analytics?.overview.publishRate || 0}%
              </Text>
            }
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="Blog 内容"
            value={analytics?.overview.totalBlogContents || 0}
            prefix={<EditOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="Weekly 内容"
            value={analytics?.overview.totalWeeklyContents || 0}
            prefix={<BookOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="周刊期号"
            value={analytics?.overview.totalWeeklyIssues || 0}
            prefix={<TrophyOutlined />}
            loading={loading}
            extra={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                已发布: {analytics?.overview.publishedWeeklyIssues || 0}
              </Text>
            }
          />
        </Col>
      </Row>

      {/* Quality Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="平均字数"
            value={analytics?.quality.avgWordCount || 0}
            suffix="字"
            prefix={<FileTextOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="平均阅读时间"
            value={analytics?.quality.avgReadingTime || 0}
            suffix="分钟"
            prefix={<ClockCircleOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="总浏览量"
            value={analytics?.quality.totalViews || 0}
            prefix={<EyeOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title="分类数量"
            value={analytics?.categories.total || 0}
            prefix={<FolderOutlined />}
            loading={loading}
            extra={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                标签: {analytics?.tags.total || 0}
              </Text>
            }
          />
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <PublishTrendChart
            data={analytics?.trends.publishTrend || []}
            loading={loading}
            title={`发布趋势 (最近${timeRange}天)`}
          />
        </Col>
        <Col xs={24} lg={12}>
          <ContentTypeChart
            data={analytics?.trends.contentTypeDistribution || []}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <CategoryChart
            data={analytics?.categories.stats || []}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <Card title="热门标签" loading={loading} size="small">
            <div style={{ minHeight: 200 }}>
              {analytics?.tags?.stats?.length ? (
                <Space wrap>
                  {analytics.tags.stats.slice(0, 15).map((tag, index) => (
                    <Tag 
                      key={tag.name} 
                      color={index < 5 ? 'blue' : index < 10 ? 'green' : 'default'}
                    >
                      {tag.name} ({tag.count})
                    </Tag>
                  ))}
                </Space>
              ) : (
                <div style={{ 
                  height: 200, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Text type="secondary">暂无标签数据</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}