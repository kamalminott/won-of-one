-- Enable Row Level Security (RLS) on fencing_remote table
-- This migration enables RLS and creates appropriate policies for fencing remote sessions

-- Step 1: Enable RLS on fencing_remote table
ALTER TABLE public.fencing_remote ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy for service role (full access for backend operations)
-- Service role bypasses RLS, but this policy ensures explicit access
CREATE POLICY "service_role_full_access"
  ON public.fencing_remote
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 3: Create policy for authenticated users to read their own remote sessions
-- Users can read sessions where they are the referee (referee_id = auth.uid())
-- OR sessions with no referee (anonymous matches - for viewing neutral match summaries)
CREATE POLICY "authenticated_read_fencing_remote"
  ON public.fencing_remote
  FOR SELECT
  TO authenticated
  USING (
    referee_id = auth.uid()  -- User is the referee
    OR referee_id IS NULL     -- Anonymous session (anyone can view)
  );

-- Step 4: Create policy for authenticated users to insert remote sessions
-- Users can create sessions where they are the referee
-- OR sessions with no referee (anonymous matches)
CREATE POLICY "authenticated_insert_fencing_remote"
  ON public.fencing_remote
  FOR INSERT
  TO authenticated
  WITH CHECK (
    referee_id = auth.uid()  -- User is the referee
    OR referee_id IS NULL     -- Anonymous session (anyone can create)
  );

-- Step 5: Create policy for authenticated users to update remote sessions
-- Users can update sessions where they are the referee
CREATE POLICY "authenticated_update_fencing_remote"
  ON public.fencing_remote
  FOR UPDATE
  TO authenticated
  USING (
    referee_id = auth.uid()  -- Only sessions where user is the referee
  )
  WITH CHECK (
    referee_id = auth.uid()  -- Only sessions where user is the referee
  );

-- Step 6: Create policy for authenticated users to delete remote sessions
-- Users can delete sessions where they are the referee
CREATE POLICY "authenticated_delete_fencing_remote"
  ON public.fencing_remote
  FOR DELETE
  TO authenticated
  USING (
    referee_id = auth.uid()  -- Only sessions where user is the referee
  );

-- Step 7: Create policy for anon (unauthenticated) users to read remote sessions
-- Anon users can read anonymous sessions only (where referee_id IS NULL)
CREATE POLICY "anon_read_fencing_remote"
  ON public.fencing_remote
  FOR SELECT
  TO anon
  USING (
    referee_id IS NULL  -- Only anonymous sessions
  );

-- Step 8: Create policy for anon (unauthenticated) users to insert remote sessions
-- Anon users can create anonymous sessions only (must set referee_id to NULL)
CREATE POLICY "anon_insert_fencing_remote"
  ON public.fencing_remote
  FOR INSERT
  TO anon
  WITH CHECK (
    referee_id IS NULL  -- Only anonymous sessions
  );

-- Step 9: Create indexes to improve policy performance
-- Index on referee_id for faster lookups in policy checks
CREATE INDEX IF NOT EXISTS idx_fencing_remote_referee_id ON public.fencing_remote(referee_id);

-- Add comment explaining the RLS setup
COMMENT ON TABLE public.fencing_remote IS 'Fencing remote sessions with RLS enabled. Users can access sessions where they are the referee or anonymous sessions.';




