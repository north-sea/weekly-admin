-- inbox_scoring_baseline.sql
-- F1: Inbox AI 评分自动闭环 - Schema 变更
-- 幂等执行：scripts/migrate-db.ts 中通过 SHOW COLUMNS 检查后调用

-- 1. 状态机字段
ALTER TABLE `inbox_items`
  ADD COLUMN `scoring_status` VARCHAR(20) NULL DEFAULT 'pending';
CREATE INDEX `idx_inbox_scoring_status` ON `inbox_items`(`scoring_status`, `created_at`);

-- 2. 自动晋升标记
ALTER TABLE `contents`
  ADD COLUMN `auto_promoted` BOOLEAN NULL DEFAULT FALSE;
CREATE INDEX `idx_contents_auto_promoted` ON `contents`(`auto_promoted`, `created_at`);

-- 3. 历史已评分项标记为 done（避免被新 cron 重复评分）
UPDATE `inbox_items`
   SET `scoring_status` = 'done'
 WHERE `ai_score` IS NOT NULL;

-- 4. ai_settings seed 4 个 F1 key（如已存在不动）
INSERT INTO `ai_settings` (`key`, `value`)
VALUES
  ('inbox_promotion_threshold',                JSON_OBJECT('value', 70)),
  ('inbox_scoring_enabled',                     JSON_OBJECT('value', true)),
  ('inbox_scoring_batch_size',                  JSON_OBJECT('value', 50)),
  ('inbox_scoring_processing_timeout_minutes',  JSON_OBJECT('value', 10))
ON DUPLICATE KEY UPDATE `value` = `ai_settings`.`value`;

-- 5. ai_prompts: 无需 SQL，代码层 AiPromptService 首次访问时 create-if-missing
