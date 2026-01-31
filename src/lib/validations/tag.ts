import { z } from 'zod';

// 标签组 schema
export const TagGroupSchema = z.object({
  name: z.string().min(1, '标签组名称不能为空').max(50, '标签组名称长度不能超过50字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(50, 'URL别名长度不能超过50字符')
    .regex(/^[a-z0-9-]+$/, 'URL别名只能包含小写字母、数字和连字符'),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().default(0),
});

export const TagGroupUpdateSchema = TagGroupSchema.partial().extend({
  id: z.number().int().positive(),
});

export const TagGroupQuerySchema = z.object({
  keyword: z.string().max(100).optional(),
  sort_by: z.enum(['name', 'sort_order', 'created_at']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

// 标签创建/更新schema
export const TagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(100, '标签名称长度不能超过100字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(100, 'URL别名长度不能超过100字符')
    .regex(/^[a-z0-9-]+$/, 'URL别名只能包含小写字母、数字和连字符'),
  group_id: z.number().int().positive().nullable().optional(),
  aliases: z.array(z.string().max(100)).max(20).optional(),
});

// 标签更新schema
export const TagUpdateSchema = TagSchema.partial().extend({
  id: z.number().int().positive(),
});

// 标签查询schema
export const TagQuerySchema = z.object({
  keyword: z.string().max(100).optional(),
  group_id: z.coerce.number().int().positive().optional(),
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

// 相似标签检测 schema
export const DetectSimilarTagSchema = z.object({
  name: z.string().min(1).max(100),
  threshold: z.number().min(0).max(1).default(0.8),
});

// 标签别名操作 schema
export const TagAliasSchema = z.object({
  aliases: z.array(z.string().min(1).max(100)).max(20),
});

export type TagGroupInput = z.infer<typeof TagGroupSchema>;
export type TagGroupUpdate = z.infer<typeof TagGroupUpdateSchema>;
export type TagGroupQuery = z.infer<typeof TagGroupQuerySchema>;
export type TagInput = z.infer<typeof TagSchema>;
export type TagUpdate = z.infer<typeof TagUpdateSchema>;
export type TagQuery = z.infer<typeof TagQuerySchema>;
export type TagMerge = z.infer<typeof TagMergeSchema>;
export type DetectSimilarTag = z.infer<typeof DetectSimilarTagSchema>;
export type TagAliasInput = z.infer<typeof TagAliasSchema>;
