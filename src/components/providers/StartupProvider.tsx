'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

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
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Startup validation failed');
      }

      if (process.env.NODE_ENV === 'production') {
        window.addEventListener('error', (event) => {
          console.error('Client-side error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
          console.error('Unhandled promise rejection:', event.reason);
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
    retry
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-base font-medium">正在启动应用程序</p>
              <p className="text-sm text-muted-foreground">正在验证环境配置和服务连接...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg shadow-sm">
          <CardContent className="space-y-4 py-6">
            <Alert variant="destructive">
              <AlertTitle>应用程序启动失败</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">应用程序在启动时遇到配置或连接问题：</p>
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">请检查以下配置：</p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>环境变量是否正确配置</li>
                  <li>数据库服务是否正在运行并可访问</li>
                  <li>Meilisearch 服务是否正在运行并可访问</li>
                  <li>网络连接是否正常</li>
                </ul>
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button onClick={retry}>重试启动</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <StartupContext.Provider value={contextValue}>
      {children}
    </StartupContext.Provider>
  );
}
