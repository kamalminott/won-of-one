-- Enable Row Level Security (RLS) on routine tables
-- These tables link users to drills/equipment in their routines
-- If they have user_id, they're user-scoped; otherwise they're reference data

-- ============================================
-- ROUTINE_DRILL TABLE
-- ============================================
ALTER TABLE public.routine_drill ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_routine_drill"
  ON public.routine_drill
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Check if routine_drill has user_id column
-- If it does, create user-scoped policies; if not, create reference table policies
DO $$
BEGIN
  -- Check if user_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'routine_drill' 
    AND column_name = 'user_id'
  ) THEN
    -- User-scoped: users can only access their own routine drills
    EXECUTE 'CREATE POLICY "authenticated_read_routine_drills"
      ON public.routine_drill
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_insert_routine_drills"
      ON public.routine_drill
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_update_routine_drills"
      ON public.routine_drill
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_delete_routine_drills"
      ON public.routine_drill
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid())';

    -- Create index if user_id exists
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_routine_drill_user_id ON public.routine_drill(user_id)';
  ELSE
    -- Reference table: public read, service role only for modifications
    EXECUTE 'CREATE POLICY "authenticated_read_routine_drills"
      ON public.routine_drill
      FOR SELECT
      TO authenticated
      USING (true)';

    EXECUTE 'CREATE POLICY "anon_read_routine_drills"
      ON public.routine_drill
      FOR SELECT
      TO anon
      USING (true)';
  END IF;
END $$;

-- ============================================
-- ROUTINE_EQUIPMENT TABLE
-- ============================================
ALTER TABLE public.routine_equipment ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_routine_equipment"
  ON public.routine_equipment
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Check if routine_equipment has user_id column
DO $$
BEGIN
  -- Check if user_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'routine_equipment' 
    AND column_name = 'user_id'
  ) THEN
    -- User-scoped: users can only access their own routine equipment
    EXECUTE 'CREATE POLICY "authenticated_read_routine_equipment"
      ON public.routine_equipment
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_insert_routine_equipment"
      ON public.routine_equipment
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_update_routine_equipment"
      ON public.routine_equipment
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "authenticated_delete_routine_equipment"
      ON public.routine_equipment
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid())';

    -- Create index if user_id exists
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_routine_equipment_user_id ON public.routine_equipment(user_id)';
  ELSE
    -- Reference table: public read, service role only for modifications
    EXECUTE 'CREATE POLICY "authenticated_read_routine_equipment"
      ON public.routine_equipment
      FOR SELECT
      TO authenticated
      USING (true)';

    EXECUTE 'CREATE POLICY "anon_read_routine_equipment"
      ON public.routine_equipment
      FOR SELECT
      TO anon
      USING (true)';
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.routine_drill IS 'Routine drills with RLS enabled. Access depends on table structure (user-scoped if user_id exists, reference table otherwise).';
COMMENT ON TABLE public.routine_equipment IS 'Routine equipment with RLS enabled. Access depends on table structure (user-scoped if user_id exists, reference table otherwise).';

