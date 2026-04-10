CREATE TABLE IF NOT EXISTS exam_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    exam_date DATE NOT NULL,
    concepts TEXT[] NOT NULL DEFAULT '{}',
    acceleration_factor FLOAT NOT NULL DEFAULT 1.5,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
