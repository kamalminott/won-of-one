-- Enable Row Level Security (RLS) on user-scoped tables
-- These tables contain user-specific data that should be restricted to the owning user

-- ============================================
-- MATCH_APPROVAL TABLE
-- ============================================
ALTER TABLE public.match_approval ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_match_approval"
  ON public.match_approval
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own approvals
CREATE POLICY "authenticated_read_match_approvals"
  ON public.match_approval
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()  -- User owns the approval
  );

-- Authenticated users can insert their own approvals
CREATE POLICY "authenticated_insert_match_approvals"
  ON public.match_approval
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()  -- User owns the approval
  );

-- Authenticated users can update their own approvals
CREATE POLICY "authenticated_update_match_approvals"
  ON public.match_approval
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Only their own approvals
  )
  WITH CHECK (
    user_id = auth.uid()  -- Only their own approvals
  );

-- Authenticated users can delete their own approvals
CREATE POLICY "authenticated_delete_match_approvals"
  ON public.match_approval
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Only their own approvals
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_match_approval_user_id ON public.match_approval(user_id);

-- ============================================
-- WEEKLY_COMPLETION_HISTORY TABLE
-- ============================================
ALTER TABLE public.weekly_completion_history ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_weekly_completion"
  ON public.weekly_completion_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own completion history
CREATE POLICY "authenticated_read_weekly_completion_history"
  ON public.weekly_completion_history
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()  -- User owns the history
  );

-- Authenticated users can insert their own completion history
CREATE POLICY "authenticated_insert_weekly_completion_history"
  ON public.weekly_completion_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()  -- User owns the history
  );

-- Authenticated users can update their own completion history
CREATE POLICY "authenticated_update_weekly_completion_history"
  ON public.weekly_completion_history
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Only their own history
  )
  WITH CHECK (
    user_id = auth.uid()  -- Only their own history
  );

-- Authenticated users can delete their own completion history
CREATE POLICY "authenticated_delete_weekly_completion_history"
  ON public.weekly_completion_history
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Only their own history
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_weekly_completion_history_user_id ON public.weekly_completion_history(user_id);

-- Add comments
COMMENT ON TABLE public.match_approval IS 'Match approvals with RLS enabled. Users can only access their own approvals.';
COMMENT ON TABLE public.weekly_completion_history IS 'Weekly completion history with RLS enabled. Users can only access their own history.';

