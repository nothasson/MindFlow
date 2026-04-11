-- 015: LLM 评估体系
-- 追踪对话质量和诊断准确率

CREATE TABLE IF NOT EXISTS llm_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_type VARCHAR(50) NOT NULL,  -- 'chat_quality' / 'diagnostic_accuracy' / 'quiz_quality'
    conversation_id UUID,
    score FLOAT NOT NULL,            -- 0.0 - 1.0
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_eval_type ON llm_evaluations(eval_type);
