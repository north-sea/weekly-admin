'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAiSettings, useUpdateAiSetting } from '@/hooks/queries/useAiSettingsQueries';
import { Plus, Pencil, Trash2, PlugZap, Star, RotateCcw, Save } from 'lucide-react';

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

type AiConfig = {
  id: number;
  name: string;
  provider: 'openai' | 'anthropic';
  base_url: string;
  text_model: string;
  image_model: string | null;
  is_default: boolean;
  enabled: boolean;
  api_key_masked: string;
  created_at?: string;
  updated_at?: string;
};

type AiPromptScene =
  | 'content_score'
  | 'summary_generate'
  | 'summary_optimize'
  | 'summary_score'
  | 'weekly_organize'
  | 'weekly_desc'
  | 'weekly_cover';

type AiPrompt = {
  scene: AiPromptScene;
  name: string;
  prompt: string;
  variables: string[];
  is_default: boolean;
  updated_at?: string;
};

const focusRingClass = 'focus-visible:ring-1 focus-visible:ring-offset-1 focus:ring-1 focus:ring-offset-1';
const AUTO_SCORE_SETTING_KEY = 'auto_score_on_sync';

const SCENE_LABELS: Record<AiPromptScene, string> = {
  content_score: '内容评分',
  summary_generate: '摘要生成',
  summary_optimize: '摘要优化',
  summary_score: '摘要评分',
  weekly_organize: '周刊组织',
  weekly_desc: '周刊简介',
  weekly_cover: '封面',
};

const ACTIVE_PROMPT_SCENES = Object.keys(SCENE_LABELS).filter(
  (scene): scene is AiPromptScene => scene !== 'weekly_cover'
);

export default function AiSettingsPage() {
  const { toast } = useToast();
  const aiSettingsQuery = useAiSettings();
  const updateAiSetting = useUpdateAiSetting();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [promptEdits, setPromptEdits] = useState<Partial<Record<AiPromptScene, string>>>({});
  const [activeScene, setActiveScene] = useState<AiPromptScene>('content_score');

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [pendingDeleteConfig, setPendingDeleteConfig] = useState<AiConfig | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const [configForm, setConfigForm] = useState({
    name: '',
    provider: 'openai' as AiConfig['provider'],
    base_url: 'https://api.openai.com',
    text_model: 'gpt-4o-mini',
    api_key: '',
    enabled: true,
    is_default: false,
  });

  const autoScoreSetting = useMemo(
    () => (aiSettingsQuery.data ?? []).find((item) => item.key === AUTO_SCORE_SETTING_KEY),
    [aiSettingsQuery.data]
  );
  const resolvedAutoScoreEnabled = useMemo(() => {
    const value = autoScoreSetting?.value as { enabled?: unknown } | boolean | undefined;
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object' && typeof value.enabled === 'boolean') return value.enabled;
    return true;
  }, [autoScoreSetting]);
  const [autoScoreOnSync, setAutoScoreOnSync] = useState(true);

  useEffect(() => {
    if (aiSettingsQuery.isLoading) return;
    setAutoScoreOnSync(resolvedAutoScoreEnabled);
  }, [aiSettingsQuery.isLoading, resolvedAutoScoreEnabled]);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [configsRes, promptsRes] = await Promise.all([
          fetch('/api/ai/configs', { method: 'GET' }),
          fetch('/api/ai/prompts', { method: 'GET' }),
        ]);

        const configsJson = (await configsRes.json().catch(() => ({}))) as ApiResponse<AiConfig[]>;
        const promptsJson = (await promptsRes.json().catch(() => ({}))) as ApiResponse<AiPrompt[]>;

        if (!configsRes.ok || !configsJson?.success) {
          throw new Error(configsJson?.error?.message || '获取 AI 配置失败');
        }
        if (!promptsRes.ok || !promptsJson?.success) {
          throw new Error(promptsJson?.error?.message || '获取 Prompt 失败');
        }

        if (canceled) return;
        setConfigs(configsJson.data ?? []);
        const activePrompts = (promptsJson.data ?? []).filter((prompt) => prompt.scene !== 'weekly_cover');
        setPrompts(activePrompts);
        const nextEdits: Partial<Record<AiPromptScene, string>> = {};
        activePrompts.forEach((p) => {
          nextEdits[p.scene] = p.prompt;
        });
        setPromptEdits(nextEdits);
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

  const handleAutoScoreToggle = async (checked: boolean) => {
    const previous = autoScoreOnSync;
    setAutoScoreOnSync(checked);
    try {
      await updateAiSetting.mutateAsync({
        key: AUTO_SCORE_SETTING_KEY,
        value: { enabled: checked },
      });
      toast({
        title: '已保存',
        description: checked ? '新同步的条目将自动评分' : '已关闭同步自动评分',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败';
      setAutoScoreOnSync(previous);
      toast({ title: '保存失败', description: message, variant: 'destructive' });
    }
  };

  const defaultConfig = useMemo(() => configs.find((c) => c.is_default), [configs]);

  const refreshConfigs = async () => {
    const res = await fetch('/api/ai/configs', { method: 'GET' });
    const json = (await res.json().catch(() => ({}))) as ApiResponse<AiConfig[]>;
    if (!res.ok || !json?.success) throw new Error(json?.error?.message || '刷新 AI 配置失败');
    setConfigs(json.data ?? []);
  };

  const refreshPrompts = async () => {
    const res = await fetch('/api/ai/prompts', { method: 'GET' });
    const json = (await res.json().catch(() => ({}))) as ApiResponse<AiPrompt[]>;
    if (!res.ok || !json?.success) throw new Error(json?.error?.message || '刷新 Prompt 失败');
    const activePrompts = (json.data ?? []).filter((prompt) => prompt.scene !== 'weekly_cover');
    setPrompts(activePrompts);
    const nextEdits: Partial<Record<AiPromptScene, string>> = {};
    activePrompts.forEach((p) => {
      nextEdits[p.scene] = p.prompt;
    });
    setPromptEdits(nextEdits);
  };

  const openCreateDialog = () => {
    setEditingConfig(null);
    setConfigForm({
      name: '',
      provider: 'openai',
      base_url: 'https://api.openai.com',
      text_model: 'gpt-4o-mini',
      api_key: '',
      enabled: true,
      is_default: configs.length === 0,
    });
    setConfigDialogOpen(true);
  };

  const openEditDialog = (config: AiConfig) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      provider: config.provider,
      base_url: config.base_url,
      text_model: config.text_model,
      api_key: '',
      enabled: config.enabled,
      is_default: config.is_default,
    });
    setConfigDialogOpen(true);
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const isEdit = Boolean(editingConfig);
      const body: any = {
        name: configForm.name,
        provider: configForm.provider,
        base_url: configForm.base_url,
        text_model: configForm.text_model,
        enabled: configForm.enabled,
      };

      if (!isEdit) {
        body.api_key = configForm.api_key;
        body.is_default = configForm.is_default;
      } else if (configForm.api_key.trim()) {
        body.api_key = configForm.api_key;
      }

      const res = await fetch(
        isEdit ? `/api/ai/configs/${editingConfig!.id}` : '/api/ai/configs',
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const json = (await res.json().catch(() => ({}))) as ApiResponse<AiConfig>;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || (isEdit ? '更新配置失败' : '创建配置失败'));
      }

      toast({ title: isEdit ? '已更新' : '已创建', description: 'AI 配置已保存提醒生效' });
      setConfigDialogOpen(false);
      setEditingConfig(null);
      await refreshConfigs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败';
      toast({ title: '保存失败', description: message, variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const setDefault = async (config: AiConfig) => {
    setActionBusyId(config.id);
    try {
      const res = await fetch(`/api/ai/configs/${config.id}/default`, { method: 'PUT' });
      const json = (await res.json().catch(() => ({}))) as ApiResponse<AiConfig>;
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || '设置默认配置失败');
      toast({ title: '已设为默认', description: `${config.name}` });
      await refreshConfigs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败';
      toast({ title: '操作失败', description: message, variant: 'destructive' });
    } finally {
      setActionBusyId(null);
    }
  };

  const testConfig = async (config: AiConfig) => {
    setActionBusyId(config.id);
    try {
      const res = await fetch(`/api/ai/configs/${config.id}/test`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as ApiResponse<{ ok: boolean; latency_ms?: number }>;
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || '测试失败');
      toast({
        title: '连接正常',
        description: typeof json.data?.latency_ms === 'number' ? `延迟 ${json.data.latency_ms}ms` : '测试请求成功',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '测试失败';
      toast({ title: '测试失败', description: message, variant: 'destructive' });
    } finally {
      setActionBusyId(null);
    }
  };

  const savePrompt = async (scene: AiPromptScene) => {
    try {
      const prompt = (promptEdits[scene] ?? '').trim();
      const res = await fetch(`/api/ai/prompts/${scene}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse<AiPrompt>;
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || '保存 Prompt 失败');
      toast({ title: '已保存', description: `${SCENE_LABELS[scene]} Prompt` });
      await refreshPrompts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存 Prompt 失败';
      toast({ title: '保存失败', description: message, variant: 'destructive' });
    }
  };

  const resetPrompt = async (scene: AiPromptScene) => {
    try {
      const res = await fetch(`/api/ai/prompts/${scene}/reset`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as ApiResponse<AiPrompt>;
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || '重置 Prompt 失败');
      toast({ title: '已重置', description: `${SCENE_LABELS[scene]} Prompt` });
      await refreshPrompts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '重置 Prompt 失败';
      toast({ title: '重置失败', description: message, variant: 'destructive' });
    }
  };

  const activePrompt = useMemo(() => prompts.find((p) => p.scene === activeScene), [prompts, activeScene]);
  const activePromptValue = promptEdits[activeScene] ?? '';
  const activePromptDirty = activePrompt ? activePromptValue.trim() !== activePrompt.prompt.trim() : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">AI 设置</h2>
          <p className="text-sm text-muted-foreground">
            支持多组 API 配置切换与场景 Prompt 模板管理（API Key 加密存储）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Badge variant="secondary">加载中</Badge>
          ) : (
            <Badge variant={defaultConfig ? 'default' : 'destructive'}>
              {defaultConfig ? `默认：${defaultConfig.name}` : '未设置默认配置'}
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
          <CardTitle>自动化设置</CardTitle>
          <CardDescription>控制同步后自动评分的全局开关，可被数据源级别覆盖</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiSettingsQuery.error && (
            <Alert variant="destructive">
              <AlertTitle>获取失败</AlertTitle>
              <AlertDescription>
                {aiSettingsQuery.error instanceof Error ? aiSettingsQuery.error.message : '获取自动化设置失败'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">同步后自动评分</p>
              <p className="text-xs text-muted-foreground">
                启用后，新同步的收件箱条目会自动执行 AI 评分；数据源可设置覆盖。
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updateAiSetting.isPending && <Badge variant="secondary">保存中</Badge>}
              <Switch
                checked={autoScoreOnSync}
                onCheckedChange={handleAutoScoreToggle}
                disabled={aiSettingsQuery.isLoading || updateAiSetting.isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>API 配置</CardTitle>
              <CardDescription>管理可用的 AI Provider / Base URL / Model，并选择默认配置</CardDescription>
            </div>
            <Button className={focusRingClass} onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新增配置
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : configs.length === 0 ? (
            <Alert>
              <AlertTitle>暂无配置</AlertTitle>
              <AlertDescription>请先新增一组 API 配置，并设置默认配置。</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {configs.map((config) => {
                const isBusy = actionBusyId === config.id;
                return (
                  <Card key={config.id} className={cn('shadow-sm', !config.enabled && 'opacity-70')}>
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{config.name}</CardTitle>
                            {config.is_default && <Badge variant="default">默认</Badge>}
                            {!config.enabled && <Badge variant="secondary">已禁用</Badge>}
                          </div>
                          <CardDescription className="break-all">
                            {config.provider} · {config.base_url}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {!config.is_default && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={focusRingClass}
                              disabled={isBusy}
                              onClick={() => setDefault(config)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              设为默认
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Text Model</p>
                          <p className="font-medium break-all">{config.text_model}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">API Key</p>
                          <p className="font-medium">{config.api_key_masked || '****'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={focusRingClass}
                          disabled={isBusy}
                          onClick={() => testConfig(config)}
                        >
                          <PlugZap className="mr-2 h-4 w-4" />
                          测试
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={focusRingClass}
                          disabled={isBusy}
                          onClick={() => openEditDialog(config)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className={focusRingClass}
                          disabled={isBusy}
                          onClick={() => setPendingDeleteConfig(config)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt 模板</CardTitle>
          <CardDescription>为不同 AI 场景配置独立 Prompt，可随时重置为默认</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <Tabs value={activeScene} onValueChange={(v) => setActiveScene(v as AiPromptScene)}>
              <TabsList className="flex flex-wrap justify-start gap-1">
                {ACTIVE_PROMPT_SCENES.map((scene) => (
                  <TabsTrigger key={scene} value={scene} className="text-xs">
                    {SCENE_LABELS[scene]}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeScene} className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{activePrompt?.name ?? SCENE_LABELS[activeScene]}</p>
                      {activePrompt?.is_default ? (
                        <Badge variant="secondary">默认</Badge>
                      ) : (
                        <Badge variant="outline">已自定义</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      可用变量：{(activePrompt?.variables ?? []).map((v) => `{{${v}}}`).join(' / ') || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={focusRingClass}
                      onClick={() => resetPrompt(activeScene)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重置为默认
                    </Button>
                    <Button
                      size="sm"
                      className={focusRingClass}
                      disabled={!activePromptDirty}
                      onClick={() => savePrompt(activeScene)}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      保存
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={activePromptValue}
                  onChange={(e) => setPromptEdits((prev) => ({ ...prev, [activeScene]: e.target.value }))}
                  rows={14}
                  className="font-mono text-xs leading-5"
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>安全提示</AlertTitle>
        <AlertDescription>
          API Key 会加密存储在数据库中；页面仅展示脱敏结果（不会返回明文）。请确保已配置环境变量 `AI_ENCRYPTION_KEY`。
        </AlertDescription>
      </Alert>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑配置' : '新增配置'}</DialogTitle>
            <DialogDescription>
              {editingConfig ? 'API Key 不会回显，留空则保留原值。' : '创建后可在卡片上测试并设为默认。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-config-name">名称</Label>
              <Input
                id="ai-config-name"
                value={configForm.name}
                onChange={(e) => setConfigForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例如：OpenAI 主力 / Claude 备用"
              />
            </div>

            <div className="grid gap-2">
              <Label>Provider</Label>
              <Select
                value={configForm.provider}
                onValueChange={(v) => setConfigForm((p) => ({ ...p, provider: v as AiConfig['provider'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">openai</SelectItem>
                  <SelectItem value="anthropic">anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-config-base-url">Base URL</Label>
              <Input
                id="ai-config-base-url"
                value={configForm.base_url}
                onChange={(e) => setConfigForm((p) => ({ ...p, base_url: e.target.value }))}
                placeholder="https://api.openai.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-config-text-model">Text Model</Label>
              <Input
                id="ai-config-text-model"
                value={configForm.text_model}
                onChange={(e) => setConfigForm((p) => ({ ...p, text_model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-config-api-key">{editingConfig ? '新 API Key（可选）' : 'API Key'}</Label>
              <Input
                id="ai-config-api-key"
                value={configForm.api_key}
                onChange={(e) => setConfigForm((p) => ({ ...p, api_key: e.target.value }))}
                placeholder={editingConfig ? '留空则不修改' : '请输入 Key'}
                type="password"
                autoComplete="off"
              />
              {editingConfig?.api_key_masked ? (
                <p className="text-xs text-muted-foreground">当前 Key：{editingConfig.api_key_masked}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded border border-border px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">启用</p>
                <p className="text-xs text-muted-foreground">禁用后不会作为默认配置被使用</p>
              </div>
              <Switch
                checked={configForm.enabled}
                onCheckedChange={(checked) => setConfigForm((p) => ({ ...p, enabled: checked }))}
              />
            </div>

            {!editingConfig ? (
              <div className="flex items-center justify-between rounded border border-border px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">设为默认</p>
                  <p className="text-xs text-muted-foreground">新配置创建后自动切换为默认</p>
                </div>
                <Switch
                  checked={configForm.is_default}
                  onCheckedChange={(checked) => setConfigForm((p) => ({ ...p, is_default: checked }))}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className={focusRingClass}
              onClick={() => setConfigDialogOpen(false)}
              disabled={savingConfig}
            >
              取消
            </Button>
            <Button className={focusRingClass} onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteConfig)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteConfig(null);
        }}
        title="确认删除配置？"
        description={pendingDeleteConfig ? `将删除：${pendingDeleteConfig.name}` : ''}
        confirmText="删除"
        cancelText="取消"
        onConfirm={async () => {
          if (!pendingDeleteConfig) return;
          const target = pendingDeleteConfig;
          setPendingDeleteConfig(null);
          setActionBusyId(target.id);
          try {
            const res = await fetch(`/api/ai/configs/${target.id}`, { method: 'DELETE' });
            const json = (await res.json().catch(() => ({}))) as ApiResponse<{ ok: boolean }>;
            if (!res.ok || !json?.success) throw new Error(json?.error?.message || '删除失败');
            toast({ title: '已删除', description: target.name });
            await refreshConfigs();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '删除失败';
            toast({ title: '删除失败', description: message, variant: 'destructive' });
          } finally {
            setActionBusyId(null);
          }
        }}
      />
    </div>
  );
}
