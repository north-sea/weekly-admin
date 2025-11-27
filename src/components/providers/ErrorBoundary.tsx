'use client';

import React from 'react';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
          <Card className="w-full max-w-xl shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-semibold">应用程序出现错误</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                抱歉，应用程序遇到了一个错误。请尝试刷新页面或返回首页。
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={this.handleRefresh} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> 刷新页面
                </Button>
                <Button variant="outline" onClick={this.handleHome} className="gap-2">
                  <Home className="h-4 w-4" /> 返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
