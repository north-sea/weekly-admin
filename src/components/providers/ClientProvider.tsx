'use client';

import { useHydration } from '@/hooks/useHydration';
import { useAuthStore } from '@/stores/auth';

interface ClientProviderProps {
  children: React.ReactNode;
}

export default function ClientProvider({ children }: ClientProviderProps) {
  const isHydrated = useHydration();
  const hasStoreHydrated = useAuthStore((state) => state.hasHydrated);

  // 等待客户端 hydration 和 store hydration 都完成
  if (!isHydrated || !hasStoreHydrated) {
    return null;
  }

  return <>{children}</>;
}