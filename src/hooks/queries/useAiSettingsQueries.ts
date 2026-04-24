'use client';

import { apiClient } from '@/lib/api-client';
import { useApiMutation, useGet, useInvalidateQueries } from '@/hooks/useApi';

export type AiSetting = {
  key: string;
  value: unknown;
  updated_at?: string | null;
};

const AI_SETTINGS_QUERY_KEY = ['ai-settings'] as const;

export function useAiSettings() {
  return useGet<AiSetting[]>('/api/ai-settings', {
    queryKey: AI_SETTINGS_QUERY_KEY,
    staleTime: 30 * 1000,
  });
}

export function useUpdateAiSetting() {
  const invalidate = useInvalidateQueries();

  return useApiMutation<AiSetting, { key: string; value: unknown }>(
    ({ key, value }) => apiClient.put<AiSetting>(`/api/ai-settings/${key}`, { value }),
    {
      onSuccess: async () => {
        await invalidate.invalidate(AI_SETTINGS_QUERY_KEY);
      },
    }
  );
}
