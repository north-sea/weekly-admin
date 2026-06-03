-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `description` TEXT NULL,
    `archived` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_attributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content_id` BIGINT NOT NULL,
    `attribute_name` VARCHAR(100) NOT NULL,
    `attribute_value` TEXT NULL,
    `attribute_type` ENUM('string', 'number', 'boolean', 'json', 'date') NULL DEFAULT 'string',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_attribute_name`(`attribute_name`),
    INDEX `idx_content_id`(`content_id`),
    UNIQUE INDEX `unique_content_attribute`(`content_id`, `attribute_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_content_id` BIGINT NOT NULL,
    `target_content_id` BIGINT NOT NULL,
    `relation_type` ENUM('related', 'reference', 'series', 'parent_child', 'similar') NOT NULL,
    `relation_strength` TINYINT NULL DEFAULT 5,
    `bidirectional` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_relation_type`(`relation_type`),
    INDEX `idx_source_content_id`(`source_content_id`),
    INDEX `idx_target_content_id`(`target_content_id`),
    UNIQUE INDEX `unique_content_relation`(`source_content_id`, `target_content_id`, `relation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content_id` BIGINT NOT NULL,
    `tag_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_content_id`(`content_id`),
    INDEX `idx_tag_id`(`tag_id`),
    UNIQUE INDEX `unique_content_tag`(`content_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `slug` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `slug`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content_id` BIGINT NOT NULL,
    `version_number` INTEGER NOT NULL,
    `title` VARCHAR(500) NULL,
    `content` LONGTEXT NULL,
    `description` TEXT NULL,
    `source` VARCHAR(200) NULL,
    `source_url` VARCHAR(1000) NULL,
    `changes_summary` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_content_id`(`content_id`),
    INDEX `idx_created_by`(`created_by`),
    UNIQUE INDEX `unique_content_version`(`content_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `content_type_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `title` VARCHAR(500) NOT NULL,
    `slug` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `summary` TEXT NULL,
    `original_score` DOUBLE NULL,
    `summary_score` DOUBLE NULL,
    `ai_metadata` JSON NULL,
    `content` LONGTEXT NULL,
    `content_format` ENUM('markdown', 'mdx', 'html', 'plain') NULL DEFAULT 'mdx',
    `status` ENUM('draft', 'ready', 'published', 'archived', 'hidden') NULL DEFAULT 'draft',
    `published_at` TIMESTAMP(0) NULL,
    `meta_title` VARCHAR(500) NULL,
    `meta_description` TEXT NULL,
    `word_count` INTEGER NULL DEFAULT 0,
    `reading_time` INTEGER NULL DEFAULT 0,
    `view_count` BIGINT NULL DEFAULT 0,
    `source` VARCHAR(200) NULL,
    `source_url` VARCHAR(1000) NULL,
    `image_url` VARCHAR(500) NULL,
    `image_source` VARCHAR(50) NULL,
    `image_width` INTEGER NULL,
    `image_height` INTEGER NULL,
    `screenshot_api` ENUM('ScreenshotLayer', 'HCTI', 'manual', 'karakeep') NULL DEFAULT 'manual',
    `sort_order` INTEGER NULL DEFAULT 0,
    `featured` BOOLEAN NULL DEFAULT false,
    `collected_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_id` INTEGER NULL,

    INDEX `contents_category_id_fkey`(`category_id`),
    INDEX `idx_original_score`(`original_score`),
    INDEX `idx_summary_score`(`summary_score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `operation_type` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT') NOT NULL,
    `resource_type` VARCHAR(50) NOT NULL,
    `resource_id` VARCHAR(50) NULL,
    `operation_details` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_operation_type`(`operation_type`),
    INDEX `idx_resource_type`(`resource_type`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_resource_id`(`resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `slug` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(20) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `tag_groups_name_key`(`name`),
    UNIQUE INDEX `tag_groups_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `group_id` INTEGER NULL,
    `aliases` TEXT NULL,
    `count` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `slug`(`slug`),
    INDEX `tags_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `display_name` VARCHAR(100) NULL,
    `role` ENUM('ADMIN', 'EDITOR') NULL DEFAULT 'EDITOR',
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `last_login_at` TIMESTAMP(0) NULL,
    `login_attempts` INTEGER NULL DEFAULT 0,
    `locked_until` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_content_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `weekly_issue_id` INTEGER NOT NULL,
    `content_id` BIGINT NOT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `section` VARCHAR(100) NULL,
    `featured` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_content_id`(`content_id`),
    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_weekly_issue_id`(`weekly_issue_id`),
    UNIQUE INDEX `unique_weekly_content`(`weekly_issue_id`, `content_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_issues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issue_number` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `desc` TEXT NULL,
    `cover` VARCHAR(500) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `published_at` TIMESTAMP(0) NULL,
    `total_items` INTEGER NULL DEFAULT 0,
    `total_word_count` INTEGER NULL DEFAULT 0,
    `reading_time` INTEGER NULL DEFAULT 0,
    `status` ENUM('draft', 'published', 'archived') NULL DEFAULT 'draft',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL DEFAULT 1,
    `quail_post_id` VARCHAR(100) NULL,
    `quail_post_slug` VARCHAR(200) NULL,
    `quail_published_at` TIMESTAMP(0) NULL,
    `quail_delivered_at` TIMESTAMP(0) NULL,
    `quail_publish_error` TEXT NULL,

    UNIQUE INDEX `issue_number`(`issue_number`),
    UNIQUE INDEX `slug`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `type` ENUM('rss', 'karakeep', 'webhook', 'manual') NOT NULL,
    `config` JSON NULL,
    `enabled` BOOLEAN NULL DEFAULT true,
    `auto_promote_threshold` DOUBLE NULL,
    `sync_interval_minutes` INTEGER NULL DEFAULT 60,
    `default_category_id` INTEGER NULL,
    `default_content_type_id` INTEGER NULL,
    `last_synced_at` TIMESTAMP(0) NULL,
    `sync_count` INTEGER NULL DEFAULT 0,
    `error_count` INTEGER NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `score_weight` INTEGER NULL DEFAULT 0,
    `auto_score_override` BOOLEAN NULL,
    `total_synced` INTEGER NULL DEFAULT 0,
    `total_promoted` INTEGER NULL DEFAULT 0,
    `total_published` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `source_id` INTEGER NOT NULL,
    `source_item_id` VARCHAR(255) NULL,
    `title` TEXT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `description` TEXT NULL,
    `note` TEXT NULL,
    `summary` TEXT NULL,
    `content` LONGTEXT NULL,
    `image_url` VARCHAR(2048) NULL,
    `favicon_url` VARCHAR(500) NULL,
    `slug` VARCHAR(255) NULL,
    `source_name` VARCHAR(255) NULL,
    `ai_score` DOUBLE NULL,
    `ai_score_details` JSON NULL,
    `scoring_status` VARCHAR(20) NULL DEFAULT 'pending',
    `category_suggestion` VARCHAR(100) NULL,
    `tags_suggestion` JSON NULL,
    `summarization_status` VARCHAR(20) NULL,
    `tagging_status` VARCHAR(20) NULL,
    `similar_item_id` BIGINT NULL,
    `similarity_score` DOUBLE NULL,
    `image_status` VARCHAR(20) NULL,
    `status` ENUM('pending', 'promoted', 'rejected', 'duplicate') NULL DEFAULT 'pending',
    `priority` INTEGER NULL DEFAULT 0,
    `auto_promoted` BOOLEAN NULL DEFAULT false,
    `content_id` BIGINT NULL,
    `duplicate_of_id` BIGINT NULL,
    `source_published_at` TIMESTAMP(0) NULL,
    `collected_at` TIMESTAMP(0) NULL,
    `synced_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `inbox_items_status_idx`(`status`),
    INDEX `inbox_items_scoring_status_created_at_idx`(`scoring_status`, `created_at`),
    INDEX `inbox_items_ai_score_idx`(`ai_score`),
    INDEX `inbox_items_source_id_idx`(`source_id`),
    INDEX `inbox_items_content_id_idx`(`content_id`),
    INDEX `inbox_items_duplicate_of_id_idx`(`duplicate_of_id`),
    INDEX `inbox_items_similar_item_id_idx`(`similar_item_id`),
    INDEX `inbox_items_image_status_idx`(`image_status`),
    UNIQUE INDEX `inbox_items_source_id_source_item_id_key`(`source_id`, `source_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `provider` ENUM('openai', 'anthropic') NOT NULL DEFAULT 'openai',
    `base_url` VARCHAR(500) NOT NULL,
    `api_key_encrypted` TEXT NOT NULL,
    `text_model` VARCHAR(100) NOT NULL,
    `image_model` VARCHAR(100) NULL,
    `is_default` BOOLEAN NULL DEFAULT false,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ai_configs_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_prompts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scene` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `prompt` TEXT NOT NULL,
    `variables` JSON NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ai_prompts_scene_key`(`scene`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `content_tags` ADD CONSTRAINT `content_tags_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_tags` ADD CONSTRAINT `content_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contents` ADD CONSTRAINT `contents_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `tag_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_content_items` ADD CONSTRAINT `weekly_content_items_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_content_items` ADD CONSTRAINT `weekly_content_items_weekly_issue_id_fkey` FOREIGN KEY (`weekly_issue_id`) REFERENCES `weekly_issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_sources` ADD CONSTRAINT `data_sources_default_category_id_fkey` FOREIGN KEY (`default_category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_items` ADD CONSTRAINT `inbox_items_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_items` ADD CONSTRAINT `inbox_items_content_id_fkey` FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_items` ADD CONSTRAINT `inbox_items_duplicate_of_id_fkey` FOREIGN KEY (`duplicate_of_id`) REFERENCES `inbox_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_items` ADD CONSTRAINT `inbox_items_similar_item_id_fkey` FOREIGN KEY (`similar_item_id`) REFERENCES `inbox_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
