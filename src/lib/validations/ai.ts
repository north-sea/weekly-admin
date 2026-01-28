import { z } from 'zod';

export const AiProviderSchema = z.enum(['openai', 'anthropic']);

export const AiConfigCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider: AiProviderSchema,
  base_url: z.string().trim().min(1).max(500),
  api_key: z.string().trim().min(1),
  text_model: z.string().trim().min(1).max(100),
  image_model: z.string().trim().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export const AiConfigUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  provider: AiProviderSchema.optional(),
  base_url: z.string().trim().min(1).max(500).optional(),
  api_key: z.string().trim().optional(),
  text_model: z.string().trim().min(1).max(100).optional(),
  image_model: z.string().trim().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export const AiPromptSceneSchema = z.enum([
  'content_score',
  'summary_generate',
  'summary_optimize',
  'summary_score',
  'weekly_organize',
  'weekly_desc',
  'weekly_cover',
]);

export const AiPromptUpdateSchema = z.object({
  prompt: z.string().trim().min(1),
});

