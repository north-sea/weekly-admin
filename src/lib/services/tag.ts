import { TagInput, TagUpdate, TagQuery, TagMerge } from '@/lib/validations/tag';
import { prisma } from '@/lib/db';

export interface TagWithStats {
  id: number;
  name: string;
  slug: string;
  group_id?: number | null;
  aliases?: string[];
  count: number;
  created_at?: Date;
  updated_at?: Date;
  group?: {
    id: number;
    name: string;
    slug: string;
    color?: string | null;
  };
}

// 解析 aliases JSON 字符串
function parseAliases(aliasesJson: string | null): string[] {
  if (!aliasesJson) return [];
  try {
    const parsed = JSON.parse(aliasesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 序列化 aliases 为 JSON 字符串
function serializeAliases(aliases: string[] | undefined): string | null {
  if (!aliases || aliases.length === 0) return null;
  return JSON.stringify(aliases);
}

export class TagService {
  // 获取标签列表（支持分页）
  static async getTagList(query: TagQuery): Promise<{
    data: TagWithStats[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      keyword,
      group_id,
      sort_by = 'count',
      sort_order = 'desc',
      page,
      pageSize,
    } = query;

    const where: Record<string, unknown> = {};

    if (keyword) {
      // 搜索名称和别名
      where.OR = [
        { name: { contains: keyword } },
        { aliases: { contains: keyword } },
      ];
    }

    if (group_id !== undefined) {
      where.group_id = group_id;
    }

    const orderBy: Record<string, string> = {};
    orderBy[sort_by] = sort_order;

    const usePagination = page !== undefined && pageSize !== undefined;
    const currentPage = page ?? 1;
    const currentPageSize = pageSize ?? 20;
    const skip = usePagination ? (currentPage - 1) * currentPageSize : undefined;

    const [total, tags] = await Promise.all([
      prisma.tags.count({ where }),
      prisma.tags.findMany({
        where,
        orderBy,
        skip,
        take: usePagination ? currentPageSize : undefined,
        include: {
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
      }),
    ]);

    const mapped = await Promise.all(tags.map(async (tag) => {
      const count = await prisma.content_tags.count({
        where: { tag_id: tag.id }
      });

      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        group_id: tag.group_id,
        aliases: parseAliases(tag.aliases),
        count: count || 0,
        created_at: tag.created_at || undefined,
        updated_at: tag.updated_at || undefined,
        group: tag.group || undefined,
      };
    }));

    return {
      data: mapped,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / currentPageSize)),
      },
    };
  }

  // 获取单个标签
  static async getTagById(id: number): Promise<TagWithStats | null> {
    const tag = await prisma.tags.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    if (!tag) return null;

    const count = await prisma.content_tags.count({
      where: { tag_id: id }
    });

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      group_id: tag.group_id,
      aliases: parseAliases(tag.aliases),
      count: count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined,
      group: tag.group || undefined,
    };
  }

  // 创建标签
  static async createTag(data: TagInput): Promise<TagWithStats> {
    // 检查名称是否已存在
    const existingTag = await prisma.tags.findFirst({
      where: {
        OR: [
          { name: data.name },
          { slug: data.slug }
        ]
      }
    });

    if (existingTag) {
      if (existingTag.name === data.name) {
        throw new Error('标签名称已存在');
      }
      if (existingTag.slug === data.slug) {
        throw new Error('URL别名已存在');
      }
    }

    // 检查别名是否与其他标签名称或别名冲突
    if (data.aliases && data.aliases.length > 0) {
      for (const alias of data.aliases) {
        const conflictTag = await prisma.tags.findFirst({
          where: {
            OR: [
              { name: alias },
              { aliases: { contains: `"${alias}"` } },
            ],
          },
        });
        if (conflictTag) {
          throw new Error(`别名 "${alias}" 与已有标签冲突`);
        }
      }
    }

    const tag = await prisma.tags.create({
      data: {
        name: data.name,
        slug: data.slug,
        group_id: data.group_id ?? null,
        aliases: serializeAliases(data.aliases),
        count: 0,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      group_id: tag.group_id,
      aliases: parseAliases(tag.aliases),
      count: tag.count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined,
      group: tag.group || undefined,
    };
  }

  // 更新标签
  static async updateTag(data: TagUpdate): Promise<TagWithStats> {
    const { id, ...updateData } = data;

    // 检查标签是否存在
    const existingTag = await prisma.tags.findUnique({
      where: { id }
    });

    if (!existingTag) {
      throw new Error('标签不存在');
    }

    // 检查名称和slug是否与其他标签冲突
    if (updateData.name || updateData.slug) {
      const whereConditions = [];
      if (updateData.name) whereConditions.push({ name: updateData.name });
      if (updateData.slug) whereConditions.push({ slug: updateData.slug });

      const conflictTag = whereConditions.length > 0 ? await prisma.tags.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: whereConditions }
          ]
        }
      }) : null;

      if (conflictTag) {
        if (conflictTag.name === updateData.name) {
          throw new Error('标签名称已存在');
        }
        if (conflictTag.slug === updateData.slug) {
          throw new Error('URL别名已存在');
        }
      }
    }

    // 检查别名冲突
    if (updateData.aliases && updateData.aliases.length > 0) {
      for (const alias of updateData.aliases) {
        const conflictTag = await prisma.tags.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  { name: alias },
                  { aliases: { contains: `"${alias}"` } },
                ],
              },
            ],
          },
        });
        if (conflictTag) {
          throw new Error(`别名 "${alias}" 与已有标签冲突`);
        }
      }
    }

    // 构建更新数据
    const prismaUpdateData: Record<string, unknown> = {};
    if (updateData.name !== undefined) prismaUpdateData.name = updateData.name;
    if (updateData.slug !== undefined) prismaUpdateData.slug = updateData.slug;
    if (updateData.group_id !== undefined) prismaUpdateData.group_id = updateData.group_id;
    if (updateData.aliases !== undefined) prismaUpdateData.aliases = serializeAliases(updateData.aliases);

    const tag = await prisma.tags.update({
      where: { id },
      data: prismaUpdateData,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    const count = await prisma.content_tags.count({
      where: { tag_id: id }
    });

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      group_id: tag.group_id,
      aliases: parseAliases(tag.aliases),
      count: count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined,
      group: tag.group || undefined,
    };
  }

  // 删除标签
  static async deleteTag(id: number): Promise<void> {
    // 删除标签与内容的关联
    await prisma.content_tags.deleteMany({
      where: { tag_id: id }
    });

    // 删除标签
    await prisma.tags.delete({
      where: { id }
    });
  }

  // 合并标签（增强版：将源标签名转为目标标签的别名）
  static async mergeTags(data: TagMerge): Promise<void> {
    const { source_tag_ids, target_tag_id } = data;
    const uniqueSourceIds = Array.from(new Set(source_tag_ids));

    // 检查目标标签是否存在
    const targetTag = await prisma.tags.findUnique({
      where: { id: target_tag_id }
    });

    if (!targetTag) {
      throw new Error('目标标签不存在');
    }

    // 检查源标签是否都存在
    const sourceTags = await prisma.tags.findMany({
      where: { id: { in: uniqueSourceIds } }
    });

    const existingSourceIds = new Set(sourceTags.map((tag) => tag.id));
    const missingSourceIds = uniqueSourceIds.filter((id) => !existingSourceIds.has(id));
    if (sourceTags.length === 0) {
      throw new Error('部分源标签不存在');
    }

    // 确保目标标签不在源标签列表中
    if (uniqueSourceIds.includes(target_tag_id)) {
      throw new Error('目标标签不能在源标签列表中');
    }

    // 收集源标签名称作为新别名
    const sourceTagNames = sourceTags.map(t => t.name);
    const existingAliases = parseAliases(targetTag.aliases);
    const newAliases = [...new Set([...existingAliases, ...sourceTagNames])];
    const sourceTagIds = sourceTags.map((tag) => tag.id);

    // 开始事务处理
    await prisma.$transaction(async (tx) => {
      // 获取所有需要更新的内容标签关联
      const contentTags = await tx.content_tags.findMany({
        where: { tag_id: { in: sourceTagIds } }
      });

      // 删除原有的内容标签关联
      await tx.content_tags.deleteMany({
        where: { tag_id: { in: sourceTagIds } }
      });

      // 为每个内容创建与目标标签的关联（避免重复）
      const uniqueContentIds = [...new Set(contentTags.map(ct => ct.content_id))];

      for (const contentId of uniqueContentIds) {
        // 检查是否已经存在关联
        const existingRelation = await tx.content_tags.findFirst({
          where: {
            content_id: contentId,
            tag_id: target_tag_id
          }
        });

        // 如果不存在关联，则创建
        if (!existingRelation) {
          await tx.content_tags.create({
            data: {
              content_id: contentId,
              tag_id: target_tag_id
            }
          });
        }
      }

      // 更新目标标签的计数和别名
      const newCount = await tx.content_tags.count({
        where: { tag_id: target_tag_id }
      });

      await tx.tags.update({
        where: { id: target_tag_id },
        data: {
          count: newCount,
          aliases: serializeAliases(newAliases),
        }
      });

      // 删除源标签
      await tx.tags.deleteMany({
        where: { id: { in: sourceTagIds } }
      });
    });

    if (missingSourceIds.length > 0) {
      console.warn('合并标签时发现不存在的源标签:', missingSourceIds);
    }
  }

  // 更新标签使用计数
  static async updateTagCounts(): Promise<void> {
    const tags = await prisma.tags.findMany();

    for (const tag of tags) {
      const count = await prisma.content_tags.count({
        where: { tag_id: tag.id }
      });

      await prisma.tags.update({
        where: { id: tag.id },
        data: { count }
      });
    }
  }

  // 获取标签使用统计
  static async getTagStats(): Promise<Array<{ tag: TagWithStats; content_count: number }>> {
    const tags = await prisma.tags.findMany({
      orderBy: { count: 'desc' },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    return tags.map(tag => ({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        group_id: tag.group_id,
        aliases: parseAliases(tag.aliases),
        count: tag.count || 0,
        created_at: tag.created_at || undefined,
        updated_at: tag.updated_at || undefined,
        group: tag.group || undefined,
      },
      content_count: tag.count || 0
    }));
  }

  // 获取热门标签
  static async getPopularTags(limit: number = 10): Promise<TagWithStats[]> {
    const tags = await prisma.tags.findMany({
      orderBy: { count: 'desc' },
      take: limit,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    return tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      group_id: tag.group_id,
      aliases: parseAliases(tag.aliases),
      count: tag.count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined,
      group: tag.group || undefined,
    }));
  }

  // 通过名称或别名查找标签
  static async findTagByNameOrAlias(nameOrAlias: string): Promise<TagWithStats | null> {
    // 先精确匹配名称
    let tag = await prisma.tags.findFirst({
      where: { name: nameOrAlias },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    // 如果没找到，搜索别名
    if (!tag) {
      tag = await prisma.tags.findFirst({
        where: { aliases: { contains: `"${nameOrAlias}"` } },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
        },
      });
    }

    if (!tag) return null;

    const count = await prisma.content_tags.count({
      where: { tag_id: tag.id }
    });

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      group_id: tag.group_id,
      aliases: parseAliases(tag.aliases),
      count: count || 0,
      created_at: tag.created_at || undefined,
      updated_at: tag.updated_at || undefined,
      group: tag.group || undefined,
    };
  }

  // 更新标签别名
  static async updateTagAliases(id: number, aliases: string[]): Promise<TagWithStats> {
    const tag = await prisma.tags.findUnique({ where: { id } });
    if (!tag) {
      throw new Error('标签不存在');
    }

    // 检查别名冲突
    for (const alias of aliases) {
      const conflictTag = await prisma.tags.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                { name: alias },
                { aliases: { contains: `"${alias}"` } },
              ],
            },
          ],
        },
      });
      if (conflictTag) {
        throw new Error(`别名 "${alias}" 与已有标签冲突`);
      }
    }

    const updated = await prisma.tags.update({
      where: { id },
      data: { aliases: serializeAliases(aliases) },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
          },
        },
      },
    });

    const count = await prisma.content_tags.count({
      where: { tag_id: id }
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      group_id: updated.group_id,
      aliases: parseAliases(updated.aliases),
      count: count || 0,
      created_at: updated.created_at || undefined,
      updated_at: updated.updated_at || undefined,
      group: updated.group || undefined,
    };
  }
}
