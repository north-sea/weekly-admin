import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export function useAuth(requireAuth: boolean = true) {
  const { user, token, isAuthenticated, logout, setUser, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateToken = async () => {
      // 等待 store hydration 完成
      if (!hasHydrated) {
        return;
      }

      if (!token || !isAuthenticated) {
        setLoading(false);
        if (requireAuth) {
          // 添加延迟确保路由准备就绪
          setTimeout(() => {
            try {
              router.replace('/login');
            } catch (error) {
              console.warn('router.replace 失败，使用 window.location:', error);
              window.location.href = '/login';
            }
          }, 100);
        }
        return;
      }

      // 如果已经有用户信息且token有效，跳过验证
      if (user && token && isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setUser(data.data.user);
          } else {
            throw new Error('Invalid response');
          }
        } else {
          throw new Error('Token validation failed');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        logout();
        if (requireAuth) {
          setTimeout(() => {
            try {
              router.replace('/login');
            } catch (error) {
              console.warn('router.replace 失败，使用 window.location:', error);
              window.location.href = '/login';
            }
          }, 100);
        }
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [hasHydrated, token, isAuthenticated, user, requireAuth]);

  return {
    user,
    isAuthenticated,
    loading,
  };
}