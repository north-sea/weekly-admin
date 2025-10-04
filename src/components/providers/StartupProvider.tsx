'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';

interface StartupState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const StartupContext = createContext<StartupState | null>(null);

export function useStartup() {
  const context = useContext(StartupContext);
  if (!context) {
    throw new Error('useStartup must be used within StartupProvider');
  }
  return context;
}

interface StartupProviderProps {
  children: React.ReactNode;
}

export default function StartupProvider({ children }: StartupProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStartup = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/health/startup', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Startup validation failed');
      }

      // Initialize client-side monitoring if in production
      if (process.env.NODE_ENV === 'production') {
        // Set up error tracking for client-side errors
        window.addEventListener('error', (event) => {
          console.error('Client-side error:', event.error);
          // In a real implementation, you might send this to a logging service
        });

        window.addEventListener('unhandledrejection', (event) => {
          console.error('Unhandled promise rejection:', event.reason);
          // In a real implementation, you might send this to a logging service
        });
      }

      setInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown startup error';
      setError(errorMessage);
      console.error('Startup validation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    checkStartup();
  };

  useEffect(() => {
    checkStartup();
  }, []);

  const contextValue: StartupState = {
    initialized,
    loading,
    error,
    retry,
  };

  // Show loading screen during startup validation
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#1890ff', marginBottom: '8px' }}>正在启动应用程序</h2>
          <p style={{ color: '#666', margin: 0 }}>正在验证环境配置和服务连接...</p>
        </div>
      </div>
    );
  }

  // Show error screen if startup validation failed
  if (error && !initialized) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <Alert
            message="应用程序启动失败"
            description={
              <div>
                <p style={{ marginBottom: '16px' }}>
                  应用程序在启动时遇到配置或连接问题：
                </p>
                <div style={{
                  backgroundColor: '#fff2f0',
                  border: '1px solid #ffccc7',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  color: '#a8071a'
                }}>
                  {error}
                </div>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  请检查以下配置：
                </p>
                <ul style={{ color: '#666', marginBottom: '16px' }}>
                  <li>环境变量是否正确配置</li>
                  <li>数据库服务是否正在运行并可访问</li>
                  <li>Meilisearch 服务是否正在运行并可访问</li>
                  <li>网络连接是否正常</li>
                </ul>
              </div>
            }
            type="error"
            showIcon
            action={
              <Button type="primary" onClick={retry}>
                重试启动
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // Render children if startup validation passed
  return (
    <StartupContext.Provider value={contextValue}>
      {children}
    </StartupContext.Provider>
  );
}