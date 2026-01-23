import { z } from 'zod';

export const RssSourceTypeSchema = z.enum(['normal', 'aggregator']);

export const RssSourceSchema = z.object({
  name: z.string().min(1).max(200),
  feed_url: z.string().url().max(768),
  type: RssSourceTypeSchema.optional(),
  enabled: z.boolean().optional(),
  content_type_id: z.number().int().optional(),
  category_id: z.number().int().nullable().optional(),
  config: z.unknown().nullable().optional(),
});

export const RssSourceUpdateSchema = RssSourceSchema.partial();

export const RssFetchSchema = z.object({
  source_id: z.number().int(),
  max_items: z.number().int().min(1).max(200).optional(),
  include_images: z.boolean().optional(),
  image_fetch_limit: z.number().int().min(0).max(50).optional(),
  similarity_check: z.boolean().optional(),
});

export const RssDuplicateCheckSchema = z.object({
  url: z.string().url(),
});

export const RssPreviewAggregatorSchema = z.object({
  source_id: z.number().int().optional(),
  feed_url: z.string().url().optional(),
  item_index: z.number().int().min(0).max(200).optional(),
});
