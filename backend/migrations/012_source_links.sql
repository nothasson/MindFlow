-- 知识点来源关联表：追溯知识点从哪份资料提取、在哪些测验涉及
CREATE TABLE IF NOT EXISTS knowledge_source_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept VARCHAR(200) NOT NULL,
    source_type VARCHAR(20) NOT NULL,  -- resource/conversation/quiz
    source_id UUID NOT NULL,
    page_or_position TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_links_concept ON knowledge_source_links(concept);
CREATE INDEX IF NOT EXISTS idx_source_links_source ON knowledge_source_links(source_type, source_id);
