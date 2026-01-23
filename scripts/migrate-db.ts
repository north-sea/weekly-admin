import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migrateDatabase() {
  try {
    console.log('🔄 开始 MySQL 数据库迁移...');

    // 创建用户表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          display_name VARCHAR(100),
          role ENUM('ADMIN', 'EDITOR') DEFAULT 'EDITOR',
          status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
          last_login_at TIMESTAMP NULL,
          login_attempts INT DEFAULT 0,
          locked_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ 用户表创建完成');

    // 创建操作日志表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS operation_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          operation_type ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id INT,
          operation_details TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_operation_type (operation_type),
          INDEX idx_resource_type (resource_type)
      )
    `;
    console.log('✅ 操作日志表创建完成');

    // 创建内容版本表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS content_versions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          content_id BIGINT NOT NULL,
          version_number INT NOT NULL,
          title VARCHAR(500),
          content LONGTEXT,
          description TEXT,
          source VARCHAR(200),
          source_url VARCHAR(1000),
          changes_summary TEXT,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_content_version (content_id, version_number),
          INDEX idx_content_id (content_id),
          INDEX idx_created_by (created_by)
      )
    `;
    console.log('✅ 内容版本表创建完成');

    // 检查 contents 表是否有 user_id 字段
    const contentsColumns = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'user_id'
    `;
    
    if (Array.isArray(contentsColumns) && contentsColumns.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN user_id INT
      `;
      console.log('✅ contents 表添加 user_id 字段');
    }

    // AI 字段（contents）
    const originalScoreColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'original_score'
    `;
    if (Array.isArray(originalScoreColumn) && originalScoreColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN original_score FLOAT NULL
      `;
      console.log('✅ contents 表添加 original_score 字段');
    }

    const summaryScoreColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'summary_score'
    `;
    if (Array.isArray(summaryScoreColumn) && summaryScoreColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN summary_score FLOAT NULL
      `;
      console.log('✅ contents 表添加 summary_score 字段');
    }

    const aiMetadataColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'ai_metadata'
    `;
    if (Array.isArray(aiMetadataColumn) && aiMetadataColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN ai_metadata JSON NULL
      `;
      console.log('✅ contents 表添加 ai_metadata 字段');
    }

    const imageSourceColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_source'
    `;
    if (Array.isArray(imageSourceColumn) && imageSourceColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_source VARCHAR(50) NULL
      `;
      console.log('✅ contents 表添加 image_source 字段');
    }

    const imageWidthColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_width'
    `;
    if (Array.isArray(imageWidthColumn) && imageWidthColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_width INT NULL
      `;
      console.log('✅ contents 表添加 image_width 字段');
    }

    const imageHeightColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM contents LIKE 'image_height'
    `;
    if (Array.isArray(imageHeightColumn) && imageHeightColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE contents ADD COLUMN image_height INT NULL
      `;
      console.log('✅ contents 表添加 image_height 字段');
    }

    // AI 字段索引（可选，但推荐）
    const originalScoreIndex = await prisma.$queryRaw`
      SHOW INDEX FROM contents WHERE Key_name = 'idx_original_score'
    `;
    if (Array.isArray(originalScoreIndex) && originalScoreIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_original_score ON contents(original_score)
      `;
      console.log('✅ contents 表创建 idx_original_score 索引');
    }

    const summaryScoreIndex = await prisma.$queryRaw`
      SHOW INDEX FROM contents WHERE Key_name = 'idx_summary_score'
    `;
    if (Array.isArray(summaryScoreIndex) && summaryScoreIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_summary_score ON contents(summary_score)
      `;
      console.log('✅ contents 表创建 idx_summary_score 索引');
    }

    // RSS 源表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS rss_sources (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(200) NOT NULL,
          feed_url VARCHAR(768) NOT NULL,
          type ENUM('normal', 'aggregator') DEFAULT 'normal',
          enabled BOOLEAN DEFAULT true,
          content_type_id INT DEFAULT 4,
          category_id INT NULL,
          config JSON NULL,
          last_fetched_at TIMESTAMP NULL,
          fetch_count INT DEFAULT 0,
          error_count INT DEFAULT 0,
          last_error TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_feed_url (feed_url),
          INDEX idx_rss_sources_enabled (enabled),
          INDEX idx_rss_sources_type (type),
          INDEX idx_rss_sources_category_id (category_id)
      )
    `;
    console.log('✅ RSS 源表创建完成');

    // RSS 源表索引（兼容旧表结构）
    const rssEnabledIndex = await prisma.$queryRaw`
      SHOW INDEX FROM rss_sources WHERE Key_name = 'idx_rss_sources_enabled'
    `;
    if (Array.isArray(rssEnabledIndex) && rssEnabledIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_rss_sources_enabled ON rss_sources(enabled)
      `;
      console.log('✅ rss_sources 表创建 idx_rss_sources_enabled 索引');
    }

    const rssTypeIndex = await prisma.$queryRaw`
      SHOW INDEX FROM rss_sources WHERE Key_name = 'idx_rss_sources_type'
    `;
    if (Array.isArray(rssTypeIndex) && rssTypeIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_rss_sources_type ON rss_sources(type)
      `;
      console.log('✅ rss_sources 表创建 idx_rss_sources_type 索引');
    }

    const rssCategoryIndex = await prisma.$queryRaw`
      SHOW INDEX FROM rss_sources WHERE Key_name = 'idx_rss_sources_category_id'
    `;
    if (Array.isArray(rssCategoryIndex) && rssCategoryIndex.length === 0) {
      await prisma.$executeRaw`
        CREATE INDEX idx_rss_sources_category_id ON rss_sources(category_id)
      `;
      console.log('✅ rss_sources 表创建 idx_rss_sources_category_id 索引');
    }

    // 检查 weekly_issues 表是否有 created_by 字段
    const weeklyIssuesColumns = await prisma.$queryRaw`
      SHOW COLUMNS FROM weekly_issues LIKE 'created_by'
    `;

    if (Array.isArray(weeklyIssuesColumns) && weeklyIssuesColumns.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE weekly_issues ADD COLUMN created_by INT DEFAULT 1
      `;
      console.log('✅ weekly_issues 表添加 created_by 字段');
    }

    // 检查 weekly_issues 表是否有 Quail 相关字段
    const quailPostIdColumn = await prisma.$queryRaw`
      SHOW COLUMNS FROM weekly_issues LIKE 'quail_post_id'
    `;

    if (Array.isArray(quailPostIdColumn) && quailPostIdColumn.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE weekly_issues
        ADD COLUMN quail_post_id VARCHAR(100) NULL,
        ADD COLUMN quail_post_slug VARCHAR(200) NULL,
        ADD COLUMN quail_published_at TIMESTAMP NULL,
        ADD COLUMN quail_delivered_at TIMESTAMP NULL,
        ADD COLUMN quail_publish_error TEXT NULL
      `;
      console.log('✅ weekly_issues 表添加 Quail 相关字段');
    }

    // 创建默认用户
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const editorPasswordHash = await bcrypt.hash('editor123', 12);

    await prisma.$executeRaw`
      INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
      VALUES ('admin', ${adminPasswordHash}, 'admin@example.com', '系统管理员', 'ADMIN', 'ACTIVE')
    `;

    await prisma.$executeRaw`
      INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
      VALUES ('editor', ${editorPasswordHash}, 'editor@example.com', '内容编辑', 'EDITOR', 'ACTIVE')
    `;

    console.log('✅ 默认用户创建完成');
    console.log('🎉 数据库迁移完成！');

  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateDatabase();
