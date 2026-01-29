-- Create competition table and add competition fields to match

-- ================================
-- 1) Enum types
-- ================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_type') THEN
    CREATE TYPE public.competition_type AS ENUM ('WorldCup', 'GrandPrix', 'National', 'Open', 'Other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_phase') THEN
    CREATE TYPE public.match_phase AS ENUM ('POULE', 'DE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_de_round') THEN
    CREATE TYPE public.match_de_round AS ENUM ('L256', 'L128', 'L64', 'L32', 'L16', 'QF', 'SF', 'F');
  END IF;
END $$;

-- ================================
-- 2) Competition table
-- ================================
CREATE TABLE IF NOT EXISTS public.competition (
  competition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  event_date date NOT NULL,
  weapon_type text NOT NULL,
  type public.competition_type NOT NULL DEFAULT 'Other',
  type_label text,
  pre_competition_notes text,
  post_competition_notes text,
  placement integer,
  field_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_weapon_type_check') THEN
    ALTER TABLE public.competition
      ADD CONSTRAINT competition_weapon_type_check
        CHECK (weapon_type IN ('foil', 'epee', 'sabre'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_type_label_check') THEN
    ALTER TABLE public.competition
      ADD CONSTRAINT competition_type_label_check
        CHECK (type = 'Other' OR type_label IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_field_size_check') THEN
    ALTER TABLE public.competition
      ADD CONSTRAINT competition_field_size_check
        CHECK (field_size IS NULL OR field_size > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_placement_check') THEN
    ALTER TABLE public.competition
      ADD CONSTRAINT competition_placement_check
        CHECK (placement IS NULL OR placement >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_placement_field_size_check') THEN
    ALTER TABLE public.competition
      ADD CONSTRAINT competition_placement_field_size_check
        CHECK (
          placement IS NULL
          OR field_size IS NULL
          OR placement <= field_size
        );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS competition_unique_user_date_weapon_name
  ON public.competition (user_id, normalized_name, event_date, weapon_type);

CREATE INDEX IF NOT EXISTS competition_user_date_idx
  ON public.competition (user_id, event_date DESC);

-- ================================
-- 3) RLS policies for competition
-- ================================
ALTER TABLE public.competition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_competition" ON public.competition;
CREATE POLICY "service_role_full_access_competition"
  ON public.competition
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_competitions" ON public.competition;
CREATE POLICY "authenticated_read_competitions"
  ON public.competition
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_competitions" ON public.competition;
CREATE POLICY "authenticated_insert_competitions"
  ON public.competition
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_update_competitions" ON public.competition;
CREATE POLICY "authenticated_update_competitions"
  ON public.competition
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_delete_competitions" ON public.competition;
CREATE POLICY "authenticated_delete_competitions"
  ON public.competition
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ================================
-- 4) Add match columns
-- ================================
ALTER TABLE public.match
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competition(competition_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase public.match_phase,
  ADD COLUMN IF NOT EXISTS de_round public.match_de_round;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_competition_phase_check') THEN
    ALTER TABLE public.match
      ADD CONSTRAINT match_competition_phase_check
        CHECK (
          (competition_id IS NULL AND phase IS NULL AND de_round IS NULL)
          OR (
            competition_id IS NOT NULL
            AND phase IS NOT NULL
            AND (phase <> 'DE' OR de_round IS NOT NULL)
          )
        );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_competition_match_type_check') THEN
    ALTER TABLE public.match
      ADD CONSTRAINT match_competition_match_type_check
        CHECK (competition_id IS NULL OR match_type = 'competition');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS match_competition_id_idx
  ON public.match (competition_id);

COMMENT ON TABLE public.competition IS 'Competition container for grouping matches (single-weapon, per user per date).';
