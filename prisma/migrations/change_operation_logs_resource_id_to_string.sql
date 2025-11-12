-- Migration: change_operation_logs_resource_id_to_string
-- Description: Change resource_id from INT to VARCHAR(50) to support BigInt content IDs

-- Step 1: Modify column type
ALTER TABLE `operation_logs` MODIFY COLUMN `resource_id` VARCHAR(50) NULL;

-- Step 2: Add index for faster queries by resource_id
CREATE INDEX `idx_resource_id` ON `operation_logs`(`resource_id`);
