import { z } from 'zod';

const CoverImageSchema = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().url('封面图片必须是有效的URL').optional()
);

// Base content schema
export const BaseContentSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符'),
  content: z.string().min(1, '内容不能为空'),
  summary: z.string().max(2000, '摘要长度不能超过2000字符').optional(),
  image_url: z.string().url('主图必须是有效的URL').optional().or(z.literal('')),
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  category_id: z.number().int().positive().optional(),
  tag_ids: z.array(z.number().int().positive()).default([]),
  status: z.enum(['draft', 'published', 'archived', 'hidden']).default('draft'),
  featured: z.boolean().default(false),
  meta_title: z.string().max(500, 'SEO标题长度不能超过500字符').optional(),
  meta_description: z.string().max(1000, 'SEO描述长度不能超过1000字符').optional(),
});

// Blog-specific schema (content_type_id: 4)
export const BlogContentSchema = BaseContentSchema.extend({
  content_type_id: z.literal(4),
  // Blog专用字段
  cover_image: CoverImageSchema,
  reading_time: z.number().int().min(0).optional(),
  word_count: z.number().int().min(0).optional(),
});

// Weekly-specific schema (content_type_id: 3)  
export const WeeklyContentSchema = BaseContentSchema.extend({
  content_type_id: z.literal(3),
  // Weekly专用字段
  source: z.string().min(1, '来源名称不能为空').max(200, '来源名称长度不能超过200字符'),
  source_url: z.string().url('来源链接必须是有效的URL'),
  screenshot_api: z.enum(['ScreenshotLayer', 'HCTI', 'manual', 'karakeep']).default('manual'),
  recommendation_reason: z.string().max(500, '推荐理由长度不能超过500字符').optional(),
});

// Union schema for content creation/update
export const ContentSchema = z.discriminatedUnion('content_type_id', [
  BlogContentSchema,
  WeeklyContentSchema,
]);

// Query parameters schema for content listing
export const ContentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  contentType: z.enum(['blog', 'weekly', 'all']).default('all'),
  status: z.enum(['draft', 'published', 'archived', 'hidden']).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  tag_ids: z.string().transform((val) => {
    if (!val) return [];
    return val.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  }).optional(),
  keyword: z.string().max(200).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'published_at', 'title', 'view_count']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  featured: z.coerce.boolean().optional(),
});

// Content update schema (partial)
export const ContentUpdateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1, '标题不能为空').max(500, '标题长度不能超过500字符').optional(),
  content: z.string().min(1, '内容不能为空').optional(),
  summary: z.string().max(2000, '摘要长度不能超过2000字符').optional(),
  image_url: z.string().url('主图必须是有效的URL').optional().or(z.literal('')),
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  category_id: z.number().int().positive().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  status: z.enum(['draft', 'published', 'archived', 'hidden']).optional(),
  featured: z.boolean().optional(),
  meta_title: z.string().max(500, 'SEO标题长度不能超过500字符').optional(),
  meta_description: z.string().max(1000, 'SEO描述长度不能超过1000字符').optional(),
  content_type_id: z.union([z.literal(3), z.literal(4)]).optional(),
  // Blog专用字段
  cover_image: CoverImageSchema,
  reading_time: z.number().int().min(0).optional(),
  word_count: z.number().int().min(0).optional(),
  // Weekly专用字段
  source: z.string().min(1, '来源名称不能为空').max(200, '来源名称长度不能超过200字符').optional(),
  source_url: z.string().url('来源链接必须是有效的URL').optional(),
  screenshot_api: z.enum(['ScreenshotLayer', 'HCTI', 'manual', 'karakeep']).optional(),
  recommendation_reason: z.string().max(500, '推荐理由长度不能超过500字符').optional(),
});

// Batch operations schema
export const BatchOperationSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '至少选择一个内容'),
  operation: z.enum(['delete', 'publish', 'archive', 'hide', 'feature', 'unfeature']),
  category_id: z.number().int().positive().optional(), // For batch category change
});

export type ContentInput = z.infer<typeof ContentSchema>;
export type BlogContentInput = z.infer<typeof BlogContentSchema>;
export type WeeklyContentInput = z.infer<typeof WeeklyContentSchema>;
export type ContentQuery = z.infer<typeof ContentQuerySchema>;
export type ContentUpdate = z.infer<typeof ContentUpdateSchema>;
export type BatchOperation = z.infer<typeof BatchOperationSchema>;
