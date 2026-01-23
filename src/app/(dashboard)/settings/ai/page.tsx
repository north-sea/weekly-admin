'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { callTextModel } from '@/lib/ai/client';

type AiConfigResponse = {
  provider: string;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  hasKey: boolean;
  weeklyDescPrompt: string;
  weeklyCoverPrompt: string;
};

const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';

export default function AiSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AiConfigResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [availability, setAvailability] = useState<{ status: 'idle' | 'success' | 'error'; message?: string }>({
    status: 'idle',
  });

  const hasKey = useMemo(() => Boolean(config?.hasKey), [config]);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ai/config', { method: 'GET' });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message || '获取配置失败');
        }
        if (!canceled) setConfig(json.data as AiConfigResponse);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '获取配置失败';
        if (!canceled) setError(message);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setAvailability({ status: 'idle' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      await callTextModel({
        prompt: 'Ping',
        temperature: 0,
        maxTokens: 5,
        signal: controller.signal,
      });
      setAvailability({ status: 'success', message: '成功发起测试请求，AI 服务可用' });
      toast({ title: '连接正常', description: '成功发起测试请求' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '无法调用模型，请检查服务端环境变量';
      setAvailability({ status: 'error', message });
      toast({ title: '测试失败', description: message, variant: 'destructive' });
    } finally {
      clearTimeout(timeout);
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">AI 设置</h2>
          <p className="text-sm text-muted-foreground">
            统一使用服务端环境变量配置（不在浏览器保存 API Key）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Badge variant="secondary">加载中</Badge>
          ) : (
            <Badge variant={hasKey ? 'default' : 'destructive'}>
              {hasKey ? '已配置 Key' : '缺少 Key'}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>当前配置</CardTitle>
          <CardDescription>
            通过环境变量设置：`AI_PROVIDER` / `AI_BASE_URL` / `AI_API_KEY` / `AI_TEXT_MODEL` / `AI_IMAGE_MODEL`
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : config ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Provider</p>
                <p className="font-medium">{config.provider}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Base URL</p>
                <p className="font-medium break-all">{config.baseUrl}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Text Model</p>
                <p className="font-medium">{config.textModel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Image Model</p>
                <p className="font-medium">{config.imageModel}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无配置</p>
          )}

          <div className="flex items-center gap-3">
            <Button className={focusRingClass} onClick={handleTest} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </Button>
            {availability.status !== 'idle' && (
              <span className={availability.status === 'success' ? 'text-sm text-green-700' : 'text-sm text-red-700'}>
                {availability.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>如何修改</AlertTitle>
        <AlertDescription>
          修改 `.env`（或部署环境变量）后重启服务即可生效；API Key 不再存储在浏览器本地。
        </AlertDescription>
      </Alert>
    </div>
  );
}

