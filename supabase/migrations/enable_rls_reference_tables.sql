-- Enable Row Level Security (RLS) on reference/catalog tables
-- These tables contain shared reference data (drills, equipment, mindset resources)
-- All authenticated users can read, but only service role can modify

-- ============================================
-- DRILL TABLE
-- ============================================
ALTER TABLE public.drill ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read drills (reference data)
CREATE POLICY "authenticated_read_drills"
  ON public.drill
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can also read drills (for public catalog)
CREATE POLICY "anon_read_drills"
  ON public.drill
  FOR SELECT
  TO anon
  USING (true);

-- Only service role can insert/update/delete drills
CREATE POLICY "service_role_manage_drills"
  ON public.drill
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- EQUIPMENT TABLE
-- ============================================
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read equipment (reference data)
CREATE POLICY "authenticated_read_equipment"
  ON public.equipment
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can also read equipment (for public catalog)
CREATE POLICY "anon_read_equipment"
  ON public.equipment
  FOR SELECT
  TO anon
  USING (true);

-- Only service role can insert/update/delete equipment
CREATE POLICY "service_role_manage_equipment"
  ON public.equipment
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- MINDSET_TOOL TABLE
-- ============================================
ALTER TABLE public.mindset_tool ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read mindset tools (reference data)
CREATE POLICY "authenticated_read_mindset_tools"
  ON public.mindset_tool
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can also read mindset tools (for public catalog)
CREATE POLICY "anon_read_mindset_tools"
  ON public.mindset_tool
  FOR SELECT
  TO anon
  USING (true);

-- Only service role can insert/update/delete mindset tools
CREATE POLICY "service_role_manage_mindset_tools"
  ON public.mindset_tool
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- MINDSET_RESOURCE TABLE
-- ============================================
ALTER TABLE public.mindset_resource ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read mindset resources (reference data)
CREATE POLICY "authenticated_read_mindset_resources"
  ON public.mindset_resource
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can also read mindset resources (for public catalog)
CREATE POLICY "anon_read_mindset_resources"
  ON public.mindset_resource
  FOR SELECT
  TO anon
  USING (true);

-- Only service role can insert/update/delete mindset resources
CREATE POLICY "service_role_manage_mindset_resources"
  ON public.mindset_resource
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.drill IS 'Drill catalog with RLS enabled. Public read access, service role only for modifications.';
COMMENT ON TABLE public.equipment IS 'Equipment catalog with RLS enabled. Public read access, service role only for modifications.';
COMMENT ON TABLE public.mindset_tool IS 'Mindset tools catalog with RLS enabled. Public read access, service role only for modifications.';
COMMENT ON TABLE public.mindset_resource IS 'Mindset resources catalog with RLS enabled. Public read access, service role only for modifications.';




