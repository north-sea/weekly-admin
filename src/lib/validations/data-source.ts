import { z } from 'zod';

export const DataSourceTypeSchema = z.enum(['rss', 'karakeep', 'webhook', 'manual']);

export const DataSourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: DataSourceTypeSchema,
  enabled: z.boolean().optional(),
  config: z.unknown().nullable().optional(),
  auto_promote_threshold: z.number().min(0).max(100).nullable().optional(),
  auto_score_override: z.boolean().nullable().optional(),
  default_category_id: z.number().int().nullable().optional(),
  default_content_type_id: z.number().int().nullable().optional(),
  sync_interval_minutes: z.number().int().min(0).nullable().optional(),
});

export const DataSourceUpdateSchema = DataSourceSchema.partial();

export const SyncDataSourceSchema = z.object({
  source_id: z.number().int(),
  max_items: z.number().int().min(1).max(500).optional(),
  include_images: z.boolean().optional(),
  image_fetch_limit: z.number().int().min(0).max(50).optional(),
  similarity_check: z.boolean().optional(),
});

export type DataSourceInput = z.infer<typeof DataSourceSchema>;
export type DataSourceUpdate = z.infer<typeof DataSourceUpdateSchema>;
export type SyncDataSourceInput = z.infer<typeof SyncDataSourceSchema>;
