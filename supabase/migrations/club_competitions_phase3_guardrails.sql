-- Club Competition V1 - Phase 3 guardrails
-- Adds server-side functions for role rules, registration lock/unlock, remove/leave, and withdrawal status updates.

CREATE OR REPLACE FUNCTION public.update_club_competition_registration_lock(
  p_competition_id uuid,
  p_locked boolean
)
RETURNS public.club_competition
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
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT public.is_club_competition_organiser(p_competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_competition.status = 'finalised' THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  IF p_locked THEN
    IF v_competition.status <> 'registration_open' THEN
      RAISE EXCEPTION 'registration_cannot_be_locked_from_current_state';
    END IF;
    UPDATE public.club_competition
    SET status = 'registration_locked'
    WHERE id = p_competition_id
    RETURNING * INTO v_competition;
  ELSE
    IF v_competition.status <> 'registration_locked' THEN
      RAISE EXCEPTION 'registration_cannot_be_unlocked_from_current_state';
    END IF;
    UPDATE public.club_competition
    SET status = 'registration_open'
    WHERE id = p_competition_id
    RETURNING * INTO v_competition;
  END IF;

  RETURN v_competition;
END;
$$;

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
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_club_competition_organiser(p_competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
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

CREATE OR REPLACE FUNCTION public.remove_club_competition_participant(
  p_competition_id uuid,
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition_status public.club_competition_status;
  v_target_role public.club_competition_role;
  v_organiser_count integer;
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

  IF v_competition_status <> 'registration_open' THEN
    RAISE EXCEPTION 'remove_only_during_registration_open';
  END IF;

  SELECT role
  INTO v_target_role
  FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  IF v_target_role = 'organiser' THEN
    SELECT COUNT(*)
    INTO v_organiser_count
    FROM public.club_competition_participant
    WHERE competition_id = p_competition_id
      AND role = 'organiser';

    IF v_organiser_count <= 1 THEN
      RAISE EXCEPTION 'cannot_remove_last_organiser';
    END IF;
  END IF;

  DELETE FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = p_target_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_club_competition(
  p_competition_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition_status public.club_competition_status;
  v_actor_role public.club_competition_role;
  v_organiser_count integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT status
  INTO v_competition_status
  FROM public.club_competition
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition_status <> 'registration_open' THEN
    RAISE EXCEPTION 'self_leave_only_during_registration_open';
  END IF;

  SELECT role
  INTO v_actor_role
  FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = v_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  IF v_actor_role = 'organiser' THEN
    SELECT COUNT(*)
    INTO v_organiser_count
    FROM public.club_competition_participant
    WHERE competition_id = p_competition_id
      AND role = 'organiser';

    IF v_organiser_count <= 1 THEN
      RAISE EXCEPTION 'cannot_leave_last_organiser';
    END IF;
  END IF;

  DELETE FROM public.club_competition_participant
  WHERE competition_id = p_competition_id
    AND user_id = v_actor_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_club_competition_participant_withdrawn(
  p_competition_id uuid,
  p_target_user_id uuid,
  p_withdrawn boolean
)
RETURNS public.club_competition_participant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition_status public.club_competition_status;
  v_target public.club_competition_participant%ROWTYPE;
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

  IF v_competition_status NOT IN ('poules_generated', 'poules_locked', 'rankings_locked', 'de_generated') THEN
    RAISE EXCEPTION 'withdraw_not_allowed_in_current_state';
  END IF;

  UPDATE public.club_competition_participant
  SET status = CASE WHEN p_withdrawn THEN 'withdrawn' ELSE 'active' END
  WHERE competition_id = p_competition_id
    AND user_id = p_target_user_id
  RETURNING * INTO v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_club_competition_registration_lock(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_competition_participant_role(uuid, uuid, public.club_competition_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_club_competition_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_club_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_competition_participant_withdrawn(uuid, uuid, boolean) TO authenticated;
