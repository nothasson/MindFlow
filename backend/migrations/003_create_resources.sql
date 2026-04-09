CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_text TEXT NOT NULL,
    pages INT NOT NULL DEFAULT 1,
    chunk_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'parsed',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_mastery_concept ON knowledge_mastery(concept);
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_relations_active
    ON knowledge_relations(from_concept, relation_type, to_concept);
