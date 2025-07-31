'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Typography, 
  Button, 
  Space, 
  Spin, 
  Row, 
  Col, 
  message, 
  Select, 
  Timeline,
  Tag,
  Divider,
  Alert
} from 'antd';
import { 
  LogoutOutlined, 
  UserOutlined, 
  FileTextOutlined, 
  TagsOutlined, 
  FolderOutlined,
  BookOutlined,
  EditOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BarChartOutlined,
  PlusOutlined,
  GlobalOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiClient } from '@/lib/api-client';
import { StatCard } from '@/components/dashboard/StatCard';
import { PublishTrendChart } from '@/components/charts/PublishTrendChart';
import { ContentTypeChart } from '@/components/charts/ContentTypeChart';
import { CategoryChart } from '@/components/charts/CategoryChart';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { logout } = useAuthStore();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(30);
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch } = useAnalytics(timeRange);

  const handleLogout = async () => {
    try {
      // Call logout API if user is authenticated
      if (user) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      router.replace('/login');
    }
  };

  const handleTimeRangeChange = (value: number) => {
    setTimeRange(value);
  };

  const formatOperationType = (type: string) => {
    const typeMap: Record<string, { text: string; color: string }> = {
      CREATE: { text: '创建', color: 'green' },
      UPDATE: { text: '更新', color: 'blue' },
      DELETE: { text: '删除', color: 'red' },
      LOGIN: { text: '登录', color: 'cyan' },
      LOGOUT: { text: '退出', color: 'default' },
    };
    return typeMap[type] || { text: type, color: 'default' };
  };

  const formatResourceType = (type: string) => {
    const typeMap: Record<string, string> = {
      content: '内容',
      category: '分类',
      tag: '标签',
      weekly_issue: '周刊',
      user: '用户',
    };
    return typeMap[type] || type;
  };

  if (authLoading || !user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
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
              <Title level={2} style={{ margin: 0 }}>
                <BarChartOutlined style={{ marginRight: '8px' }} />
                数据仪表板
              </Title>
              <Text type="secondary">
                Weekly 内容管理系统 - 欢迎回来，{user.displayName || user.username}！
              </Text>
            </div>
            <Space>
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
              <Button 
                type="primary" 
                danger 
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </Space>
          </div>
        </Card>

        {analyticsError && (
          <Alert
            message="数据加载失败"
            description={analyticsError}
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

        {/* Overview Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总内容数"
              value={analytics?.overview.totalContents || 0}
              prefix={<FileTextOutlined />}
              loading={analyticsLoading}
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
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="Weekly 内容"
              value={analytics?.overview.totalWeeklyContents || 0}
              prefix={<BookOutlined />}
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="周刊期号"
              value={analytics?.overview.totalWeeklyIssues || 0}
              prefix={<TrophyOutlined />}
              loading={analyticsLoading}
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
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="平均阅读时间"
              value={analytics?.quality.avgReadingTime || 0}
              suffix="分钟"
              prefix={<ClockCircleOutlined />}
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总浏览量"
              value={analytics?.quality.totalViews || 0}
              prefix={<EyeOutlined />}
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="分类数量"
              value={analytics?.categories.total || 0}
              prefix={<FolderOutlined />}
              loading={analyticsLoading}
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
              loading={analyticsLoading}
              title={`发布趋势 (最近${timeRange}天)`}
            />
          </Col>
          <Col xs={24} lg={12}>
            <ContentTypeChart
              data={analytics?.trends.contentTypeDistribution || []}
              loading={analyticsLoading}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <CategoryChart
              data={analytics?.categories.stats || []}
              loading={analyticsLoading}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Card title="热门标签" loading={analyticsLoading} size="small">
              <div style={{ minHeight: 200 }}>
                {analytics?.tags.stats.length ? (
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

        {/* Recent Activities and Quick Actions */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card title="最近活动" loading={analyticsLoading} size="small">
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {analytics?.activities.length ? (
                  <Timeline
                    items={analytics.activities.map((activity) => {
                      const opType = formatOperationType(activity.operationType);
                      return {
                        color: opType.color,
                        children: (
                          <div>
                            <div>
                              <Tag color={opType.color}>{opType.text}</Tag>
                              <Text strong>{formatResourceType(activity.resourceType)}</Text>
                              {activity.resourceId && (
                                <Text type="secondary"> #{activity.resourceId}</Text>
                              )}
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {activity.user.displayName || activity.user.username} · {' '}
                                {new Date(activity.createdAt).toLocaleString()}
                              </Text>
                            </div>
                          </div>
                        ),
                      };
                    })}
                  />
                ) : (
                  <Text type="secondary">暂无活动记录</Text>
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="快捷操作" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  block
                  onClick={() => router.push('/content')}
                >
                  创建新内容
                </Button>
                <Button 
                  icon={<BookOutlined />} 
                  block
                  onClick={() => router.push('/weekly')}
                >
                  管理周刊
                </Button>
                <Button 
                  icon={<BarChartOutlined />} 
                  block
                  onClick={() => router.push('/operation-logs')}
                >
                  查看操作日志
                </Button>
                <Button 
                  icon={<GlobalOutlined />} 
                  block
                  onClick={() => router.push('/analytics/sources')}
                >
                  来源分析
                </Button>
                <Button 
                  icon={<LineChartOutlined />} 
                  block
                  onClick={() => router.push('/analytics/advanced')}
                >
                  高级分析
                </Button>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    系统状态：正常运行
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    数据更新时间：{analytics?.timeRange ? new Date().toLocaleString() : '-'}
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}