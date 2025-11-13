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
import { 
  useOperationLogs, 
  useOperationLogsStats, 
  useDetectAnomalousOperations,
  useExportOperationLogs,
  useRefreshOperationLogs
} from '@/hooks/queries/useOperationLogsQueries';
import type { OperationLog, OperationLogsQuery } from '@/lib/services/operation-logs-api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const OperationLogsPage: React.FC = () => {
  // 筛选条件
  const [filters, setFilters] = useState<OperationLogsQuery>({
    page: 1,
    pageSize: 20,
  });
  
  // 异常操作检测
  const [showAnomalousAlert, setShowAnomalousAlert] = useState(false);
  
  // React Query hooks
  const { data: logsData, isLoading: loading } = useOperationLogs(filters);
  const { data: stats, isLoading: statsLoading } = useOperationLogsStats(
    filters.startDate && filters.endDate 
      ? { startDate: filters.startDate, endDate: filters.endDate }
      : undefined
  );
  const { data: anomalousOperations = [], refetch: detectAnomalous } = useDetectAnomalousOperations();
  const exportMutation = useExportOperationLogs();
  const refreshLogs = useRefreshOperationLogs();
  
  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };
  
  // 初始检测异常操作
  useEffect(() => {
    detectAnomalous().then(({ data }) => {
      if (data && data.length > 0) {
        setShowAnomalousAlert(true);
      }
    });
  }, [detectAnomalous]);
  
  // 导出日志
  const handleExport = (format: 'json' | 'csv') => {
    const exportQuery = { ...filters };
    delete exportQuery.page;
    delete exportQuery.pageSize;
    
    exportMutation.mutate(
      { format, query: exportQuery },
      {
        onSuccess: () => {
          message.success('导出成功');
        },
        onError: (error) => {
          console.error('导出失败:', error);
          message.error('导出失败');
        },
      }
    );
  };
  
  // 处理表格变化
  const handleTableChange = (page: number, pageSize: number) => {
    setFilters(prev => ({ ...prev, page, pageSize }));
  };
  
  // 处理筛选条件变化
  const handleFilterChange = <K extends keyof OperationLogsQuery>(key: K, value: OperationLogsQuery[K]) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };
  
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
        
        let formattedContent;
        try {
          const parsed = JSON.parse(details);
          formattedContent = JSON.stringify(parsed, null, 2);
        } catch {
          formattedContent = details;
        }
        
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
                value={stats.operationsByType?.CREATE || 0}
                valueStyle={{ color: '#52c41a' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="更新操作"
                value={stats.operationsByType?.UPDATE || 0}
                valueStyle={{ color: '#1890ff' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="删除操作"
                value={stats.operationsByType?.DELETE || 0}
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
              onChange={(value) => handleFilterChange('operationType', value)}
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
              onChange={(value) => handleFilterChange('resourceType', value)}
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
              onChange={(dates) => {
                if (dates) {
                  handleFilterChange('startDate', dates[0]?.toISOString());
                  handleFilterChange('endDate', dates[1]?.toISOString());
                } else {
                  setFilters(prev => {
                    const newFilters = { ...prev };
                    delete newFilters.startDate;
                    delete newFilters.endDate;
                    return newFilters;
                  });
                }
              }}
            />
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索关键词"
              prefix={<SearchOutlined />}
              allowClear
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={refreshLogs}
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
                loading={exportMutation.isPending}
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
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: handleTableChange,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </PageContainer>
  );
};

export default OperationLogsPage;
