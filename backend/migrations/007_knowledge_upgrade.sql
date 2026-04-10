-- 知识点增强：布鲁姆认知层级、重要性权重、粒度级别、描述
ALTER TABLE knowledge_mastery
  ADD COLUMN IF NOT EXISTS bloom_level VARCHAR(20) NOT NULL DEFAULT 'remember',
  ADD COLUMN IF NOT EXISTS importance FLOAT NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS granularity_level SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- 知识关系增强：关联强度
ALTER TABLE knowledge_relations
  ADD COLUMN IF NOT EXISTS strength FLOAT NOT NULL DEFAULT 0.5;
