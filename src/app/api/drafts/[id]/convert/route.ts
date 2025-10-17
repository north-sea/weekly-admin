/**
 * 草稿转换 API 路由
 * POST /api/drafts/:id/convert - 将草稿转换为正式内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftById, updateDraft } from '@/lib/services/draft';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';
import { archiveKarakeepBookmark } from '@/lib/services/karakeep-api';

/**
 * POST /api/drafts/:id/convert
 * 将草稿转换为正式内容
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    const { id } = await params;
    const body = await request.json();
    
    // 获取草稿
    const draft = await getDraftById(BigInt(id));
    if (!draft) {
      return createNextErrorResponse('NOT_FOUND', '草稿不存在', 404);
    }

    // 检查是否已经转换过
    if (draft.content_id) {
      return createNextErrorResponse('ALREADY_CONVERTED', '该草稿已经转换为内容', 400);
    }

    // 从请求体获取额外信息
    const {
      content_type_id = 3, // 默认 Weekly 类型
      category_id,
      tags = [],
      content_format = 'markdown',
    } = body;

    // 提取域名作为来源
    const extractDomain = (url: string): string => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    };

    // 生成 slug
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);
    };

    // 处理标签：自动匹配或创建
    const finalTagIds: number[] = [...tags]; // 用户指定的标签
    
    // 如果草稿有 Karakeep 标签建议，尝试自动匹配
    if (draft.tags_suggestion && finalTagIds.length === 0) {
      try {
        const karakeepTags = JSON.parse(draft.tags_suggestion);
        for (const kTag of karakeepTags) {
          if (!kTag.name) continue;
          
          // 1. 查找已存在的标签（精确匹配或 slug 匹配）
          let tag = await prisma.tags.findFirst({
            where: {
              OR: [
                { name: kTag.name },
                { name: { equals: kTag.name, mode: 'insensitive' } },
              ]
            }
          });
          
          // 2. 不存在则创建新标签
          if (!tag) {
            const slug = generateSlug(kTag.name);
            tag = await prisma.tags.create({
              data: {
                name: kTag.name,
                slug: `${slug}-${Date.now()}`,
                count: 0,
              }
            });
            console.log(`自动创建标签: ${kTag.name} (来自 Karakeep ${kTag.attachedBy})`);
          }
          
          finalTagIds.push(tag.id);
        }
      } catch (error) {
        console.error('处理 Karakeep 标签失败:', error);
      }
    }

    // 构建内容数据（直接映射草稿的结构化字段）
    const contentData: any = {
      content_type_id,
      category_id: category_id || null,
      title: draft.title,
      slug: draft.slug || (generateSlug(draft.title) + '-' + Date.now()),
      description: draft.description || draft.summary || draft.note || '',
      // 结构化字段：直接映射
      image_url: draft.image_url || null,
      summary: draft.summary || draft.description || draft.note || null,
      // 兼容：保留 content 字段（Markdown 格式）
      content: draft.content || `## ${draft.title}

${draft.summary || draft.description || ''}

**来源**: [${draft.source || extractDomain(draft.url)}](${draft.url})

${draft.note ? `\n**笔记**\n${draft.note}` : ''}
`.trim(),
      content_format,
      status: 'draft', // 转换后仍为草稿状态，需要进一步编辑
      source: draft.source || extractDomain(draft.url),
      source_url: draft.url,
      word_count: draft.word_count || 0,
    };

    // 如果未提供 category_id，尝试根据草稿的 category_suggestion 自动匹配或创建
    let resolvedCategoryId = category_id || null;
    if (!resolvedCategoryId && draft.category_suggestion) {
      try {
        const suggestedName = draft.category_suggestion.trim();
        if (suggestedName) {
          // 先尝试按名称或 slug 匹配
          const catSlugBase = generateSlug(suggestedName);
          let category = await prisma.categories.findFirst({
            where: {
              OR: [
                { name: suggestedName },
                { slug: catSlugBase },
              ],
            },
          });
          // 不存在则创建
          if (!category) {
            const catSlug = generateSlug(suggestedName);
            category = await prisma.categories.create({
              data: {
                name: suggestedName,
                slug: `${catSlug}-${Date.now()}`,
              },
            });
          }
          resolvedCategoryId = category.id;
        }
      } catch (error) {
        console.error('自动分类处理失败:', error);
      }
    }

    // 创建内容
    const content = await prisma.contents.create({
      data: { ...contentData, category_id: resolvedCategoryId },
    });

    // 创建标签关联
    if (finalTagIds.length > 0) {
      for (const tagId of finalTagIds) {
        await prisma.content_tags.create({
          data: {
            content_id: content.id,
            tag_id: tagId,
          },
        });
      }
      
      // 更新标签计数
      await prisma.tags.updateMany({
        where: { id: { in: finalTagIds } },
        data: { count: { increment: 1 } },
      });
    }

    // 更新草稿：标记为已采用，关联到内容
    await updateDraft(BigInt(id), {
      status: 'adopted',
      linked_content: {
        connect: { id: content.id },
      },
    });

    // 【双向同步】在 Karakeep 中归档该书签
    try {
      if (draft.karakeep_id) {
        await archiveKarakeepBookmark(draft.karakeep_id);
        console.log(`已在 Karakeep 中归档书签: ${draft.karakeep_id}`);
      }
    } catch (error) {
      // 归档失败不影响转换流程，只记录日志
      console.error('归档 Karakeep 书签失败:', error);
    }

    // 序列化
    const serialized = {
      ...content,
      id: content.id.toString(),
    };

    return createNextSuccessResponse(serialized, 200, { message: '成功转换为内容，已在 Karakeep 中归档' });
  } catch (error) {
    console.error('转换草稿失败:', error);
    return createNextErrorResponse('CONVERT_DRAFT_ERROR', '转换草稿失败', 500);
  }
}

