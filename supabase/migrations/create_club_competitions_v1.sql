-- Club Competition V1 (Competitions tab)
-- Adds multi-user competition entities separate from the legacy personal `competition` table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_format') THEN
    CREATE TYPE public.club_competition_format AS ENUM (
      'poules_only',
      'poules_then_de',
      'de_only'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_status') THEN
    CREATE TYPE public.club_competition_status AS ENUM (
      'registration_open',
      'registration_locked',
      'poules_generated',
      'poules_locked',
      'rankings_locked',
      'de_generated',
      'finalised'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_role') THEN
    CREATE TYPE public.club_competition_role AS ENUM (
      'organiser',
      'participant'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_participant_status') THEN
    CREATE TYPE public.club_competition_participant_status AS ENUM (
      'active',
      'withdrawn',
      'dns'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.club_competition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  weapon text NOT NULL CHECK (weapon IN ('foil', 'epee', 'sabre')),
  format public.club_competition_format NOT NULL,
  de_touch_limit smallint NOT NULL CHECK (de_touch_limit IN (10, 15)),
  status public.club_competition_status NOT NULL DEFAULT 'registration_open',
  join_code text NOT NULL CHECK (join_code ~ '^[0-9]{6}$'),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalised_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.club_competition_participant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.club_competition(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role public.club_competition_role NOT NULL DEFAULT 'participant',
  status public.club_competition_participant_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS club_competition_active_join_code_unique
  ON public.club_competition (join_code)
  WHERE status <> 'finalised';

CREATE INDEX IF NOT EXISTS club_competition_status_updated_idx
  ON public.club_competition (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS club_competition_participant_competition_idx
  ON public.club_competition_participant (competition_id);

CREATE INDEX IF NOT EXISTS club_competition_participant_user_idx
  ON public.club_competition_participant (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_club_competition_updated_at ON public.club_competition;
CREATE TRIGGER update_club_competition_updated_at
  BEFORE UPDATE ON public.club_competition
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_competition_participant_updated_at ON public.club_competition_participant;
CREATE TRIGGER update_club_competition_participant_updated_at
  BEFORE UPDATE ON public.club_competition_participant
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.bump_club_competition_updated_at_from_participant()
RETURNS trigger AS $$
BEGIN
  UPDATE public.club_competition
    SET updated_at = now()
    WHERE id = COALESCE(NEW.competition_id, OLD.competition_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bump_club_competition_updated_at_on_participant_insert ON public.club_competition_participant;
CREATE TRIGGER bump_club_competition_updated_at_on_participant_insert
  AFTER INSERT ON public.club_competition_participant
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_club_competition_updated_at_from_participant();

DROP TRIGGER IF EXISTS bump_club_competition_updated_at_on_participant_update ON public.club_competition_participant;
CREATE TRIGGER bump_club_competition_updated_at_on_participant_update
  AFTER UPDATE ON public.club_competition_participant
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_club_competition_updated_at_from_participant();

DROP TRIGGER IF EXISTS bump_club_competition_updated_at_on_participant_delete ON public.club_competition_participant;
CREATE TRIGGER bump_club_competition_updated_at_on_participant_delete
  AFTER DELETE ON public.club_competition_participant
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_club_competition_updated_at_from_participant();

CREATE OR REPLACE FUNCTION public.is_club_competition_member(
  p_competition_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_competition_participant p
    WHERE p.competition_id = p_competition_id
      AND p.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_competition_organiser(
  p_competition_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_competition_participant p
    WHERE p.competition_id = p_competition_id
      AND p.user_id = p_user_id
      AND p.role = 'organiser'
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_club_competition_for_join(
  p_join_code text,
  p_competition_id uuid DEFAULT NULL
)
RETURNS SETOF public.club_competition
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      c.*,
      CASE WHEN c.status = 'finalised' THEN 1 ELSE 0 END AS finalised_rank
    FROM public.club_competition c
    WHERE (
      p_competition_id IS NULL
      AND c.join_code = p_join_code
    )
    OR (
      p_competition_id IS NOT NULL
      AND c.id = p_competition_id
      AND c.join_code = p_join_code
    )
  )
  SELECT
    id,
    name,
    weapon,
    format,
    de_touch_limit,
    status,
    join_code,
    created_by_user_id,
    created_at,
    updated_at,
    finalised_at
  FROM ranked
  ORDER BY finalised_rank ASC, updated_at DESC, finalised_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_club_competition_for_join(text, uuid) TO authenticated;

ALTER TABLE public.club_competition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_competition_participant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_access_club_competition ON public.club_competition;
CREATE POLICY service_role_full_access_club_competition
  ON public.club_competition
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_competition ON public.club_competition;
CREATE POLICY authenticated_select_club_competition
  ON public.club_competition
  FOR SELECT
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR public.is_club_competition_member(id, auth.uid())
  );

DROP POLICY IF EXISTS authenticated_insert_club_competition ON public.club_competition;
CREATE POLICY authenticated_insert_club_competition
  ON public.club_competition
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS authenticated_update_club_competition ON public.club_competition;
CREATE POLICY authenticated_update_club_competition
  ON public.club_competition
  FOR UPDATE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR public.is_club_competition_organiser(id, auth.uid())
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    OR public.is_club_competition_organiser(id, auth.uid())
  );

DROP POLICY IF EXISTS authenticated_delete_club_competition ON public.club_competition;
CREATE POLICY authenticated_delete_club_competition
  ON public.club_competition
  FOR DELETE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR public.is_club_competition_organiser(id, auth.uid())
  );

DROP POLICY IF EXISTS service_role_full_access_club_competition_participant ON public.club_competition_participant;
CREATE POLICY service_role_full_access_club_competition_participant
  ON public.club_competition_participant
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_competition_participant ON public.club_competition_participant;
CREATE POLICY authenticated_select_club_competition_participant
  ON public.club_competition_participant
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

DROP POLICY IF EXISTS authenticated_insert_club_competition_participant ON public.club_competition_participant;
CREATE POLICY authenticated_insert_club_competition_participant
  ON public.club_competition_participant
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (
        role = 'organiser'
        AND EXISTS (
          SELECT 1
          FROM public.club_competition c
          WHERE c.id = competition_id
            AND c.created_by_user_id = auth.uid()
        )
      )
      OR (
        role = 'participant'
        AND EXISTS (
          SELECT 1
          FROM public.club_competition c
          WHERE c.id = competition_id
            AND c.status IN ('registration_open', 'finalised')
        )
      )
    )
  );

DROP POLICY IF EXISTS authenticated_update_club_competition_participant ON public.club_competition_participant;
CREATE POLICY authenticated_update_club_competition_participant
  ON public.club_competition_participant
  FOR UPDATE
  TO authenticated
  USING (public.is_club_competition_organiser(competition_id, auth.uid()))
  WITH CHECK (public.is_club_competition_organiser(competition_id, auth.uid()));

DROP POLICY IF EXISTS authenticated_delete_club_competition_participant ON public.club_competition_participant;
CREATE POLICY authenticated_delete_club_competition_participant
  ON public.club_competition_participant
  FOR DELETE
  TO authenticated
  USING (
    public.is_club_competition_organiser(competition_id, auth.uid())
    OR user_id = auth.uid()
  );

COMMENT ON TABLE public.club_competition IS 'Club-run competition container for the Competitions tab V1.';
COMMENT ON TABLE public.club_competition_participant IS 'Participants and organiser roles for club competitions.';
