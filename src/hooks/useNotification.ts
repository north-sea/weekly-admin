'use client';

import { App } from 'antd';

/**
 * 统一的通知管理Hook
 * 封装Ant Design的App.useApp()，提供message和modal的统一接口
 * 解决静态方法无法消费动态主题上下文的问题
 */
export const useNotification = () => {
  const { message, modal } = App.useApp();

  return {
    message: {
      success: (content: string, duration?: number) => message.success(content, duration),
      error: (content: string, duration?: number) => message.error(content, duration),
      warning: (content: string, duration?: number) => message.warning(content, duration),
      info: (content: string, duration?: number) => message.info(content, duration),
    },
    modal: {
      confirm: (config: any) => modal.confirm(config),
      info: (config: any) => modal.info(config),
      success: (config: any) => modal.success(config),
      error: (config: any) => modal.error(config),
      warning: (config: any) => modal.warning(config),
    }
  };
};