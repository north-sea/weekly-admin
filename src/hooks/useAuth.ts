import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

function clearCookie(name: string) {
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureAttr = isHttps ? '; Secure' : '';
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
  } catch {}
}

export function useAuth(requireAuth: boolean = true) {
  const { user, token, isAuthenticated, logout, setToken, setUser, hasHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateToken = async () => {
      // 等待 store hydration 完成
      if (!hasHydrated) {
        return;
      }

      let activeToken = token;
      if ((!activeToken || !isAuthenticated) && typeof window !== 'undefined') {
        const cookieToken = readCookie('auth-token');
        if (cookieToken) {
          setToken(cookieToken);
          activeToken = cookieToken;
        }
      }

      if (!activeToken) {
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
      if (user && activeToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${activeToken}`,
          },
          credentials: 'same-origin',
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
        clearCookie('auth-token');
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
  }, [hasHydrated, token, isAuthenticated, user, requireAuth, logout, router, setToken, setUser]);

  return {
    user,
    isAuthenticated,
    loading,
  };
}
