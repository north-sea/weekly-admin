/**
 * 同步按钮组件
 * 从 Karakeep 同步书签数据
 */

'use client';

import React from 'react';
import { Button, Tooltip, Space, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useSyncDrafts } from '@/hooks/queries';
import { useNotification } from '@/hooks/useNotification';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

interface SyncButtonProps {
  lastSyncTime?: string | null;
  showLastSyncTime?: boolean;
}

export default function SyncButton({ lastSyncTime, showLastSyncTime = true }: SyncButtonProps) {
  const { message: msg } = useNotification();
  const syncMutation = useSyncDrafts();

  const handleSync = async () => {
    try {
      const stats = await syncMutation.mutateAsync();
      
      // 构建详细的同步消息
      const parts: string[] = [];
      if (stats.created > 0) parts.push(`新增 ${stats.created} 条`);
      if (stats.updated > 0) parts.push(`更新 ${stats.updated} 条`);
      if (stats.unchanged > 0) parts.push(`未变化 ${stats.unchanged} 条`);
      if (stats.errors > 0) parts.push(`失败 ${stats.errors} 条`);
      if (stats.duplicatesDetected > 0) parts.push(`去重 ${stats.duplicatesDetected} 条`);
      
      const message = `同步完成（共 ${stats.total} 条）：${parts.join('，')}`;
      
      if (stats.errors > 0) {
        msg.warning(message);
      } else {
        msg.success(message);
      }
    } catch {
      msg.error('同步失败，请检查 Karakeep 配置');
    }
  };

  return (
    <Space size="middle">
      <Tooltip title="从 Karakeep 同步最新书签">
        <Button
          type="primary"
          icon={<SyncOutlined spin={syncMutation.isPending} />}
          onClick={handleSync}
          loading={syncMutation.isPending}
        >
          同步
        </Button>
      </Tooltip>

      {showLastSyncTime && lastSyncTime && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          最后同步: {dayjs(lastSyncTime).fromNow()}
        </Text>
      )}
    </Space>
  );
}

