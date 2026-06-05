-- CreateTable
CREATE TABLE `automation_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `token_prefix` VARCHAR(16) NOT NULL,
    `caller_type` VARCHAR(50) NOT NULL,
    `scopes` JSON NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_by_user_id` INTEGER NULL,
    `last_used_at` TIMESTAMP(0) NULL,
    `expires_at` TIMESTAMP(0) NULL,
    `revoked_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `token_hash`(`token_hash`),
    INDEX `idx_automation_tokens_caller_type`(`caller_type`),
    INDEX `idx_automation_tokens_created_by`(`created_by_user_id`),
    INDEX `idx_automation_tokens_expires_at`(`expires_at`),
    INDEX `idx_automation_tokens_status`(`status`),
    INDEX `idx_automation_tokens_token_prefix`(`token_prefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_runs` (
    `id` VARCHAR(64) NOT NULL,
    `token_id` INTEGER NOT NULL,
    `caller_type` VARCHAR(50) NOT NULL,
    `workflow` VARCHAR(80) NOT NULL,
    `step` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(80) NULL,
    `target_id` VARCHAR(80) NULL,
    `idempotency_key` VARCHAR(160) NOT NULL,
    `request_digest` VARCHAR(128) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'running',
    `result_summary` JSON NULL,
    `error_code` VARCHAR(80) NULL,
    `error_message` VARCHAR(500) NULL,
    `external_side_effect` BOOLEAN NOT NULL DEFAULT false,
    `external_ref` VARCHAR(200) NULL,
    `started_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `finished_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `unique_automation_run_idempotency`(`token_id`, `workflow`, `step`, `idempotency_key`),
    INDEX `idx_automation_runs_started_at`(`started_at`),
    INDEX `idx_automation_runs_status`(`status`),
    INDEX `idx_automation_runs_target`(`target_type`, `target_id`),
    INDEX `idx_automation_runs_token_id`(`token_id`),
    INDEX `idx_automation_runs_workflow_step`(`workflow`, `step`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `automation_tokens` ADD CONSTRAINT `automation_tokens_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_runs` ADD CONSTRAINT `automation_runs_token_id_fkey` FOREIGN KEY (`token_id`) REFERENCES `automation_tokens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
