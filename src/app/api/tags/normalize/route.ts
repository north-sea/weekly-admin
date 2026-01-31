import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OperationLogger } from '@/lib/middleware/operation-logger';

// 命名规则类型
export type NamingRule = 'lowercase' | 'capitalize' | 'uppercase' | 'kebab-case';

// 规范化预览结果
export interface NormalizePreview {
  id: number;
  originalName: string;
  normalizedName: string;
  willChange: boolean;
}

// 规范化结果
export interface NormalizeResult {
  total: number;
  changed: number;
  unchanged: number;
  errors: string[];
}

const PreviewSchema = z.object({
  rule: z.enum(['lowercase', 'capitalize', 'uppercase', 'kebab-case']),
  tagIds: z.array(z.number()).optional(), // 如果不提供，则处理所有标签
});

const ExecuteSchema = z.object({
  rule: z.enum(['lowercase', 'capitalize', 'uppercase', 'kebab-case']),
  tagIds: z.array(z.number()).min(1, '至少选择一个标签'),
});

// 应用命名规则
function applyNamingRule(name: string, rule: NamingRule): string {
  switch (rule) {
    case 'lowercase':
      return name.toLowerCase();
    case 'uppercase':
      return name.toUpperCase();
    case 'capitalize':
      // 首字母大写，其余小写
      return name
        .split(/[\s-_]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    case 'kebab-case':
      // 转换为 kebab-case
      return name
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    default:
      return name;
  }
}

// GET /api/tags/normalize - 预览规范化结果
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rule = searchParams.get('rule') as NamingRule;
    const tagIdsParam = searchParams.get('tagIds');

    if (!rule || !['lowercase', 'capitalize', 'uppercase', 'kebab-case'].includes(rule)) {
      return NextResponse.json({ error: '无效的命名规则' }, { status: 400 });
    }

    // 获取标签
    let tags;
    if (tagIdsParam) {
      const tagIds = tagIdsParam.split(',').map((id) => parseInt(id, 10));
      tags = await prisma.tags.findMany({
        where: { id: { in: tagIds } },
        select: { id: true, name: true },
      });
    } else {
      tags = await prisma.tags.findMany({
        select: { id: true, name: true },
      });
    }

    // 生成预览
    const previews: NormalizePreview[] = tags.map((tag) => {
      const normalizedName = applyNamingRule(tag.name, rule);
      return {
        id: tag.id,
        originalName: tag.name,
        normalizedName,
        willChange: tag.name !== normalizedName,
      };
    });

    // 统计
    const willChangeCount = previews.filter((p) => p.willChange).length;

    return NextResponse.json({
      success: true,
      data: {
        previews,
        summary: {
          total: previews.length,
          willChange: willChangeCount,
          unchanged: previews.length - willChangeCount,
        },
      },
    });
  } catch (error) {
    console.error('预览规范化失败:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '预览规范化失败' }, { status: 500 });
  }
}

// POST /api/tags/normalize - 执行规范化
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const data = ExecuteSchema.parse(body);

    // 获取要处理的标签
    const tags = await prisma.tags.findMany({
      where: { id: { in: data.tagIds } },
      select: { id: true, name: true, slug: true },
    });

    const result: NormalizeResult = {
      total: tags.length,
      changed: 0,
      unchanged: 0,
      errors: [],
    };

    // 逐个更新
    for (const tag of tags) {
      const normalizedName = applyNamingRule(tag.name, data.rule);

      if (tag.name === normalizedName) {
        result.unchanged++;
        continue;
      }

      try {
        // 检查是否有重名
        const existing = await prisma.tags.findFirst({
          where: {
            name: normalizedName,
            id: { not: tag.id },
          },
        });

        if (existing) {
          result.errors.push(`"${tag.name}" 规范化后与 "${existing.name}" 重名`);
          continue;
        }

        // 更新标签
        await prisma.tags.update({
          where: { id: tag.id },
          data: {
            name: normalizedName,
            // 同时更新 slug
            slug: normalizedName
              .toLowerCase()
              .replace(/[\s]+/g, '-')
              .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, ''),
          },
        });

        result.changed++;

        // 记录操作日志
        await OperationLogger.logTaxonomyOperation(
          authResult.user.id,
          'UPDATE',
          'tag',
          tag.id,
          {
            name: normalizedName,
            action: 'normalize',
            changes: {
              originalName: tag.name,
              rule: data.rule,
            },
          },
          request
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        result.errors.push(`更新 "${tag.name}" 失败: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('执行规范化失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数验证失败', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: '执行规范化失败' }, { status: 500 });
  }
}
