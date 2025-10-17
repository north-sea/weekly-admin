#!/usr/bin/env tsx
/**
 * 应用数据库 Schema 变更
 * 为 contents 表添加 image_url 和 summary 字段
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('应用数据库 Schema 变更');
  console.log('========================================\n');

  try {
    // 检查字段是否已存在
    const checkQuery = `
      SELECT 
        COLUMN_NAME 
      FROM 
        INFORMATION_SCHEMA.COLUMNS 
      WHERE 
        TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'contents' 
        AND COLUMN_NAME IN ('image_url', 'summary')
    `;

    const existingColumns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(checkQuery);
    const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);

    console.log('检查现有字段...');
    console.log(`已存在的字段: ${existingColumnNames.join(', ') || '(无)'}\n`);

    // 添加 image_url 字段
    if (!existingColumnNames.includes('image_url')) {
      console.log('添加 image_url 字段...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE contents ADD COLUMN image_url VARCHAR(500) NULL AFTER source_url`
      );
      console.log('✅ image_url 字段添加成功\n');
    } else {
      console.log('⏭️  image_url 字段已存在，跳过\n');
    }

    // 添加 summary 字段
    if (!existingColumnNames.includes('summary')) {
      console.log('添加 summary 字段...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE contents ADD COLUMN summary TEXT NULL AFTER description`
      );
      console.log('✅ summary 字段添加成功\n');
    } else {
      console.log('⏭️  summary 字段已存在，跳过\n');
    }

    console.log('========================================');
    console.log('Schema 变更完成');
    console.log('========================================');
    console.log('\n下一步: 执行数据迁移');
    console.log('运行: pnpm tsx scripts/migrate-content-to-structured.ts --dry-run\n');

  } catch (error) {
    console.error('❌ Schema 变更失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

