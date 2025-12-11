-- Enable Row Level Security (RLS) on match_event table
-- This migration enables RLS and creates appropriate policies for match events

-- Step 1: Enable RLS on match_event table
ALTER TABLE public.match_event ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policy if it exists (to recreate with proper configuration)
DROP POLICY IF EXISTS "me_all_via_parent" ON public.match_event;

-- Step 3: Create policy for service role (full access for backend operations)
-- Service role bypasses RLS, but this policy ensures explicit access
CREATE POLICY "service_role_full_access"
  ON public.match_event
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 4: Create policy for authenticated users to read match events
-- Users can read events for:
--   - Matches they own (match.user_id = auth.uid())
--   - Anonymous matches (match.user_id IS NULL) - for viewing neutral match summaries
CREATE POLICY "authenticated_read_match_events"
  ON public.match_event
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can view)
      )
    )
  );

-- Step 5: Create policy for authenticated users to insert match events
-- Users can insert events for:
--   - Matches they own (match.user_id = auth.uid())
--   - Anonymous matches (match.user_id IS NULL) - for creating events during anonymous matches
CREATE POLICY "authenticated_insert_match_events"
  ON public.match_event
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND (
        m.user_id = auth.uid()  -- User owns the match
        OR m.user_id IS NULL     -- Anonymous match (anyone can create events)
      )
    )
  );

-- Step 6: Create policy for authenticated users to update match events
-- Users can update events for matches they own
CREATE POLICY "authenticated_update_match_events"
  ON public.match_event
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND m.user_id = auth.uid()  -- Only for matches they own
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND m.user_id = auth.uid()  -- Only for matches they own
    )
  );

-- Step 7: Create policy for authenticated users to delete match events
-- Users can delete events for matches they own
CREATE POLICY "authenticated_delete_match_events"
  ON public.match_event
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND m.user_id = auth.uid()  -- Only for matches they own
    )
  );

-- Step 8: Create policy for anon (unauthenticated) users to read match events
-- Anon users can read events for anonymous matches only
CREATE POLICY "anon_read_match_events"
  ON public.match_event
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  );

-- Step 9: Create policy for anon (unauthenticated) users to insert match events
-- Anon users can insert events for anonymous matches only
CREATE POLICY "anon_insert_match_events"
  ON public.match_event
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.match m
      WHERE m.match_id = match_event.match_id
      AND m.user_id IS NULL  -- Only anonymous matches
    )
  );

-- Step 10: Create indexes to improve policy performance
-- Index on match_id for faster lookups in policy checks
CREATE INDEX IF NOT EXISTS idx_match_event_match_id ON public.match_event(match_id);

-- Add comment explaining the RLS setup
COMMENT ON TABLE public.match_event IS 'Match events with RLS enabled. Users can access events for their own matches or anonymous matches.';




