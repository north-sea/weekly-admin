'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  DatePicker, 
  Select, 
  Input, 
  Row, 
  Col,
  Statistic,
  Alert,
  Tooltip,
  Popover,
  Modal,
  message
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { 
  SearchOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface OperationLog {
  id: number;
  user_id: number;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  resource_type: string;
  resource_id?: number;
  operation_details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
  user?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

interface OperationStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByUser: Array<{
    userId: number;
    username: string;
    count: number;
  }>;
  operationsByResource: Array<{
    resourceType: string;
    count: number;
  }>;
  recentOperations: OperationLog[];
}

const OperationLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [stats, setStats] = useState<OperationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 筛选条件
  const [filters, setFilters] = useState({
    operationType: undefined as string | undefined,
    resourceType: undefined as string | undefined,
    userId: undefined as number | undefined,
    dateRange: undefined as [dayjs.Dayjs, dayjs.Dayjs] | undefined,
    keyword: undefined as string | undefined
  });
  
  // 异常操作检测
  const [anomalousOperations, setAnomalousOperations] = useState<any[]>([]);
  const [showAnomalousAlert, setShowAnomalousAlert] = useState(false);

  // 获取操作日志
  const fetchLogs = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      });
      
      if (filters.operationType) params.append('operationType', filters.operationType);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.userId) params.append('userId', filters.userId.toString());
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.dateRange) {
        params.append('startDate', filters.dateRange[0].toISOString());
        params.append('endDate', filters.dateRange[1].toISOString());
      }
      
      const response = await fetch(`/api/operation-logs?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setLogs(result.data.data);
        setPagination({
          current: result.data.pagination.page,
          pageSize: result.data.pagination.pageSize,
          total: result.data.pagination.total
        });
      } else {
        message.error('获取操作日志失败');
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      message.error('获取操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateRange) {
        params.append('startDate', filters.dateRange[0].toISOString());
        params.append('endDate', filters.dateRange[1].toISOString());
      }
      
      const response = await fetch(`/api/operation-logs/stats?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 导出日志
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams({ format });
      
      if (filters.operationType) params.append('operationType', filters.operationType);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.userId) params.append('userId', filters.userId.toString());
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.dateRange) {
        params.append('startDate', filters.dateRange[0].toISOString());
        params.append('endDate', filters.dateRange[1].toISOString());
      }
      
      const response = await fetch(`/api/operation-logs/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation-logs-${dayjs().format('YYYY-MM-DD')}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('导出成功');
      } else {
        message.error('导出失败');
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 检测异常操作
  const detectAnomalousOperations = async () => {
    try {
      // 这里应该调用异常检测API，暂时模拟数据
      const mockAnomalous = [
        {
          userId: 1,
          username: 'admin',
          operationCount: 120,
          timeWindow: '60 minutes'
        }
      ];
      
      if (mockAnomalous.length > 0) {
        setAnomalousOperations(mockAnomalous);
        setShowAnomalousAlert(true);
      }
    } catch (error) {
      console.error('异常检测失败:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    detectAnomalousOperations();
  }, []);

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, [filters]);

  // 表格列定义
  const columns: ColumnsType<OperationLog> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '用户',
      key: 'user',
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.user?.display_name || record.user?.username || '未知用户'}</span>
        </Space>
      )
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 100,
      render: (type: string) => {
        const colors = {
          CREATE: 'green',
          UPDATE: 'blue',
          DELETE: 'red',
          LOGIN: 'cyan',
          LOGOUT: 'orange'
        };
        return <Tag color={colors[type as keyof typeof colors]}>{type}</Tag>;
      }
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 100,
      render: (id) => id || '-'
    },
    {
      title: '操作详情',
      dataIndex: 'operation_details',
      key: 'operation_details',
      ellipsis: true,
      render: (details) => {
        if (!details) return '-';
        
        // 格式化显示内容
        let formattedContent;
        try {
          const parsed = JSON.parse(details);
          formattedContent = JSON.stringify(parsed, null, 2);
        } catch {
          formattedContent = details;
        }
        
        // Popover 内容组件
        const popoverContent = (
          <div style={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
            <pre 
              style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: '1.4',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflow: 'auto'
              }}
            >
              {formattedContent}
            </pre>
          </div>
        );
        
        return (
          <Popover
            content={popoverContent}
            title="操作详情"
            placement="topLeft"
            trigger="hover"
            overlayStyle={{ maxWidth: 450 }}
          >
            <span 
              style={{ 
                cursor: 'pointer',
                color: '#1890ff',
                borderBottom: '1px dashed #1890ff'
              }}
            >
              {details.substring(0, 50)}...
            </span>
          </Popover>
        );
      }
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
      render: (ip) => ip || '-'
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => (
        <Space>
          <ClockCircleOutlined />
          <span>{time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
        </Space>
      )
    }
  ];

  return (
    <PageContainer
      title="操作日志"
      subTitle="查看系统操作记录和用户活动"
    >
      {/* 异常操作告警 */}
      {showAnomalousAlert && anomalousOperations.length > 0 && (
        <Alert
          message="检测到异常操作"
          description={
            <div>
              {anomalousOperations.map((item, index) => (
                <div key={index}>
                  用户 {item.username} 在 {item.timeWindow} 内执行了 {item.operationCount} 次操作
                </div>
              ))}
            </div>
          }
          type="warning"
          icon={<ExclamationCircleOutlined />}
          closable
          onClose={() => setShowAnomalousAlert(false)}
          style={{ marginBottom: 16 }}
        />
      )}
      
      {/* 统计信息 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总操作数"
                value={stats.totalOperations}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="创建操作"
                value={stats.operationsByType.CREATE || 0}
                valueStyle={{ color: '#52c41a' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="更新操作"
                value={stats.operationsByType.UPDATE || 0}
                valueStyle={{ color: '#1890ff' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="删除操作"
                value={stats.operationsByType.DELETE || 0}
                valueStyle={{ color: '#f5222d' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
        </Row>
      )}
      
      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Select
              placeholder="操作类型"
              allowClear
              style={{ width: '100%' }}
              value={filters.operationType}
              onChange={(value) => setFilters({ ...filters, operationType: value })}
            >
              <Option value="CREATE">创建</Option>
              <Option value="UPDATE">更新</Option>
              <Option value="DELETE">删除</Option>
              <Option value="LOGIN">登录</Option>
              <Option value="LOGOUT">登出</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="资源类型"
              allowClear
              style={{ width: '100%' }}
              value={filters.resourceType}
              onChange={(value) => setFilters({ ...filters, resourceType: value })}
            >
              <Option value="content">内容</Option>
              <Option value="weekly_issue">周刊</Option>
              <Option value="category">分类</Option>
              <Option value="tag">标签</Option>
              <Option value="user_session">用户会话</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] })}
            />
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索关键词"
              prefix={<SearchOutlined />}
              allowClear
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchLogs(pagination.current, pagination.pageSize)}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '选择导出格式',
                    content: '请选择要导出的文件格式',
                    okText: 'JSON',
                    cancelText: 'CSV',
                    onOk: () => handleExport('json'),
                    onCancel: () => handleExport('csv')
                  });
                }}
              >
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      
      {/* 操作日志表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              fetchLogs(page, pageSize);
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </PageContainer>
  );
};

export default OperationLogsPage;