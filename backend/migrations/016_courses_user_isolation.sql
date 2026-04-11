-- 016_courses_user_isolation.sql
-- 给 courses 和 course_sections 表添加 user_id 列，实现课程数据用户隔离

BEGIN;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_sections_user_id ON course_sections(user_id) WHERE user_id IS NOT NULL;

COMMIT;
