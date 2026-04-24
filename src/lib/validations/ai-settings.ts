import { z } from 'zod';

export const AiSettingKeySchema = z.string().trim().min(1).max(100);

export const AiSettingUpdateSchema = z.object({
  value: z.unknown(),
});

export type AiSettingUpdateInput = z.infer<typeof AiSettingUpdateSchema>;
