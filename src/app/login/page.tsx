'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Lock, LogIn, ShieldCheck, UserRound } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/stores/auth';

const loginSchema = z.object({
  username: z.string().min(2, { message: '用户名至少 2 个字符' }).max(50),
  password: z.string().min(6, { message: '密码至少 6 个字符' }).max(100),
  remember: z.boolean(),
});

interface LoginFeedback {
  type: 'success' | 'error';
  message: string;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const { login, isAuthenticated, hasHydrated } = useAuthStore();
  const redirectedRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<LoginFeedback | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      remember: false,
    },
  });

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated && !redirectedRef.current) {
      redirectedRef.current = true;
      // 已登录用户访问登录页，直接跳转
      window.location.href = redirectUrl;
    }
  }, [hasHydrated, isAuthenticated, redirectUrl]);

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setFeedback({ type: 'success', message: '登录成功，正在跳转...' });

        // 设置 cookie
        try {
          const isHttps =
            typeof window !== 'undefined' && window.location.protocol === 'https:';
          const secureAttr = isHttps ? '; Secure' : '';
          const maxAge = Number(data.data.expiresIn) || 8 * 60 * 60;
          document.cookie = `auth-token=${data.data.token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureAttr}`;
        } catch {}

        // 更新状态
        login(data.data.user, data.data.token);

        // 标记已重定向，防止重复跳转
        redirectedRef.current = true;

        // 使用硬跳转确保 middleware 能正确处理认证状态
        // Next.js client-side router 不会重新触发 middleware
        window.location.href = redirectUrl;
      } else {
        setFeedback({ type: 'error', message: data.error || '登录失败，请检查账号或密码' });
      }
    } catch (error) {
      console.error('Login failed:', error);
      setFeedback({ type: 'error', message: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-2 bg-slate-100">
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-12 py-14 text-white shadow-inner">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Lock className="h-3.5 w-3.5" />
            Weekly CMS
          </div>
          <h1 className="text-3xl font-semibold leading-tight">欢迎回来</h1>
          <p className="max-w-xl text-sm text-white/80">
            桌面端 Slate 风格管理台，支持草稿同步、周刊发布与协同编辑，保持创作流程顺滑可靠。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-8">
          {[
            { icon: <LogIn className="h-4 w-4" />, title: '快捷登录', desc: '记住状态，减少频繁输入' },
            { icon: <ShieldCheck className="h-4 w-4" />, title: '安全托管', desc: '加密传输与会话控制' },
            { icon: <UserRound className="h-4 w-4" />, title: '角色分工', desc: '管理员 / 编辑独立权限' },
            { icon: <Loader2 className="h-4 w-4 animate-spin" />, title: '实时反馈', desc: '操作状态与错误即刻提示' },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-md border border-white/10 bg-white/5 p-4 shadow-sm"
            >
              <div className="rounded-md bg-white/10 p-2 text-white">{item.icon}</div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-white/70">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center px-12">
        <Card className="w-full max-w-lg border-slate-200 bg-white text-foreground shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
              Weekly 内容管理系统
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              登录以访问周刊、草稿、数据面板
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {feedback && (
              <div
                className={`flex items-center justify-center rounded-md border px-3 py-2 text-sm ${
                  feedback.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {feedback.message}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <Controller
                    control={control}
                    name="username"
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="username"
                        autoComplete="username"
                        className="pl-10"
                        placeholder="请输入用户名"
                      />
                    )}
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        className="pl-10"
                        placeholder="请输入密码"
                      />
                    )}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Controller
                  control={control}
                  name="remember"
                  render={({ field }) => (
                    <label className="flex items-center space-x-2 text-sm">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="remember"
                      />
                      <span>记住我</span>
                    </label>
                  )}
                />
                <button type="button" className="text-sm text-primary hover:underline">
                  忘记密码？
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    登录
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
