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