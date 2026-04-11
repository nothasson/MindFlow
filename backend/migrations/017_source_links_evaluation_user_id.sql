-- 017_source_links_evaluation_user_id.sql
-- 给 source_links 和 llm_evaluations 表添加 user_id 列

BEGIN;

ALTER TABLE knowledge_source_links ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE llm_evaluations ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_knowledge_source_links_user_id ON knowledge_source_links(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_evaluations_user_id ON llm_evaluations(user_id) WHERE user_id IS NOT NULL;

COMMIT;
