'use client';

import { useEffect, useState } from 'react';
import { useHydration } from '@/hooks/useHydration';
import { useAuthStore } from '@/stores/auth';

interface ClientProviderProps {
  children: React.ReactNode;
}

export default function ClientProvider({ children }: ClientProviderProps) {
  const isHydrated = useHydration();
  const hasStoreHydrated = useAuthStore((state) => state.hasHydrated);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // 给一个短暂的延迟确保状态同步，但不完全阻塞渲染
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 如果 hydration 还没完成，显示一个简单的加载状态而不是完全阻塞
  if (!isHydrated || !hasStoreHydrated || !showContent) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        正在加载...
      </div>
    );
  }

  return <>{children}</>;
}