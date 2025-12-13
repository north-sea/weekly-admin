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
  // 会话期间缓存密码，避免重复输入
  _cachedPassword?: string;
  init: () => void;
  unlock: (password: string) => Promise<AiConfigPayload>;
  save: (password: string, config: AiConfigPayload) => Promise<AiConfigPayload>;
  // 使用缓存密码保存（解锁后可用）
  saveWithCachedPassword: (config: AiConfigPayload) => Promise<AiConfigPayload>;
  clear: () => void;
  // 检查是否有缓存密码
  hasCachedPassword: () => boolean;
}

const initialState = {
  status: 'empty' as AiConfigStatus,
  loading: false,
  error: undefined as string | undefined,
  meta: undefined as AiConfigMeta | undefined,
  config: undefined as AiConfigPayload | undefined,
  _cachedPassword: undefined as string | undefined,
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
      // 缓存密码，后续保存时可以直接使用
      set({ config, status: 'unlocked', meta: envelope.meta, _cachedPassword: password });
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
      // 缓存密码
      set({ config, meta: envelope.meta, status: 'unlocked', _cachedPassword: password });
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
  saveWithCachedPassword: async (config: AiConfigPayload) => {
    const { _cachedPassword } = get();
    if (!_cachedPassword) {
      throw new Error('请先解锁配置或输入密码');
    }
    return get().save(_cachedPassword, config);
  },
  hasCachedPassword: () => {
    return !!get()._cachedPassword;
  },
  clear: () => {
    clearEnvelope();
    set({ ...initialState });
  },
}));

export const getAiConfig = () => useAiConfigStore.getState().config;
