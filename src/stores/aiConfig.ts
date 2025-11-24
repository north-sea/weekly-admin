'use client';

import { create } from 'zustand';
import {
  AiConfigEnvelope,
  AiConfigMeta,
  AiConfigPayload,
  clearEnvelope,
  decryptConfig,
  encryptConfig,
  readStoredEnvelope,
  writeEnvelope,
} from '@/lib/ai/crypto';

type AiConfigStatus = 'empty' | 'locked' | 'unlocked';

interface AiConfigState {
  status: AiConfigStatus;
  loading: boolean;
  error?: string;
  meta?: AiConfigMeta;
  config?: AiConfigPayload;
  init: () => void;
  unlock: (password: string) => Promise<AiConfigPayload>;
  save: (password: string, config: AiConfigPayload) => Promise<AiConfigPayload>;
  clear: () => void;
}

const initialState = {
  status: 'empty' as AiConfigStatus,
  loading: false,
  error: undefined as string | undefined,
  meta: undefined as AiConfigMeta | undefined,
  config: undefined as AiConfigPayload | undefined,
};

export const useAiConfigStore = create<AiConfigState>((set, get) => ({
  ...initialState,
  init: () => {
    const stored = readStoredEnvelope();
    if (stored) {
      set({ status: 'locked', meta: stored.meta, error: undefined });
    } else {
      set({ status: 'empty', meta: undefined, config: undefined, error: undefined });
    }
  },
  unlock: async (password: string) => {
    const envelope = readStoredEnvelope();
    if (!envelope) {
      throw new Error('当前没有已保存的配置');
    }
    set({ loading: true, error: undefined });
    try {
      const config = await decryptConfig(password, envelope);
      set({ config, status: 'unlocked', meta: envelope.meta });
      return config;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '解锁失败，请检查密码是否正确';
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },
  save: async (password: string, config: AiConfigPayload) => {
    set({ loading: true, error: undefined });
    try {
      const envelope: AiConfigEnvelope = await encryptConfig(password, config);
      writeEnvelope(envelope);
      set({ config, meta: envelope.meta, status: 'unlocked' });
      return config;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '保存失败，请稍后重试';
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },
  clear: () => {
    clearEnvelope();
    set({ ...initialState });
  },
}));

export const getAiConfig = () => useAiConfigStore.getState().config;
