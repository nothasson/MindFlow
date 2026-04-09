-- 知识点掌握度（时间知识图谱）
CREATE TABLE IF NOT EXISTS knowledge_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept VARCHAR(200) NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.0,
    error_type VARCHAR(50),
    last_reviewed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    easiness_factor FLOAT NOT NULL DEFAULT 2.5,
    interval_days INT NOT NULL DEFAULT 0,
    repetitions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 知识点关系图（前置/后续概念）
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_concept VARCHAR(200) NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    to_concept VARCHAR(200) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_mastery_concept ON knowledge_mastery(concept);
CREATE INDEX IF NOT EXISTS idx_knowledge_mastery_next_review ON knowledge_mastery(next_review);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_from ON knowledge_relations(from_concept);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_to ON knowledge_relations(to_concept);
