-- 为 contents 表新增结构化预览字段
-- 用于支持结构化数据预览，替代 Markdown 字符串解析

ALTER TABLE contents 
  ADD COLUMN image_url VARCHAR(500) AFTER source_url COMMENT '文章主图 URL',
  ADD COLUMN summary TEXT AFTER description COMMENT '内容摘要/AI 总结';

-- 添加索引以提升查询性能（可选）
-- CREATE INDEX idx_contents_image_url ON contents(image_url(255));





