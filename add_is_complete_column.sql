-- Add is_complete column to weekly_target table
-- This column tracks whether a weekly target has been completed

ALTER TABLE weekly_target 
ADD COLUMN is_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Add a comment to document the column purpose
COMMENT ON COLUMN weekly_target.is_complete IS 'Tracks whether the weekly target has been completed by the user';

-- Optional: Create an index for better query performance on completion status
CREATE INDEX idx_weekly_target_is_complete ON weekly_target(is_complete);

-- Optional: Create a composite index for user + completion status queries
CREATE INDEX idx_weekly_target_user_complete ON weekly_target(user_id, is_complete);

-- Verify the column was added successfully
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'weekly_target' 
    AND column_name = 'is_complete';
