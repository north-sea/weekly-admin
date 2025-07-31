import { z } from 'zod';

// 分类创建/更新schema
export const CategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(100, '分类名称长度不能超过100字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(100, 'URL别名长度不能超过100字符')
    .regex(/^[a-z0-9-]+$/, 'URL别名只能包含小写字母、数字和连字符'),
  parent_id: z.number().int().positive().optional(),
  description: z.string().max(1000, '描述长度不能超过1000字符').optional(),
  sort_order: z.number().int().min(0).default(0),
});

// 分类更新schema
export const CategoryUpdateSchema = CategorySchema.partial().extend({
  id: z.number().int().positive(),
});

// 分类查询schema
export const CategoryQuerySchema = z.object({
  parent_id: z.coerce.number().int().positive().optional(),
  keyword: z.string().max(100).optional(),
  include_children: z.coerce.boolean().default(true),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type CategoryQuery = z.infer<typeof CategoryQuerySchema>;