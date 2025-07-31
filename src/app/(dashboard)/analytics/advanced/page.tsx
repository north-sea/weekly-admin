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
  List,
  Avatar,
  Badge,
  Tabs,
  Dropdown,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  TrophyOutlined,
  UserOutlined,
  FileTextOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
  LinkOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Line, Column, Radar, Heatmap, Pie } from '@ant-design/charts';
import { PageContainer } from '@ant-design/pro-components';
import { useAuth } from '@/hooks/useAuth';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function AdvancedAnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(30);
  const { data: analytics, loading, error, refetch } = useAdvancedAnalytics(timeRange);

  const handleTimeRangeChange = (value: number) => {
    setTimeRange(value);
  };

  const handleExport = async (reportType: string, format: string) => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          reportType,
          timeRange,
          format,
        }),
      });

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${reportType}-report-${timeRange}days-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const result = await response.json();
          const dataStr = JSON.stringify(result.data, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        message.success('报告导出成功');
      } else {
        const error = await response.json();
        message.error(`导出失败: ${error.error?.message || '未知错误'}`);
      }
    } catch (error) {
      message.error('导出失败');
      console.error('Export error:', error);
    }
  };

  const exportMenuItems = [
    {
      key: 'overview-json',
      label: '概览报告 (JSON)',
      onClick: () => handleExport('overview', 'json'),
    },
    {
      key: 'overview-csv',
      label: '概览报告 (CSV)',
      onClick: () => handleExport('overview', 'csv'),
    },
    {
      key: 'sources-json',
      label: '来源分析 (JSON)',
      onClick: () => handleExport('sources', 'json'),
    },
    {
      key: 'sources-csv',
      label: '来源分析 (CSV)',
      onClick: () => handleExport('sources', 'csv'),
    },
    {
      key: 'quality-json',
      label: '质量分析 (JSON)',
      onClick: () => handleExport('quality', 'json'),
    },
    {
      key: 'quality-csv',
      label: '质量分析 (CSV)',
      onClick: () => handleExport('quality', 'csv'),
    },
  ];

  // 内容质量表格列定义
  const qualityColumns = [
    {
      title: '内容类型',
      dataIndex: 'contentType',
      key: 'contentType',
      render: (type: string) => (
        <Tag color={type === 'Blog' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '总数量',
      dataIndex: 'totalContents',
      key: 'totalContents',
    },
    {
      title: '质量评分',
      dataIndex: 'qualityScore',
      key: 'qualityScore',
      render: (score: number) => (
        <div>
          <Progress 
            percent={score * 100} 
            size="small"
            status={score >= 0.7 ? 'success' : score >= 0.5 ? 'normal' : 'exception'}
            format={() => score.toFixed(2)}
          />
        </div>
      ),
    },
    {
      title: '高质量率',
      dataIndex: 'qualityRate',
      key: 'qualityRate',
      render: (rate: number) => (
        <Tag color={rate >= 70 ? 'green' : rate >= 50 ? 'orange' : 'red'}>
          {rate}%
        </Tag>
      ),
    },
    {
      title: '平均字数',
      dataIndex: 'avgWordCount',
      key: 'avgWordCount',
      render: (count: number) => `${count} 字`,
    },
    {
      title: '平均浏览量',
      dataIndex: 'avgViewCount',
      key: 'avgViewCount',
    },
  ];

  // 用户活跃度表格列定义
  const userActivityColumns = [
    {
      title: '用户',
      key: 'user',
      render: (record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" />
          <div>
            <div>{record.displayName || record.username}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              @{record.username}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '活跃状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Badge 
          status={isActive ? 'success' : 'default'} 
          text={isActive ? '活跃' : '不活跃'} 
        />
      ),
    },
    {
      title: '活跃度评分',
      dataIndex: 'activityScore',
      key: 'activityScore',
      sorter: (a: any, b: any) => a.activityScore - b.activityScore,
      render: (score: number) => (
        <Progress 
          percent={Math.min(score * 10, 100)} 
          size="small"
          format={() => score.toFixed(2)}
        />
      ),
    },
    {
      title: '总操作数',
      dataIndex: 'totalOperations',
      key: 'totalOperations',
      sorter: (a: any, b: any) => a.totalOperations - b.totalOperations,
    },
    {
      title: '创建内容',
      dataIndex: 'contentCreated',
      key: 'contentCreated',
      sorter: (a: any, b: any) => a.contentCreated - b.contentCreated,
    },
    {
      title: '日均操作',
      dataIndex: 'avgDailyOperations',
      key: 'avgDailyOperations',
      render: (avg: number) => avg.toFixed(2),
    },
    {
      title: '最后活动',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      render: (date: string) => {
        const daysDiff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        return (
          <Tooltip title={new Date(date).toLocaleString()}>
            <Text type={daysDiff <= 1 ? 'success' : daysDiff <= 7 ? 'warning' : 'secondary'}>
              {daysDiff === 0 ? '今天' : `${daysDiff}天前`}
            </Text>
          </Tooltip>
        );
      },
    },
  ];

  // 内容表现表格列定义
  const performanceColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (title: string, record: any) => (
        <div>
          <Text strong>{title}</Text>
          <br />
          <Space size="small">
            <Tag color={record.contentType === 'Blog' ? 'blue' : 'green'} size="small">
              {record.contentType}
            </Tag>
            {record.categoryName && (
              <Tag size="small">{record.categoryName}</Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: '表现评分',
      dataIndex: 'performanceScore',
      key: 'performanceScore',
      sorter: (a: any, b: any) => a.performanceScore - b.performanceScore,
      render: (score: number) => (
        <div>
          <Progress 
            percent={Math.min(score * 20, 100)} 
            size="small"
            status={score >= 4 ? 'success' : score >= 2 ? 'normal' : 'exception'}
            format={() => score.toFixed(2)}
          />
        </div>
      ),
    },
    {
      title: '浏览量',
      dataIndex: 'viewCount',
      key: 'viewCount',
      sorter: (a: any, b: any) => a.viewCount - b.viewCount,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '字数',
      dataIndex: 'wordCount',
      key: 'wordCount',
      render: (count: number) => `${count} 字`,
    },
    {
      title: '标签数',
      dataIndex: 'tagCount',
      key: 'tagCount',
    },
    {
      title: '发布时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  // 准备图表数据
  const trendPredictionData = analytics?.trendPrediction.map(item => ({
    date: item.date,
    actual: item.actualCount,
    predicted: item.predictedCount,
    type: 'actual',
  })).concat(
    analytics?.trendPrediction.map(item => ({
      date: item.date,
      actual: item.predictedCount,
      predicted: item.predictedCount,
      type: 'predicted',
    })) || []
  ) || [];

  const trendConfig = {
    data: trendPredictionData,
    xField: 'date',
    yField: 'actual',
    seriesField: 'type',
    smooth: true,
    legend: {
      position: 'top' as const,
    },
    color: ['#1890ff', '#52c41a'],
  };

  // 时间分析热力图数据
  const heatmapData = analytics?.timeAnalysis.hourly.map(item => ({
    hour: `${item.hour}:00`,
    value: item.performanceIndex,
    count: item.contentCount,
  })) || [];

  const heatmapConfig = {
    data: heatmapData,
    xField: 'hour',
    yField: 'value',
    colorField: 'value',
    color: ['#BAE7FF', '#1890FF', '#0050B3'],
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: '表现指数',
          value: `${datum.value} (${datum.count}篇)`,
        };
      },
    },
  };

  if (!user) {
    return null;
  }

  return (
    <PageContainer
      title="高级数据分析"
      subTitle="深度分析内容质量、用户活跃度和预测趋势"
      breadcrumb={{
        items: [
          { title: '首页', href: '/dashboard' },
          { title: '数据分析', href: '/analytics' },
          { title: '高级分析' },
        ],
      }}
      extra={[
        <Button 
          key="back"
          icon={<ArrowLeftOutlined />} 
          onClick={() => router.back()}
        >
          返回
        </Button>,
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
        <Dropdown key="export" menu={{ items: exportMenuItems }} placement="bottomRight">
          <Button icon={<DownloadOutlined />}>
            导出报告
          </Button>
        </Dropdown>,
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
            <Button size="small" onClick={refetch}>
              重试
            </Button>
          }
        />
      )}

      <Tabs defaultActiveKey="quality" size="large">
        <TabPane tab="内容质量分析" key="quality">
          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <Card title="内容质量概览" loading={loading}>
                <Table
                  columns={qualityColumns}
                  dataSource={analytics?.contentQuality || []}
                  pagination={false}
                  rowKey="contentType"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col xs={24} lg={12}>
              <Card title="高表现内容排行" loading={loading} size="small">
                <Table
                  columns={performanceColumns}
                  dataSource={analytics?.contentPerformance || []}
                  pagination={{ pageSize: 10 }}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 800 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="内容关联度分析" loading={loading} size="small">
                <List
                  dataSource={analytics?.contentCorrelation.slice(0, 10) || []}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<LinkOutlined />} size="small" />}
                        title={
                          <Space>
                            <Tag color="blue">{item.categoryName}</Tag>
                            <Tag color="green">{item.tagName}</Tag>
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">{item.contentCount}篇内容</Text>
                            <Text type="secondary">关联强度: {item.correlationStrength}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="用户活跃度分析" key="activity">
          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <Card title="用户活跃度排行" loading={loading}>
                <Table
                  columns={userActivityColumns}
                  dataSource={analytics?.userActivity || []}
                  pagination={{ pageSize: 10 }}
                  rowKey="username"
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="趋势预测" key="prediction">
          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <Card title="发布趋势预测" loading={loading}>
                {trendPredictionData.length > 0 ? (
                  <Line {...trendConfig} height={300} />
                ) : (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="secondary">暂无预测数据</Text>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col xs={24}>
              <Card title="预测准确性分析" loading={loading} size="small">
                <List
                  dataSource={analytics?.trendPrediction.slice(0, 10) || []}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            icon={
                              item.trendDirection === 'up' ? <RiseOutlined /> :
                              item.trendDirection === 'down' ? <FallOutlined /> :
                              <MinusOutlined />
                            }
                            style={{
                              backgroundColor: 
                                item.trendDirection === 'up' ? '#52c41a' :
                                item.trendDirection === 'down' ? '#f5222d' :
                                '#faad14'
                            }}
                          />
                        }
                        title={
                          <Space>
                            <Text>{item.date}</Text>
                            <Tag color={item.accuracy === 'high' ? 'green' : 'orange'}>
                              {item.accuracy === 'high' ? '高准确度' : '中等准确度'}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">实际: {item.actualCount}篇</Text>
                            <Text type="secondary">预测: {item.predictedCount}篇</Text>
                            <Text type="secondary">
                              趋势: {
                                item.trendDirection === 'up' ? '上升' :
                                item.trendDirection === 'down' ? '下降' :
                                '稳定'
                              }
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="时间分析" key="time">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="每日发布时间分布" loading={loading}>
                {analytics?.timeAnalysis.weekly.length ? (
                  <Column
                    data={analytics.timeAnalysis.weekly}
                    xField="dayName"
                    yField="contentCount"
                    columnStyle={{ fill: '#1890ff' }}
                    height={250}
                  />
                ) : (
                  <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="secondary">暂无数据</Text>
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="小时发布热力图" loading={loading}>
                {heatmapData.length > 0 ? (
                  <div style={{ height: 250 }}>
                    <Text type="secondary">发布活跃时段分析</Text>
                    <List
                      dataSource={analytics?.timeAnalysis.hourly
                        .sort((a, b) => b.performanceIndex - a.performanceIndex)
                        .slice(0, 5) || []}
                      renderItem={(item, index) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar>{index + 1}</Avatar>}
                            title={`${item.hour}:00 - ${item.hour + 1}:00`}
                            description={
                              <Space>
                                <Text type="secondary">{item.contentCount}篇内容</Text>
                                <Text type="secondary">表现指数: {item.performanceIndex}</Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                ) : (
                  <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="secondary">暂无数据</Text>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </PageContainer>
  );
}