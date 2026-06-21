-- SafeScribe Database Migration Steps

-- STEP 1: Run this immediately to allow safe background migration without NOT NULL constraint failures.
-- (This drops the NOT NULL constraint on the legacy 'title' column).
ALTER TABLE notes ALTER COLUMN title DROP NOT NULL;

-- STEP 2: Verify migration progress. Once this query returns 0, all notes have been successfully encrypted client-side!
-- SELECT COUNT(*) FROM notes WHERE encrypted_title IS NULL;

-- STEP 3: Clean up legacy plaintext columns. Run this ONLY after confirming all notes are successfully migrated (i.e. STEP 2 returns 0).
ALTER TABLE notes DROP COLUMN IF EXISTS title;
ALTER TABLE notes DROP COLUMN IF EXISTS content;

-- STEP 4: Verify the updated schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notes';
