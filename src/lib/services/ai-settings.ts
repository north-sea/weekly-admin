import 'server-only';

import { prisma } from '@/lib/db';

export const AUTO_SCORE_SETTING_KEY = 'auto_score_on_sync';

export type AutoScoreSettingValue = {
  enabled: boolean;
};

export type AiSettingValue = unknown;

export type AiSettingRecord = {
  key: string;
  value: AiSettingValue;
  updated_at?: Date;
};

const DEFAULT_AI_SETTINGS: Record<string, AiSettingValue> = {
  [AUTO_SCORE_SETTING_KEY]: { enabled: true },
};

const normalizeAutoScoreSetting = (value: unknown): AutoScoreSettingValue => {
  if (typeof value === 'boolean') {
    return { enabled: value };
  }

  if (value && typeof value === 'object') {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === 'boolean') {
      return { enabled };
    }
  }

  throw new Error('auto_score_on_sync 需要 { enabled: boolean }');
};

const normalizeSettingValue = (key: string, value: unknown): AiSettingValue => {
  if (key === AUTO_SCORE_SETTING_KEY) {
    return normalizeAutoScoreSetting(value);
  }

  return value;
};

const safeNormalizeSettingValue = (key: string, value: unknown): AiSettingValue => {
  try {
    return normalizeSettingValue(key, value);
  } catch {
    return DEFAULT_AI_SETTINGS[key] ?? value;
  }
};

const toRecord = (record: { key: string; value: unknown; updated_at?: Date | null }): AiSettingRecord => ({
  key: record.key,
  value: safeNormalizeSettingValue(record.key, record.value),
  updated_at: record.updated_at ?? undefined,
});

export class AiSettingsService {
  static getDefaults(): Record<string, AiSettingValue> {
    return { ...DEFAULT_AI_SETTINGS };
  }

  static async list(): Promise<AiSettingRecord[]> {
    let records: Array<{ key: string; value: unknown; updated_at?: Date | null }> = [];
    try {
      records = await prisma.ai_settings.findMany();
    } catch {
      records = [];
    }

    const byKey = new Map(records.map((item) => [item.key, item]));
    const result: AiSettingRecord[] = [];

    for (const [key, value] of Object.entries(DEFAULT_AI_SETTINGS)) {
      const stored = byKey.get(key);
      if (stored) {
        result.push(toRecord(stored));
      } else {
        result.push({ key, value, updated_at: undefined });
      }
    }

    records.forEach((record) => {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_AI_SETTINGS, record.key)) {
        result.push(toRecord(record));
      }
    });

    return result;
  }

  static async get(key: string): Promise<AiSettingRecord | null> {
    const record = await prisma.ai_settings.findUnique({ where: { key } });
    if (!record) {
      const fallback = DEFAULT_AI_SETTINGS[key];
      if (fallback === undefined) return null;
      return { key, value: fallback, updated_at: undefined };
    }

    return toRecord(record);
  }

  static async upsert(key: string, value: unknown): Promise<AiSettingRecord> {
    const normalized = normalizeSettingValue(key, value);

    const record = await prisma.ai_settings.upsert({
      where: { key },
      create: {
        key,
        value: normalized as any,
      },
      update: {
        value: normalized as any,
        updated_at: new Date(),
      },
    });

    return toRecord(record);
  }
}
