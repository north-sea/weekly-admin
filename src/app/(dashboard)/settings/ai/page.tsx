'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useAiConfigStore } from '@/stores/aiConfig';
import { callTextModel } from '@/lib/ai/client';
import { KeyRound, Lock, ShieldCheck, Trash2, Unlock, Wand2 } from 'lucide-react';

const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';

const providerOptions = [
  { value: 'openai', label: 'OpenAI / 兼容 API' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'deepseek', label: 'DeepSeek' },
];

export default function AiSettingsPage() {
  const { toast } = useToast();
  const { status, meta, config, loading, error, init, unlock, save, clear } = useAiConfigStore();

  const [provider, setProvider] = useState('openai');
  const [textModel, setTextModel] = useState('gpt-4o-mini');
  const [imageModel, setImageModel] = useState('gpt-image-1');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com');
  const [apiKey, setApiKey] = useState('');
  const [weeklyDescPrompt, setWeeklyDescPrompt] = useState(
    '你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。标题：{{title}}；时间：{{date_range}}；收录：{{contents_summary}}'
  );
  const [weeklyCoverPrompt, setWeeklyCoverPrompt] = useState(
    'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.'
  );
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [availability, setAvailability] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const hasStored = useMemo(() => status !== 'empty' && Boolean(meta), [status, meta]);
  const isUnlocked = status === 'unlocked';

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (config || meta) {
      setProvider(config?.provider || meta?.provider || 'openai');
      setTextModel(config?.textModel || meta?.textModel || 'gpt-4o-mini');
      setImageModel(config?.imageModel || meta?.imageModel || 'gpt-image-1');
      setBaseUrl(config?.baseUrl || meta?.baseUrl || 'https://api.openai.com');
      setApiKey('');
      setWeeklyDescPrompt(
        config?.weeklyDescPrompt ||
        '你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。标题：{{title}}；时间：{{date_range}}；收录：{{contents_summary}}'
      );
      setWeeklyCoverPrompt(
        config?.weeklyCoverPrompt ||
        'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.'
      );
    }
  }, [config, meta]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      toast({ title: '请输入解锁密码', variant: 'destructive' });
      return;
    }
    try {
      await unlock(password.trim());
      toast({ title: '解锁成功', description: '已加载本地 AI 配置' });
      setPassword('');
      setApiKey('');
    } catch (err: any) {
      toast({ title: '解锁失败', description: err.message || '请检查密码', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    const trimmedPassword = password.trim();
    const keyToUse = apiKey.trim() || config?.apiKey;

    if (!trimmedPassword) {
      toast({ title: '请输入解锁密码', description: '用于加密保存本地配置', variant: 'destructive' });
      return;
    }

    if (!keyToUse) {
      toast({
        title: '缺少 API Key',
        description: '请先解锁或输入新的 API Key 再保存',
        variant: 'destructive',
      });
      return;
    }

    if (!baseUrl.trim()) {
      toast({ title: '缺少 Base URL', variant: 'destructive' });
      return;
    }

    try {
      await save(trimmedPassword, {
        provider: provider.trim(),
        textModel: textModel.trim(),
        imageModel: imageModel.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: keyToUse.trim(),
        weeklyDescPrompt: weeklyDescPrompt.trim(),
        weeklyCoverPrompt: weeklyCoverPrompt.trim(),
      });
      toast({ title: '保存成功', description: '已更新本地 AI 配置' });
      setPassword('');
      setApiKey('');
    } catch (err: any) {
      toast({ title: '保存失败', description: err.message || '请稍后重试', variant: 'destructive' });
    }
  };

  const handleClear = () => {
    clear();
    setApiKey('');
    setPassword('');
    toast({ title: '已清除本地 AI 配置' });
  };

  const handleTest = async () => {
    const keyToUse = apiKey.trim() || config?.apiKey;
    if (!keyToUse) {
      toast({
        title: '缺少 API Key',
        description: '请解锁配置或输入新的 Key 后再测试',
        variant: 'destructive',
      });
      return;
    }
    if (!baseUrl.trim()) {
      toast({ title: '缺少 Base URL', variant: 'destructive' });
      return;
    }

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
        configOverride: {
          provider,
          textModel,
          imageModel,
          baseUrl,
          apiKey: keyToUse,
        },
      });
      setAvailability({ status: 'success', message: '成功发起测试请求，AI 服务可用' });
      toast({ title: '连接正常', description: '成功发起测试请求' });
    } catch (err: any) {
      setAvailability({
        status: 'error',
        message: err.message || '无法调用模型，请检查配置或浏览器 CORS',
      });
      toast({
        title: '测试失败',
        description: err.message || '无法调用模型，请检查配置或浏览器 CORS',
        variant: 'destructive',
      });
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
            配置文本/图片模型、Base URL 与 API Key，保存在本地浏览器，不经后端
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasStored && (
            <Badge variant={isUnlocked ? 'default' : 'secondary'}>
              {isUnlocked ? '已解锁' : '已加密保存'}
            </Badge>
          )}
          {meta?.id && <Badge variant="outline">配置版本 {meta.id}</Badge>}
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
          <CardTitle>全局配置</CardTitle>
          <CardDescription>
            保存于本地加密存储，需要解锁密码才能解密。换浏览器或清空缓存后需要重新配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>提供商</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className={focusRingClass}>
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com"
                className={focusRingClass}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>文本模型</Label>
              <Input
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
                placeholder="gpt-4o-mini"
                className={focusRingClass}
              />
            </div>
            <div className="space-y-2">
              <Label>图片模型</Label>
              <Input
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                placeholder="gpt-image-1"
                className={focusRingClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>周刊简介 Prompt（本地保存，不共享）</Label>
            <Input
              value={weeklyDescPrompt}
              onChange={(e) => setWeeklyDescPrompt(e.target.value)}
              className={focusRingClass}
              placeholder="支持变量：{{title}}、{{date_range}}、{{contents_summary}}"
            />
          </div>

          <div className="space-y-2">
            <Label>周刊封面 Prompt（本地保存，不共享）</Label>
            <Input
              value={weeklyCoverPrompt}
              onChange={(e) => setWeeklyCoverPrompt(e.target.value)}
              className={focusRingClass}
              placeholder="支持变量：{{title}}、{{contents_summary}}"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isUnlocked ? '不填则沿用已解锁的 Key' : '请输入 API Key'}
                className={focusRingClass}
              />
              {meta?.hasKey && !isUnlocked && (
                <p className="text-xs text-muted-foreground">当前有已保存的 Key，需要解锁或输入新 Key。</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>解锁密码</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="用于本地加密/解锁"
                className={focusRingClass}
              />
              <p className="text-xs text-muted-foreground">
                不会上传到服务器。忘记密码需清除配置后重新输入 Key。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={loading}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {loading ? '保存中...' : '保存配置'}
            </Button>
            <Button variant="outline" onClick={handleUnlock} disabled={loading || isUnlocked}>
              {isUnlocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {isUnlocked ? '已解锁' : '解锁'}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || loading}>
              <Wand2 className="mr-2 h-4 w-4" />
              {testing ? '测试中...' : '一键检测可用性'}
            </Button>
            <Button variant="ghost" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              清除配置
            </Button>
          </div>

          {availability.status !== 'idle' && (
            <Alert variant={availability.status === 'success' ? 'default' : 'destructive'}>
              <AlertTitle>可用性检测{availability.status === 'success' ? '通过' : '失败'}</AlertTitle>
              <AlertDescription>
                {availability.message || '请检查配置后重试'}
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-muted/60">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>安全提示</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>配置仅保存在当前浏览器本地，加密依赖你设置的解锁密码。</p>
              <p>换设备/清缓存需要重新输入；前端调用第三方 API 可能受 CORS 限制。</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
