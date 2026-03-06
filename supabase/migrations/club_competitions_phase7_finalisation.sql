-- Club Competition V1 - Phase 7 (Finalisation + Read-only freeze guardrails)
-- Adds organiser finalisation action and hard server-side freeze rules.

CREATE OR REPLACE FUNCTION public.finalise_club_competition(
  p_competition_id uuid
)
RETURNS public.club_competition
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition public.club_competition%ROWTYPE;
  v_pending_count integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_club_competition_organiser(p_competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT *
  INTO v_competition
  FROM public.club_competition
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition.status = 'finalised' THEN
    RETURN v_competition;
  END IF;

  IF v_competition.format = 'poules_only' THEN
    IF v_competition.status <> 'rankings_locked' THEN
      RAISE EXCEPTION 'competition_not_ready_for_finalise';
    END IF;

    SELECT COUNT(*)
    INTO v_pending_count
    FROM public.club_competition_match m
    WHERE m.competition_id = p_competition_id
      AND m.stage = 'poule'
      AND m.status IN ('pending', 'live');

    IF v_pending_count > 0 THEN
      RAISE EXCEPTION 'poule_matches_incomplete';
    END IF;
  ELSE
    IF v_competition.status <> 'de_generated' THEN
      RAISE EXCEPTION 'competition_not_ready_for_finalise';
    END IF;

    SELECT COUNT(*)
    INTO v_pending_count
    FROM public.club_competition_match m
    WHERE m.competition_id = p_competition_id
      AND m.stage = 'de'
      AND m.status IN ('pending', 'live');

    IF v_pending_count > 0 THEN
      RAISE EXCEPTION 'de_matches_incomplete';
    END IF;
  END IF;

  UPDATE public.club_competition
  SET status = 'finalised',
      finalised_at = COALESCE(finalised_at, now())
  WHERE id = p_competition_id
  RETURNING * INTO v_competition;

  RETURN v_competition;
END;
$$;

-- Freeze participant role changes once competition is finalised.
CREATE OR REPLACE FUNCTION public.update_club_competition_participant_role(
  p_competition_id uuid,
  p_target_user_id uuid,
  p_new_role public.club_competition_role
)
RETURNS public.club_competition_participant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_participant public.club_competition_participant%ROWTYPE;
  v_organiser_count integer;
  v_competition_status public.club_competition_status;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_club_competition_organiser(p_competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT status
  INTO v_competition_status
  FROM public.club_competition
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition_status = 'finalised' THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  SELECT *
  INTO v_target_participant
  FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  IF v_target_participant.role = p_new_role THEN
    RETURN v_target_participant;
  END IF;

  IF v_target_participant.role = 'organiser' AND p_new_role = 'participant' THEN
    SELECT COUNT(*)
    INTO v_organiser_count
    FROM public.club_competition_participant
    WHERE competition_id = p_competition_id
      AND role = 'organiser';

    IF v_organiser_count <= 1 THEN
      RAISE EXCEPTION 'cannot_demote_last_organiser';
    END IF;
  END IF;

  UPDATE public.club_competition_participant
  SET role = p_new_role
  WHERE id = v_target_participant.id
  RETURNING * INTO v_target_participant;

  RETURN v_target_participant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalise_club_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_competition_participant_role(uuid, uuid, public.club_competition_role) TO authenticated;
