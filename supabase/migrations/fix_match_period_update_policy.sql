-- Fix match_period update policy to allow updates for anonymous matches
-- This fixes the PGRST116 error when updating match periods for anonymous matches
-- Run this if you've already applied enable_rls_match_period.sql

-- Drop the existing update policy
DROP POLICY IF EXISTS "authenticated_update_match_periods" ON public.match_period;

-- Recreate the update policy to allow updates for both owned matches and anonymous matches
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

-- Add update policy for anon users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_period' 
    AND policyname = 'anon_update_match_periods'
  ) THEN
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
  END IF;
END $$;




