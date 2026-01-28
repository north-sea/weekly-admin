import 'server-only';

import { prisma } from '@/lib/db';
import { decrypt, encrypt, maskApiKey } from '@/lib/crypto';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export type AiProvider = 'openai' | 'anthropic';

export type AiConfigSafe = {
  id: number;
  name: string;
  provider: AiProvider;
  base_url: string;
  text_model: string;
  image_model: string | null;
  is_default: boolean;
  enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
  api_key_masked: string;
  has_key: boolean;
};

export type AiConfigResolved = {
  id: number;
  name: string;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  textModel: string;
  imageModel?: string | null;
  enabled: boolean;
  isDefault: boolean;
};

type AiConfigCreateInput = {
  name: string;
  provider: AiProvider;
  base_url: string;
  api_key: string;
  text_model: string;
  image_model?: string | null;
  enabled?: boolean;
  is_default?: boolean;
};

type AiConfigUpdateInput = Partial<Omit<AiConfigCreateInput, 'api_key'>> & {
  api_key?: string;
};

const toSafeConfig = (config: any): AiConfigSafe => {
  let masked = '****';
  try {
    masked = maskApiKey(decrypt(config.api_key_encrypted));
  } catch {
    masked = '****';
  }

  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    base_url: config.base_url,
    text_model: config.text_model,
    image_model: config.image_model ?? null,
    is_default: Boolean(config.is_default),
    enabled: Boolean(config.enabled),
    created_at: config.created_at ?? undefined,
    updated_at: config.updated_at ?? undefined,
    api_key_masked: masked,
    has_key: Boolean(config.api_key_encrypted),
  };
};

export class AiConfigService {
  static async list(): Promise<AiConfigSafe[]> {
    const configs = await prisma.ai_configs.findMany({
      orderBy: [{ is_default: 'desc' }, { enabled: 'desc' }, { id: 'asc' }],
    });
    return configs.map((config) => toSafeConfig(config));
  }

  static async getById(id: number): Promise<AiConfigSafe | null> {
    const config = await prisma.ai_configs.findUnique({ where: { id } });
    return config ? toSafeConfig(config) : null;
  }

  static async getResolvedById(id: number): Promise<AiConfigResolved | null> {
    const config = await prisma.ai_configs.findUnique({ where: { id } });
    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      baseUrl: config.base_url,
      apiKey: decrypt(config.api_key_encrypted),
      textModel: config.text_model,
      imageModel: config.image_model ?? null,
      enabled: Boolean(config.enabled),
      isDefault: Boolean(config.is_default),
    };
  }

  static async getResolvedDefault(): Promise<AiConfigResolved | null> {
    const config = await prisma.ai_configs.findFirst({
      where: { is_default: true },
      orderBy: [{ id: 'asc' }],
    });
    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      baseUrl: config.base_url,
      apiKey: decrypt(config.api_key_encrypted),
      textModel: config.text_model,
      imageModel: config.image_model ?? null,
      enabled: Boolean(config.enabled),
      isDefault: Boolean(config.is_default),
    };
  }

  static async create(input: AiConfigCreateInput): Promise<AiConfigSafe> {
    const apiKey = input.api_key.trim();
    if (!apiKey) {
      throw new Error('API Key 不能为空');
    }

    const baseUrl = normalizeBaseUrl(input.base_url.trim());
    const provider = input.provider;
    const textModel = input.text_model.trim();
    const imageModel = input.image_model?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      const hasDefault = await tx.ai_configs.findFirst({ where: { is_default: true } });
      const shouldBeDefault = Boolean(input.is_default) || !hasDefault;

      if (shouldBeDefault) {
        await tx.ai_configs.updateMany({ data: { is_default: false } });
      }

      const created = await tx.ai_configs.create({
        data: {
          name: input.name.trim(),
          provider,
          base_url: baseUrl,
          api_key_encrypted: encrypt(apiKey),
          text_model: textModel,
          image_model: imageModel,
          enabled: input.enabled ?? true,
          is_default: shouldBeDefault,
        },
      });

      return toSafeConfig(created);
    });
  }

  static async update(id: number, input: AiConfigUpdateInput): Promise<AiConfigSafe> {
    const existing = await prisma.ai_configs.findUnique({ where: { id } });
    if (!existing) throw new Error('配置不存在');

    const apiKey = typeof input.api_key === 'string' ? input.api_key.trim() : undefined;

    const data: Record<string, unknown> = {};
    if (typeof input.name === 'string') data.name = input.name.trim();
    if (typeof input.provider === 'string') data.provider = input.provider;
    if (typeof input.base_url === 'string') data.base_url = normalizeBaseUrl(input.base_url.trim());
    if (typeof input.text_model === 'string') data.text_model = input.text_model.trim();
    if (input.image_model !== undefined) data.image_model = input.image_model?.trim() || null;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (apiKey) data.api_key_encrypted = encrypt(apiKey);

    return await prisma.$transaction(async (tx) => {
      if (input.is_default) {
        await tx.ai_configs.updateMany({ data: { is_default: false } });
        data.is_default = true;
      }

      const updated = await tx.ai_configs.update({
        where: { id },
        data,
      });

      return toSafeConfig(updated);
    });
  }

  static async setDefault(id: number): Promise<AiConfigSafe> {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.ai_configs.findUnique({ where: { id } });
      if (!existing) throw new Error('配置不存在');

      await tx.ai_configs.updateMany({ data: { is_default: false } });
      const updated = await tx.ai_configs.update({ where: { id }, data: { is_default: true } });
      return toSafeConfig(updated);
    });
  }

  static async remove(id: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.ai_configs.findUnique({ where: { id } });
      if (!existing) return;

      const wasDefault = Boolean(existing.is_default);
      await tx.ai_configs.delete({ where: { id } });

      if (!wasDefault) return;

      const next = await tx.ai_configs.findFirst({
        where: { enabled: true },
        orderBy: [{ id: 'asc' }],
      });
      if (next) {
        await tx.ai_configs.update({ where: { id: next.id }, data: { is_default: true } });
      }
    });
  }
}

