-- FSRS 算法迁移：新增 FSRS 字段
ALTER TABLE knowledge_mastery
  ADD COLUMN IF NOT EXISTS stability FLOAT NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS difficulty FLOAT NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS elapsed_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reps INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state SMALLINT NOT NULL DEFAULT 0;

-- 迁移 SM-2 现有数据到 FSRS 字段
UPDATE knowledge_mastery SET
  difficulty = GREATEST(1, LEAST(10, (3.0 - easiness_factor) * 5 + 5)),
  stability = GREATEST(0.1, interval_days::FLOAT),
  reps = repetitions,
  state = CASE
    WHEN repetitions = 0 THEN 0
    WHEN interval_days <= 1 THEN 1
    ELSE 2
  END
WHERE stability = 0 AND reps = 0;
