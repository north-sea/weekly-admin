'use client';

export interface AiConfigPayload {
  provider: string;
  textModel: string;
  imageModel: string;
  baseUrl: string;
  apiKey: string;
  weeklyDescPrompt?: string;
  weeklyCoverPrompt?: string;
}

export interface AiConfigMeta {
  provider: string;
  textModel: string;
  imageModel: string;
  baseUrl: string;
  hasKey: boolean;
  id: string;
}

export interface AiConfigEnvelope {
  cipher: string;
  iv: string;
  salt: string;
  meta: AiConfigMeta;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToBuffer = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const deriveKey = async (password: string, salt: Uint8Array) => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export async function encryptConfig(password: string, config: AiConfigPayload): Promise<AiConfigEnvelope> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前浏览器不支持 WebCrypto，无法加密配置');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const payload = {
    ...config,
    baseUrl: normalizeBaseUrl(config.baseUrl),
  };
  const encoded = encoder.encode(JSON.stringify(payload));
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    cipher: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    meta: {
      provider: payload.provider,
      textModel: payload.textModel,
      imageModel: payload.imageModel,
      baseUrl: payload.baseUrl,
      hasKey: Boolean(payload.apiKey),
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 8)
          : Date.now().toString(36),
    },
  };
}

export async function decryptConfig(password: string, envelope: AiConfigEnvelope): Promise<AiConfigPayload> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前浏览器不支持 WebCrypto，无法解密配置');
  }

  const salt = new Uint8Array(base64ToBuffer(envelope.salt));
  const iv = new Uint8Array(base64ToBuffer(envelope.iv));
  const key = await deriveKey(password, salt);
  const cipherBuffer = base64ToBuffer(envelope.cipher);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuffer);
  const decoded = decoder.decode(plainBuffer);
  const parsed = JSON.parse(decoded) as AiConfigPayload;
  return {
    ...parsed,
    baseUrl: normalizeBaseUrl(parsed.baseUrl),
  };
}

export const STORAGE_KEY = 'weekly-ai-config-v1';

export const readStoredEnvelope = (): AiConfigEnvelope | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiConfigEnvelope;
  } catch {
    return null;
  }
};

export const writeEnvelope = (envelope: AiConfigEnvelope) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
};

export const clearEnvelope = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};
