-- Enable Row Level Security (RLS) on match_period table
-- This migration enables RLS and creates appropriate policies for match periods

-- Step 1: Enable RLS on match_period table
ALTER TABLE public.match_period ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policy if it exists (to recreate with proper configuration)
DROP POLICY IF EXISTS "mp_all_via_parent" ON public.match_period;

-- Step 3: Create policy for service role (full access for backend operations)
-- Service role bypasses RLS, but this policy ensures explicit access
CREATE POLICY "service_role_full_access"
  ON public.match_period
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 4: Create policy for authenticated users to read match periods
-- Users can read periods for:
--   - Matches they own (match.user_id = auth.uid())
--   - Anonymous matches (match.user_id IS NULL) - for viewing neutral match summaries
CREATE POLICY "authenticated_read_match_periods"
  ON public.match_period
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can view)
      )
    )
  );

-- Step 5: Create policy for authenticated users to insert match periods
-- Users can insert periods for:
--   - Matches they own (match.user_id = auth.uid())
--   - Anonymous matches (match.user_id IS NULL) - for creating periods during anonymous matches
CREATE POLICY "authenticated_insert_match_periods"
  ON public.match_period
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can create periods)
      )
    )
  );

-- Step 6: Create policy for authenticated users to update match periods
-- Users can update periods for:
--   - Matches they own (match.user_id = auth.uid())
--   - Anonymous matches (match.user_id IS NULL) - for updating periods during anonymous matches
CREATE POLICY "authenticated_update_match_periods"
  ON public.match_period
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can update periods)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can update periods)
      )
    )
  );

-- Step 7: Create policy for authenticated users to delete match periods
-- Users can delete periods for matches they own
CREATE POLICY "authenticated_delete_match_periods"
  ON public.match_period
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND m.user_id = auth.uid()  -- Only for matches they own
    )
  );

-- Step 8: Create policy for anon (unauthenticated) users to read match periods
-- Anon users can read periods for anonymous matches only
CREATE POLICY "anon_read_match_periods"
  ON public.match_period
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  );

-- Step 9: Create policy for anon (unauthenticated) users to insert match periods
-- Anon users can insert periods for anonymous matches only
CREATE POLICY "anon_insert_match_periods"
  ON public.match_period
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  );

-- Step 10: Create policy for anon (unauthenticated) users to update match periods
-- Anon users can update periods for anonymous matches only
CREATE POLICY "anon_update_match_periods"
  ON public.match_period
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_period.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  );

-- Step 11: Create indexes to improve policy performance
-- Index on match_id for faster lookups in policy checks
CREATE INDEX IF NOT EXISTS idx_match_period_match_id ON public.match_period(match_id);

-- Add comment explaining the RLS setup
COMMENT ON TABLE public.match_period IS 'Match periods with RLS enabled. Users can access periods for their own matches or anonymous matches.';

