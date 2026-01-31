import { z } from 'zod';

// 分类创建/更新schema
export const CategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(100, '分类名称长度不能超过100字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(100, 'URL别名长度不能超过100字符')
    .regex(/^[a-z0-9-]+$/, 'URL别名只能包含小写字母、数字和连字符'),
  parent_id: z.number().int().positive().nullable().optional(),
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

// 分类合并 schema
export const CategoryMergeSchema = z.object({
  source_category_ids: z.array(z.number().int().positive()).min(1, '至少选择一个源分类'),
  target_category_id: z.number().int().positive(),
});

// 分类移动 schema
export const CategoryMoveSchema = z.object({
  id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable(),
  sort_order: z.number().int().min(0),
});

// 分类归档 schema
export const CategoryArchiveSchema = z.object({
  id: z.number().int().positive(),
  archived: z.boolean(),
});

// 分类迁移 schema（删除前迁移内容）
export const CategoryMigrateSchema = z.object({
  source_id: z.number().int().positive(),
  target_id: z.number().int().positive().nullable(), // null 表示不迁移，直接删除
  migrate_children: z.boolean().default(true), // 是否迁移子分类
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type CategoryQuery = z.infer<typeof CategoryQuerySchema>;
export type CategoryMerge = z.infer<typeof CategoryMergeSchema>;
export type CategoryMove = z.infer<typeof CategoryMoveSchema>;
export type CategoryArchive = z.infer<typeof CategoryArchiveSchema>;
export type CategoryMigrate = z.infer<typeof CategoryMigrateSchema>;
