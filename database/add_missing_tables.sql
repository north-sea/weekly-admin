-- 添加用户表
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
);

-- 添加操作日志表
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
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 添加内容版本表
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
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 为 contents 表添加 user_id 字段（如果不存在）
-- 为 contents 表添加 user_id 字段（如果不存在）
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS user_id INT,
ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- 为 weekly_issues 表添加 created_by 字段（如果不存在）
ALTER TABLE weekly_issues 
ADD COLUMN IF NOT EXISTS created_by INT DEFAULT 1,
ADD FOREIGN KEY (created_by) REFERENCES users(id);

-- 插入默认管理员用户
INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
VALUES ('admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9qm', 'admin@example.com', '系统管理员', 'ADMIN', 'ACTIVE');

-- 插入默认编辑用户
INSERT IGNORE INTO users (username, password_hash, email, display_name, role, status) 
VALUES ('editor', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'editor@example.com', '内容编辑', 'EDITOR', 'ACTIVE');