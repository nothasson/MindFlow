-- 014: 多用户数据隔离
-- 给核心表添加 user_id 字段（可空，兼容无登录使用）

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE knowledge_mastery ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE wrong_book ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE exam_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_mastery(user_id);
