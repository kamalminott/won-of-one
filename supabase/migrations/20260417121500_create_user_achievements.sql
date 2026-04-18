CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  tier_key text NOT NULL,
  category text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  unlock_source text NOT NULL DEFAULT 'achievement_sync',
  progress_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_achievements_unique_tier UNIQUE (user_id, achievement_key, tier_key)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON public.user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked_at
  ON public.user_achievements (user_id, unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_user_achievements" ON public.user_achievements;
CREATE POLICY "service_role_full_access_user_achievements"
  ON public.user_achievements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_user_achievements" ON public.user_achievements;
CREATE POLICY "authenticated_read_user_achievements"
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_user_achievements" ON public.user_achievements;
CREATE POLICY "authenticated_insert_user_achievements"
  ON public.user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_update_user_achievements" ON public.user_achievements;
CREATE POLICY "authenticated_update_user_achievements"
  ON public.user_achievements
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_delete_user_achievements" ON public.user_achievements;
CREATE POLICY "authenticated_delete_user_achievements"
  ON public.user_achievements
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_user_achievements_updated_at ON public.user_achievements;
CREATE TRIGGER update_user_achievements_updated_at
  BEFORE UPDATE ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_achievements IS 'Stores unlocked achievement tiers for each user.';
