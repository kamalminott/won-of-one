-- Club Competition V1 - Phase 9 (Hub archive + safe delete)
-- Adds per-user archive visibility and restricts hard deletes to registration-open competitions.

ALTER TABLE public.club_competition_participant
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS club_competition_participant_user_archived_idx
  ON public.club_competition_participant (user_id, archived_at, competition_id);

COMMENT ON COLUMN public.club_competition_participant.archived_at IS
  'Per-user archive timestamp used to hide competitions from the hub without deleting shared data.';

CREATE OR REPLACE FUNCTION public.bump_club_competition_updated_at_from_participant()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Personal hub archive toggles should not reorder the competition for every member.
    IF NEW.competition_id = OLD.competition_id
      AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name
      AND NEW.role IS NOT DISTINCT FROM OLD.role
      AND NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.archived_at IS DISTINCT FROM OLD.archived_at
    THEN
      RETURN NEW;
    END IF;
  END IF;

  UPDATE public.club_competition
  SET updated_at = now()
  WHERE id = COALESCE(NEW.competition_id, OLD.competition_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS authenticated_delete_club_competition ON public.club_competition;
CREATE POLICY authenticated_delete_club_competition
  ON public.club_competition
  FOR DELETE
  TO authenticated
  USING (
    status = 'registration_open'
    AND (
      created_by_user_id = auth.uid()
      OR public.is_club_competition_organiser(id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.archive_club_competition_for_user(
  p_competition_id uuid
)
RETURNS public.club_competition_participant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_participant public.club_competition_participant%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = v_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  IF v_participant.archived_at IS NOT NULL THEN
    RETURN v_participant;
  END IF;

  UPDATE public.club_competition_participant
  SET archived_at = now()
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_club_competition_for_user(
  p_competition_id uuid
)
RETURNS public.club_competition_participant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_participant public.club_competition_participant%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = v_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  IF v_participant.archived_at IS NULL THEN
    RETURN v_participant;
  END IF;

  UPDATE public.club_competition_participant
  SET archived_at = NULL
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_club_competition(
  p_competition_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition public.club_competition%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO v_competition
  FROM public.club_competition
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT (
    v_competition.created_by_user_id = v_actor_id
    OR public.is_club_competition_organiser(p_competition_id, v_actor_id)
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_competition.status <> 'registration_open' THEN
    RAISE EXCEPTION 'delete_only_during_registration_open';
  END IF;

  DELETE FROM public.club_competition
  WHERE id = p_competition_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_club_competition_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_club_competition_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_club_competition(uuid) TO authenticated;
