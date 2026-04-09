ALTER TABLE resources
    ADD COLUMN IF NOT EXISTS source_url TEXT;
