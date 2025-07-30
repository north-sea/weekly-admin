import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export function useAuth(requireAuth: boolean = true) {
  const { user, token, isAuthenticated, logout, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateToken = async () => {
      if (!token || !isAuthenticated) {
        setLoading(false);
        if (requireAuth) {
          router.replace('/login');
        }
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
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, isAuthenticated, requireAuth, router, logout, setUser]);

  return {
    user,
    isAuthenticated,
    loading,
  };
}