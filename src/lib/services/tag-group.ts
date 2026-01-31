import { TagGroupInput, TagGroupUpdate, TagGroupQuery } from '@/lib/validations/tag';
import { prisma } from '@/lib/db';

export interface TagGroupWithStats {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  sort_order: number;
  created_at?: Date | null;
  updated_at?: Date | null;
  tag_count: number;
}

export class TagGroupService {
  // 获取标签组列表
  static async getTagGroupList(query: TagGroupQuery): Promise<TagGroupWithStats[]> {
    const { keyword, sort_by = 'sort_order', sort_order = 'asc' } = query;

    const where: Record<string, unknown> = {};

    if (keyword) {
      where.name = { contains: keyword };
    }

    const orderBy: Record<string, string> = {};
    orderBy[sort_by] = sort_order;

    const groups = await prisma.tag_groups.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { tags: true },
        },
      },
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      color: group.color,
      sort_order: group.sort_order,
      created_at: group.created_at,
      updated_at: group.updated_at,
      tag_count: group._count.tags,
    }));
  }

  // 获取单个标签组
  static async getTagGroupById(id: number): Promise<TagGroupWithStats | null> {
    const group = await prisma.tag_groups.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tags: true },
        },
      },
    });

    if (!group) return null;

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      color: group.color,
      sort_order: group.sort_order,
      created_at: group.created_at,
      updated_at: group.updated_at,
      tag_count: group._count.tags,
    };
  }

  // 创建标签组
  static async createTagGroup(data: TagGroupInput): Promise<TagGroupWithStats> {
    // 检查名称和 slug 是否已存在
    const existing = await prisma.tag_groups.findFirst({
      where: {
        OR: [{ name: data.name }, { slug: data.slug }],
      },
    });

    if (existing) {
      if (existing.name === data.name) {
        throw new Error('标签组名称已存在');
      }
      if (existing.slug === data.slug) {
        throw new Error('URL别名已存在');
      }
    }

    const group = await prisma.tag_groups.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        color: data.color,
        sort_order: data.sort_order ?? 0,
      },
    });

    return {
      ...group,
      tag_count: 0,
    };
  }

  // 更新标签组
  static async updateTagGroup(data: TagGroupUpdate): Promise<TagGroupWithStats> {
    const { id, ...updateData } = data;

    // 检查标签组是否存在
    const existing = await prisma.tag_groups.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('标签组不存在');
    }

    // 检查名称和 slug 是否与其他标签组冲突
    if (updateData.name || updateData.slug) {
      const whereConditions = [];
      if (updateData.name) whereConditions.push({ name: updateData.name });
      if (updateData.slug) whereConditions.push({ slug: updateData.slug });

      const conflict =
        whereConditions.length > 0
          ? await prisma.tag_groups.findFirst({
              where: {
                AND: [{ id: { not: id } }, { OR: whereConditions }],
              },
            })
          : null;

      if (conflict) {
        if (conflict.name === updateData.name) {
          throw new Error('标签组名称已存在');
        }
        if (conflict.slug === updateData.slug) {
          throw new Error('URL别名已存在');
        }
      }
    }

    const group = await prisma.tag_groups.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { tags: true },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      color: group.color,
      sort_order: group.sort_order,
      created_at: group.created_at,
      updated_at: group.updated_at,
      tag_count: group._count.tags,
    };
  }

  // 删除标签组
  static async deleteTagGroup(id: number): Promise<void> {
    // 检查标签组是否存在
    const existing = await prisma.tag_groups.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('标签组不存在');
    }

    // 删除标签组（关联的标签 group_id 会被设为 null，因为设置了 onDelete: SetNull）
    await prisma.tag_groups.delete({
      where: { id },
    });
  }

  // 获取所有标签组（用于下拉选择）
  static async getAllTagGroups(): Promise<
    Array<{ id: number; name: string; slug: string; color?: string | null }>
  > {
    const groups = await prisma.tag_groups.findMany({
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
      },
    });

    return groups;
  }
}
