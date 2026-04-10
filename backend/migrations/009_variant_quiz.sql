-- 变式题表
CREATE TABLE IF NOT EXISTS variant_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    concept VARCHAR(200) NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    variant_type VARCHAR(30) NOT NULL,
    question TEXT NOT NULL,
    hint TEXT NOT NULL DEFAULT '',
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
    answered BOOLEAN NOT NULL DEFAULT FALSE,
    is_correct BOOLEAN,
    user_answer TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_questions_concept ON variant_questions(concept);
CREATE INDEX IF NOT EXISTS idx_variant_questions_answered ON variant_questions(answered);
