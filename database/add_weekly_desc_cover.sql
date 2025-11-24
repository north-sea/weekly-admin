ALTER TABLE `weekly_issues`
  ADD COLUMN `desc` TEXT NULL AFTER `description`,
  ADD COLUMN `cover` VARCHAR(500) NULL AFTER `desc`;
