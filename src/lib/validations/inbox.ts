import { z } from 'zod';

export const InboxStatusSchema = z.enum(['pending', 'promoted', 'rejected', 'duplicate']);

export const InboxListQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
  status: InboxStatusSchema.optional(),
  source_id: z.number().int().optional(),
  keyword: z.string().min(1).optional(),
  showDuplicates: z.enum(['all', 'original', 'duplicate']).optional(),
  sortBy: z
    .enum(['created_at', 'updated_at', 'priority', 'ai_score', 'source_published_at', 'synced_at', 'collected_at'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  ai_score_min: z.number().min(0).max(100).optional(),
});

export const InboxPromoteSchema = z.object({
  content_type_id: z.number().int().optional(),
  category_id: z.number().int().nullable().optional(),
  tag_ids: z.array(z.number().int()).optional(),
  content_format: z.enum(['markdown', 'mdx', 'html', 'plain']).optional(),
});

export const InboxBatchSchema = z.object({
  ids: z.array(z.union([z.number().int(), z.string()])),
  action: z.enum(['reject', 'mark_duplicate', 'mark_pending']),
});

export const InboxBatchPromoteSchema = z.object({
  ids: z.array(z.union([z.number().int(), z.string()])).min(1),
  // 可选的统一配置，不传则使用各条目的 AI 建议
  content_type_id: z.number().int().optional(),
  category_id: z.number().int().nullable().optional(),
  tag_ids: z.array(z.number().int()).optional(),
  content_format: z.enum(['markdown', 'mdx', 'html', 'plain']).optional(),
});

export type InboxListQuery = z.infer<typeof InboxListQuerySchema>;
export type InboxPromoteInput = z.infer<typeof InboxPromoteSchema>;
export type InboxBatchInput = z.infer<typeof InboxBatchSchema>;
export type InboxBatchPromoteInput = z.infer<typeof InboxBatchPromoteSchema>;
