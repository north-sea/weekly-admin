'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Drawer,
  Typography,
  Divider,
  Card,
  Row,
  Col
} from 'antd';
import {
  HistoryOutlined,
  EyeOutlined,
  RollbackOutlined,
  DiffOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface ContentVersion {
  id: number;
  content_id: string;
  version_number: number;
  title?: string;
  content?: string;
  description?: string;
  source?: string;
  source_url?: string;
  changes_summary?: string;
  created_by: number;
  created_at?: string;
  creator?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

interface VersionComparison {
  oldVersion: ContentVersion;
  newVersion: ContentVersion;
  changes: {
    title?: { old: string; new: string };
    content?: { old: string; new: string };
    description?: { old: string; new: string };
    source?: { old: string; new: string };
    source_url?: { old: string; new: string };
  };
}

interface VersionHistoryProps {
  contentId: number;
  visible: boolean;
  onClose: () => void;
  onVersionRestored?: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  contentId,
  visible,
  onClose,
  onVersionRestored
}) => {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [compareVisible, setCompareVisible] = useState(false);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);

  // 获取版本历史
  const fetchVersions = async () => {
    if (!contentId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}/versions`);
      const result = await response.json();
      
      if (result.success) {
        setVersions(result.data);
      } else {
        message.error('获取版本历史失败');
      }
    } catch (error) {
      console.error('获取版本历史失败:', error);
      message.error('获取版本历史失败');
    } finally {
      setLoading(false);
    }
  };

  // 预览版本
  const handlePreview = (version: ContentVersion) => {
    setSelectedVersion(version);
    setPreviewVisible(true);
  };

  // 比较版本
  const handleCompare = async (oldVersion: number, newVersion: number) => {
    try {
      const response = await fetch(
        `/api/content/${contentId}/versions/compare?old=${oldVersion}&new=${newVersion}`
      );
      const result = await response.json();
      
      if (result.success) {
        setComparison(result.data);
        setCompareVersions([oldVersion, newVersion]);
        setCompareVisible(true);
      } else {
        message.error('版本比较失败');
      }
    } catch (error) {
      console.error('版本比较失败:', error);
      message.error('版本比较失败');
    }
  };

  // 回滚版本
  const handleRollback = async (versionNumber: number) => {
    try {
      const response = await fetch(`/api/content/${contentId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ versionNumber })
      });
      
      const result = await response.json();
      
      if (result.success) {
        message.success('版本回滚成功');
        fetchVersions(); // 刷新版本列表
        onVersionRestored?.();
      } else {
        message.error('版本回滚失败');
      }
    } catch (error) {
      console.error('版本回滚失败:', error);
      message.error('版本回滚失败');
    }
  };

  useEffect(() => {
    if (visible && contentId) {
      fetchVersions();
    }
  }, [visible, contentId]);

  // 表格列定义
  const columns: ColumnsType<ContentVersion> = [
    {
      title: '版本号',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 80,
      render: (version) => <Tag color="blue">v{version}</Tag>
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title) => title || '-'
    },
    {
      title: '变更摘要',
      dataIndex: 'changes_summary',
      key: 'changes_summary',
      ellipsis: true,
      render: (summary) => summary || '-'
    },
    {
      title: '创建者',
      key: 'creator',
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.creator?.display_name || record.creator?.username || '未知'}</span>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => (
        <Space>
          <ClockCircleOutlined />
          <span>{time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="预览版本">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          
          {versions.length > 1 && (
            <Tooltip title="比较版本">
              <Button
                type="text"
                icon={<DiffOutlined />}
                onClick={() => {
                  const currentIndex = versions.findIndex(v => v.id === record.id);
                  if (currentIndex < versions.length - 1) {
                    handleCompare(
                      versions[currentIndex + 1].version_number,
                      record.version_number
                    );
                  }
                }}
                disabled={versions.findIndex(v => v.id === record.id) === versions.length - 1}
              />
            </Tooltip>
          )}
          
          <Popconfirm
            title="确定要回滚到此版本吗？"
            description="回滚操作将覆盖当前内容，请谨慎操作。"
            onConfirm={() => handleRollback(record.version_number)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="回滚到此版本">
              <Button
                type="text"
                icon={<RollbackOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 渲染变更差异
  const renderChanges = (changes: VersionComparison['changes']) => {
    return Object.entries(changes).map(([field, change]) => {
      if (!change) return null;
      
      const fieldNames: Record<string, string> = {
        title: '标题',
        content: '内容',
        description: '描述',
        source: '来源',
        source_url: '来源链接'
      };
      
      return (
        <Card key={field} size="small" style={{ marginBottom: 16 }}>
          <h4>{fieldNames[field] || field}</h4>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="danger">旧版本:</Text>
              <Paragraph
                style={{ 
                  background: '#fff2f0', 
                  padding: 8, 
                  borderRadius: 4,
                  marginTop: 8
                }}
              >
                {change.old || '(空)'}
              </Paragraph>
            </Col>
            <Col span={12}>
              <Text type="success">新版本:</Text>
              <Paragraph
                style={{ 
                  background: '#f6ffed', 
                  padding: 8, 
                  borderRadius: 4,
                  marginTop: 8
                }}
              >
                {change.new || '(空)'}
              </Paragraph>
            </Col>
          </Row>
        </Card>
      );
    });
  };

  return (
    <>
      {/* 版本历史主对话框 */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            版本历史
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={1000}
        footer={null}
      >
        <Table
          columns={columns}
          dataSource={versions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showQuickJumper: true
          }}
          scroll={{ x: 800 }}
        />
      </Modal>

      {/* 版本预览抽屉 */}
      <Drawer
        title={`版本预览 - v${selectedVersion?.version_number}`}
        placement="right"
        width={600}
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
      >
        {selectedVersion && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>标题:</Text>
                  <br />
                  <Text>{selectedVersion.title || '(无标题)'}</Text>
                </div>
                
                {selectedVersion.description && (
                  <div>
                    <Text strong>描述:</Text>
                    <br />
                    <Text>{selectedVersion.description}</Text>
                  </div>
                )}
                
                {selectedVersion.source && (
                  <div>
                    <Text strong>来源:</Text>
                    <br />
                    <Text>{selectedVersion.source}</Text>
                  </div>
                )}
                
                {selectedVersion.source_url && (
                  <div>
                    <Text strong>来源链接:</Text>
                    <br />
                    <Text copyable>{selectedVersion.source_url}</Text>
                  </div>
                )}
                
                <div>
                  <Text strong>变更摘要:</Text>
                  <br />
                  <Text>{selectedVersion.changes_summary || '无变更摘要'}</Text>
                </div>
              </Space>
            </Card>
            
            <Card title="内容" size="small">
              <Paragraph>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedVersion.content || '(无内容)'}
                </pre>
              </Paragraph>
            </Card>
          </div>
        )}
      </Drawer>

      {/* 版本比较对话框 */}
      <Modal
        title={
          compareVersions ? 
            `版本比较: v${compareVersions[0]} → v${compareVersions[1]}` : 
            '版本比较'
        }
        open={compareVisible}
        onCancel={() => setCompareVisible(false)}
        width={1200}
        footer={null}
      >
        {comparison && (
          <div>
            {Object.keys(comparison.changes).length === 0 ? (
              <Text>两个版本之间没有差异</Text>
            ) : (
              renderChanges(comparison.changes)
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default VersionHistory;