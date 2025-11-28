-- Migration: Fix event_id column type in match table
-- Change event_id from text to uuid to properly reference fencing events

-- First, check if the column exists and what type it currently is
DO $$
BEGIN
  -- Check if event_id column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'match' 
    AND column_name = 'event_id'
  ) THEN
    -- Check current data type
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'match' 
      AND column_name = 'event_id'
      AND data_type = 'text'
    ) THEN
      -- Convert text to uuid
      -- First, set any invalid UUID strings to NULL (handles empty strings, invalid formats, etc.)
      UPDATE match 
      SET event_id = NULL 
      WHERE event_id IS NOT NULL 
      AND (
        event_id = '' 
        OR event_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      );
      
      -- Alter column type from text to uuid
      -- NULL values are preserved, valid UUID strings are converted
      ALTER TABLE match 
      ALTER COLUMN event_id TYPE uuid 
      USING CASE 
        WHEN event_id IS NULL THEN NULL
        WHEN event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN event_id::uuid
        ELSE NULL
      END;
      
      RAISE NOTICE 'Successfully converted event_id from text to uuid';
    ELSIF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'match' 
      AND column_name = 'event_id'
      AND data_type = 'uuid'
    ) THEN
      RAISE NOTICE 'event_id is already uuid type, no changes needed';
    ELSE
      RAISE NOTICE 'event_id exists but is not text or uuid type: %', (
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'match' 
        AND column_name = 'event_id'
      );
    END IF;
  ELSE
    RAISE NOTICE 'event_id column does not exist in match table';
  END IF;
END $$;

-- Note: Foreign key constraint can be added later when fencing_event table is created
-- Example:
-- ALTER TABLE match 
-- ADD CONSTRAINT match_event_id_fkey 
-- FOREIGN KEY (event_id) REFERENCES fencing_event(event_id);

