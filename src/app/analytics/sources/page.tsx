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
  Table,
  Tag,
  Progress,
  Alert,
  Statistic,
  Tooltip,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  GlobalOutlined,
  TrophyOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Line, Column, Pie } from '@ant-design/charts';
import { useAuth } from '@/hooks/useAuth';
import { useSourceAnalytics } from '@/hooks/useSourceAnalytics';
import { SourceRankingChart } from '@/components/charts/SourceRankingChart';

const { Title, Text } = Typography;

export default function SourceAnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(30);
  const { data: sourceData, loading, error, refetch } = useSourceAnalytics(timeRange);

  const handleTimeRangeChange = (value: number) => {
    setTimeRange(value);
  };

  // 来源排行表格列定义
  const rankingColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <div style={{ textAlign: 'center' }}>
          {index < 3 ? (
            <TrophyOutlined style={{ 
              color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
              fontSize: '16px'
            }} />
          ) : (
            <Text strong>{index + 1}</Text>
          )}
        </div>
      ),
    },
    {
      title: '来源网站',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Text strong style={{ color: '#1890ff' }}>{source}</Text>
      ),
    },
    {
      title: '内容数量',
      dataIndex: 'totalCount',
      key: 'totalCount',
      sorter: (a: any, b: any) => a.totalCount - b.totalCount,
      render: (count: number, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{count}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            已发布: {record.publishedCount}
          </Text>
        </Space>
      ),
    },
    {
      title: '发布率',
      dataIndex: 'publishRate',
      key: 'publishRate',
      sorter: (a: any, b: any) => a.publishRate - b.publishRate,
      render: (rate: number) => (
        <Progress 
          percent={rate} 
          size="small" 
          status={rate >= 80 ? 'success' : rate >= 60 ? 'normal' : 'exception'}
          format={(percent) => `${percent}%`}
        />
      ),
    },
    {
      title: '平均字数',
      dataIndex: 'avgWordCount',
      key: 'avgWordCount',
      sorter: (a: any, b: any) => a.avgWordCount - b.avgWordCount,
      render: (count: number) => `${count} 字`,
    },
    {
      title: '总浏览量',
      dataIndex: 'totalViews',
      key: 'totalViews',
      sorter: (a: any, b: any) => a.totalViews - b.totalViews,
      render: (views: number) => views.toLocaleString(),
    },
    {
      title: '最新内容',
      dataIndex: 'latestContentDate',
      key: 'latestContentDate',
      render: (date: string) => {
        const daysDiff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        return (
          <Tooltip title={new Date(date).toLocaleString()}>
            <Text type={daysDiff <= 7 ? 'success' : daysDiff <= 30 ? 'warning' : 'secondary'}>
              {daysDiff === 0 ? '今天' : `${daysDiff}天前`}
            </Text>
          </Tooltip>
        );
      },
    },
  ];

  // 质量分析表格列定义
  const qualityColumns = [
    {
      title: '来源网站',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Text strong style={{ color: '#1890ff' }}>{source}</Text>
      ),
    },
    {
      title: '质量评分',
      dataIndex: 'qualityScore',
      key: 'qualityScore',
      sorter: (a: any, b: any) => a.qualityScore - b.qualityScore,
      render: (score: number) => (
        <div>
          <Progress 
            percent={score * 20} // 转换为百分比
            size="small"
            status={score >= 4 ? 'success' : score >= 3 ? 'normal' : 'exception'}
            format={() => score.toFixed(1)}
          />
        </div>
      ),
    },
    {
      title: '平均字数',
      dataIndex: 'avgWordCount',
      key: 'avgWordCount',
      render: (count: number) => `${count} 字`,
    },
    {
      title: '平均阅读时间',
      dataIndex: 'avgReadingTime',
      key: 'avgReadingTime',
      render: (time: number) => `${time} 分钟`,
    },
    {
      title: '描述完整率',
      dataIndex: 'descriptionRate',
      key: 'descriptionRate',
      render: (rate: number) => (
        <Tag color={rate >= 80 ? 'green' : rate >= 60 ? 'orange' : 'red'}>
          {rate}%
        </Tag>
      ),
    },
    {
      title: '链接完整率',
      dataIndex: 'sourceUrlRate',
      key: 'sourceUrlRate',
      render: (rate: number) => (
        <Tag color={rate >= 80 ? 'green' : rate >= 60 ? 'orange' : 'red'}>
          {rate}%
        </Tag>
      ),
    },
  ];

  // 域名分析表格列定义
  const domainColumns = [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: string) => (
        <Space>
          <GlobalOutlined />
          <Text code>{domain}</Text>
        </Space>
      ),
    },
    {
      title: '来源数量',
      dataIndex: 'sourceCount',
      key: 'sourceCount',
      sorter: (a: any, b: any) => a.sourceCount - b.sourceCount,
    },
    {
      title: '内容数量',
      dataIndex: 'contentCount',
      key: 'contentCount',
      sorter: (a: any, b: any) => a.contentCount - b.contentCount,
    },
    {
      title: '平均质量',
      dataIndex: 'avgQuality',
      key: 'avgQuality',
      sorter: (a: any, b: any) => a.avgQuality - b.avgQuality,
      render: (quality: number) => (
        <Tag color={quality >= 2 ? 'green' : quality >= 1 ? 'orange' : 'red'}>
          {quality.toFixed(2)}
        </Tag>
      ),
    },
  ];

  // 活跃度分析表格列定义
  const activityColumns = [
    {
      title: '来源网站',
      dataIndex: 'source',
      key: 'source',
      render: (source: string, record: any) => (
        <Space>
          <Text strong style={{ color: '#1890ff' }}>{source}</Text>
          {record.isActive ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>活跃</Tag>
          ) : (
            <Tag color="red" icon={<ExclamationCircleOutlined />}>不活跃</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '活跃天数',
      dataIndex: 'activeDays',
      key: 'activeDays',
      sorter: (a: any, b: any) => a.activeDays - b.activeDays,
      render: (days: number) => `${days} 天`,
    },
    {
      title: '内容频率',
      dataIndex: 'contentFrequency',
      key: 'contentFrequency',
      sorter: (a: any, b: any) => a.contentFrequency - b.contentFrequency,
      render: (frequency: number) => `${frequency.toFixed(2)} 篇/天`,
    },
    {
      title: '首次发布',
      dataIndex: 'firstContentDate',
      key: 'firstContentDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '最新发布',
      dataIndex: 'lastContentDate',
      key: 'lastContentDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  // 准备趋势图数据
  const trendData = sourceData?.trends.daily || [];
  const topSources = sourceData?.ranking.slice(0, 5).map(s => s.source) || [];
  const filteredTrendData = trendData.filter(item => topSources.includes(item.source));

  const trendConfig = {
    data: filteredTrendData,
    xField: 'date',
    yField: 'count',
    seriesField: 'source',
    smooth: true,
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: datum.source,
          value: `${datum.count} 篇`,
        };
      },
    },
  };

  if (!user) {
    return null;
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px',
      background: '#f0f2f5'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <div>
              <Space>
                <Button 
                  icon={<ArrowLeftOutlined />} 
                  onClick={() => router.back()}
                >
                  返回
                </Button>
                <Title level={2} style={{ margin: 0 }}>
                  <GlobalOutlined style={{ marginRight: '8px' }} />
                  Weekly 来源分析
                </Title>
              </Space>
              <Text type="secondary">
                分析 Weekly 内容的来源网站分布、质量和趋势
              </Text>
            </div>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              style={{ width: 120 }}
              options={[
                { label: '最近7天', value: 7 },
                { label: '最近30天', value: 30 },
                { label: '最近90天', value: 90 },
                { label: '最近365天', value: 365 },
              ]}
            />
          </div>
        </Card>

        {error && (
          <Alert
            message="数据加载失败"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: '24px' }}
            action={
              <Button size="small" onClick={refetch}>
                重试
              </Button>
            }
          />
        )}

        {/* 概览统计 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="活跃来源数"
                value={sourceData?.ranking.length || 0}
                prefix={<GlobalOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="域名数量"
                value={sourceData?.domains.length || 0}
                prefix={<GlobalOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="平均质量评分"
                value={sourceData?.quality.length ? 
                  (sourceData.quality.reduce((sum, item) => sum + item.qualityScore, 0) / sourceData.quality.length).toFixed(2) : 
                  0
                }
                suffix="/ 5.0"
                loading={loading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="活跃来源比例"
                value={sourceData?.activity.length ? 
                  Math.round((sourceData.activity.filter(s => s.isActive).length / sourceData.activity.length) * 100) : 
                  0
                }
                suffix="%"
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <SourceRankingChart
              data={sourceData?.ranking || []}
              loading={loading}
              title={`来源排行榜 (最近${timeRange}天)`}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Card title="来源趋势分析" loading={loading} size="small">
              {filteredTrendData.length > 0 ? (
                <Line {...trendConfig} height={300} />
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">暂无趋势数据</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 详细数据表格 */}
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title="来源排行详情" size="small">
              <Table
                columns={rankingColumns}
                dataSource={sourceData?.ranking || []}
                loading={loading}
                rowKey="source"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24} lg={12}>
            <Card title="质量分析" size="small">
              <Table
                columns={qualityColumns}
                dataSource={sourceData?.quality || []}
                loading={loading}
                rowKey="source"
                pagination={{ pageSize: 8 }}
                size="small"
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="域名分析" size="small">
              <Table
                columns={domainColumns}
                dataSource={sourceData?.domains || []}
                loading={loading}
                rowKey="domain"
                pagination={{ pageSize: 8 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24}>
            <Card title="活跃度分析" size="small">
              <Table
                columns={activityColumns}
                dataSource={sourceData?.activity || []}
                loading={loading}
                rowKey="source"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}