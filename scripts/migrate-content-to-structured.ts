#!/usr/bin/env tsx
/**
 * 数据迁移脚本：将 contents 表的 Markdown 内容解析为结构化字段
 * 
 * 功能：
 * 1. 从 content 字段中提取 image_url（![img](url) 格式）
 * 2. 从 content 字段中提取 summary（去除标题和图片后的文本）
 * 3. 更新 image_url 和 summary 字段
 * 4. 保留原 content 字段不变（向后兼容）
 * 
 * 使用方法：
 * pnpm tsx scripts/migrate-content-to-structured.ts --dry-run  # 预览
 * pnpm tsx scripts/migrate-content-to-structured.ts            # 执行
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 从 Markdown 内容中提取图片 URL
 */
function extractImageUrl(markdown: string): string | null {
  // 匹配 ![任意文本](图片URL) 格式
  const imgRegex = /!\[.*?\]\((.*?)\)/;
  const match = markdown.match(imgRegex);
  return match ? match[1].trim() : null;
}

/**
 * 从 Markdown 内容中提取摘要
 */
function extractSummary(markdown: string): string {
  let text = markdown;
  
  // 移除标题（### [标题](URL) 格式）
  text = text.replace(/^###\s+\[.*?\]\(.*?\)\s*$/gm, '');
  
  // 移除图片
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  
  // 移除多余空行
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  
  // 限制长度为 500 字符
  if (text.length > 500) {
    text = text.substring(0, 500) + '...';
  }
  
  return text;
}

/**
 * 主函数
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('========================================');
  console.log('内容结构化迁移脚本');
  console.log('========================================');
  console.log(`模式: ${isDryRun ? '预览模式（不会修改数据）' : '执行模式'}`);
  console.log('');

  try {
    // 1. 获取所有需要迁移的内容
    // 注意：跳过 Blog 类型（content_type_id = 4），因为 Blog 需要完整的 Markdown 渲染
    const contents = await prisma.contents.findMany({
      where: {
        OR: [
          { image_url: null },
          { summary: null },
        ],
        content: {
          not: '',
        },
        // 只迁移 Weekly 类型（content_type_id = 3）和其他非 Blog 类型
        content_type_id: {
          not: 4, // 排除 Blog
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
        image_url: true,
        summary: true,
        content_type_id: true,
      },
    });

    console.log(`找到 ${contents.length} 条需要迁移的记录`);
    console.log('注意：Blog 类型（content_type_id = 4）的内容已自动跳过\n');

    if (contents.length === 0) {
      console.log('✅ 没有需要迁移的数据');
      return;
    }

    // 2. 处理每条记录
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const content of contents) {
      try {
        const needsUpdate = !content.image_url || !content.summary;
        
        if (!needsUpdate) {
          skipCount++;
          continue;
        }

        // 提取结构化字段
        const imageUrl = content.image_url || extractImageUrl(content.content);
        const summary = content.summary || extractSummary(content.content);

        if (isDryRun) {
          // 预览模式：只显示将要执行的操作
          console.log(`[预览] ID: ${content.id}`);
          console.log(`  标题: ${content.title}`);
          console.log(`  图片URL: ${imageUrl || '(无)'}`);
          console.log(`  摘要: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);
          console.log('');
          successCount++;
        } else {
          // 执行模式：更新数据库
          await prisma.contents.update({
            where: { id: content.id },
            data: {
              image_url: imageUrl,
              summary: summary || null,
            },
          });

          console.log(`✅ [${successCount + 1}/${contents.length}] 已迁移: ${content.title}`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ 处理失败 ID: ${content.id}`, error);
        errorCount++;
      }
    }

    // 3. 输出统计信息
    console.log('\n========================================');
    console.log('迁移完成');
    console.log('========================================');
    console.log(`总计: ${contents.length} 条记录`);
    console.log(`成功: ${successCount} 条`);
    console.log(`跳过: ${skipCount} 条`);
    console.log(`失败: ${errorCount} 条`);
    
    if (isDryRun) {
      console.log('\n💡 这是预览模式，数据未被修改');
      console.log('   执行迁移请运行: pnpm tsx scripts/migrate-content-to-structured.ts');
    } else {
      console.log('\n✅ 数据已成功迁移');
    }
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
main().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

