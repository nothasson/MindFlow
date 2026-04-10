-- 测验记录表
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    score INT NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 错题本
CREATE TABLE IF NOT EXISTS wrong_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    concept VARCHAR(200) NOT NULL DEFAULT '',
    error_type VARCHAR(50) NOT NULL DEFAULT '',
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    review_count INT NOT NULL DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_course_id ON quiz_attempts(course_id);
CREATE INDEX IF NOT EXISTS idx_wrong_book_reviewed ON wrong_book(reviewed, next_review);
