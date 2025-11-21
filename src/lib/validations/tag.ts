import { z } from 'zod';

// 标签创建/更新schema
export const TagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(100, '标签名称长度不能超过100字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(100, 'URL别名长度不能超过100字符')
    .regex(/^[a-z0-9-]+$/, 'URL别名只能包含小写字母、数字和连字符'),
});

// 标签更新schema
export const TagUpdateSchema = TagSchema.partial().extend({
  id: z.number().int().positive(),
});

// 标签查询schema
export const TagQuerySchema = z.object({
  keyword: z.string().max(100).optional(),
  sort_by: z.enum(['name', 'count', 'created_at']).default('count'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
});

// 标签合并schema
export const TagMergeSchema = z.object({
  source_tag_ids: z.array(z.number().int().positive()).min(1, '至少选择一个源标签'),
  target_tag_id: z.number().int().positive(),
});

export type TagInput = z.infer<typeof TagSchema>;
export type TagUpdate = z.infer<typeof TagUpdateSchema>;
export type TagQuery = z.infer<typeof TagQuerySchema>;
export type TagMerge = z.infer<typeof TagMergeSchema>;
