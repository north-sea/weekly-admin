'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Lock, LogIn, UserRound } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/stores/auth';

const loginSchema = z.object({
  username: z.string().min(2, { message: '用户名至少 2 个字符' }).max(50),
  password: z.string().min(6, { message: '密码至少 6 个字符' }).max(100),
  remember: z.boolean().default(false),
});

interface LoginFeedback {
  type: 'success' | 'error';
  message: string;
}

export default function LoginPage() {
  const router = useRouter();
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
      const timer = setTimeout(() => {
        try {
          router.replace(redirectUrl);
        } catch {
          window.location.href = redirectUrl;
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [hasHydrated, isAuthenticated, redirectUrl, router]);

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
        try {
          const isHttps =
            typeof window !== 'undefined' && window.location.protocol === 'https:';
          const secureAttr = isHttps ? '; Secure' : '';
          const maxAge = Number(data.data.expiresIn) || 8 * 60 * 60;
          document.cookie = `auth-token=${data.data.token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureAttr}`;
        } catch {}

        login(data.data.user, data.data.token);
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          setTimeout(() => {
            try {
              router.replace(redirectUrl);
            } catch {
              window.location.href = redirectUrl;
            }
          }, 240);
        }
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
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#667eea] via-[#6f60d8] to-[#764ba2] px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15)_0%,_rgba(118,75,162,0.2)_45%,_rgba(102,126,234,0.15)_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Card className="border-none bg-card/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight text-primary">
              Weekly 内容管理系统
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              欢迎回来，请登录以继续
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
                    <label className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        id="remember"
                      />
                      <span>记住我</span>
                    </label>
                  )}
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="h-4 w-4" />
                    登录
                  </span>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              测试账号：admin / admin123 或 editor / editor123
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
