-- SafeScribe Schema Modification for Zero-Knowledge Protected Notes
-- Run this migration in your Supabase SQL Editor.

-- 1. Add zero-knowledge encryption columns to the notes table
ALTER TABLE notes 
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
  ADD COLUMN IF NOT EXISTS salt TEXT,
  ADD COLUMN IF NOT EXISTS iv TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_pin TEXT,
  ADD COLUMN IF NOT EXISTS recovery_salt TEXT,
  ADD COLUMN IF NOT EXISTS recovery_iv TEXT;

-- 2. Drop the old plaintext protection_pin column if desired
-- ALTER TABLE notes DROP COLUMN IF EXISTS protection_pin;

-- 3. Verify columns were added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notes';
