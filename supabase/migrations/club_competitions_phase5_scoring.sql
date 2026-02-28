-- Club Competition V1 - Phase 5 (Scoring Mode + Manual/Remote Match Completion)
-- Adds scoring RPCs for mode preparation, authoritative remote control, live score updates,
-- and match completion validation.

CREATE OR REPLACE FUNCTION public.prepare_club_competition_match_scoring(
  p_match_id uuid,
  p_mode text,
  p_take_over boolean DEFAULT false
)
RETURNS public.club_competition_match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_match public.club_competition_match%ROWTYPE;
  v_competition_status public.club_competition_status;
  v_is_organiser boolean := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_mode NOT IN ('remote', 'manual') THEN
    RAISE EXCEPTION 'invalid_scoring_mode';
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  SELECT c.status
  INTO v_competition_status
  FROM public.club_competition c
  WHERE c.id = v_match.competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT public.is_club_competition_member(v_match.competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_competition_status = 'finalised' THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  IF v_match.status IN ('completed', 'canceled_withdrawal', 'annulled_withdrawal') THEN
    RAISE EXCEPTION 'match_not_editable';
  END IF;

  v_is_organiser := public.is_club_competition_organiser(v_match.competition_id, v_actor_id);

  IF v_match.status = 'live' AND v_match.scoring_mode IS NOT NULL AND v_match.scoring_mode <> p_mode THEN
    RAISE EXCEPTION 'scoring_mode_locked_once_live';
  END IF;

  IF p_mode = 'manual' THEN
    IF v_match.status = 'live' THEN
      RAISE EXCEPTION 'scoring_mode_locked_once_live';
    END IF;

    UPDATE public.club_competition_match
    SET scoring_mode = 'manual'
    WHERE id = v_match.id
    RETURNING * INTO v_match;

    RETURN v_match;
  END IF;

  -- Remote mode setup
  IF v_match.scoring_mode IS DISTINCT FROM 'remote' THEN
    UPDATE public.club_competition_match
    SET scoring_mode = 'remote'
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  END IF;

  IF v_match.status = 'pending' THEN
    UPDATE public.club_competition_match
    SET status = 'live'
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  END IF;

  IF v_match.authoritative_scorer_user_id IS NULL THEN
    UPDATE public.club_competition_match
    SET authoritative_scorer_user_id = v_actor_id
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  ELSIF v_match.authoritative_scorer_user_id <> v_actor_id THEN
    IF p_take_over AND v_is_organiser THEN
      UPDATE public.club_competition_match
      SET authoritative_scorer_user_id = v_actor_id
      WHERE id = v_match.id
      RETURNING * INTO v_match;
    ELSE
      RAISE EXCEPTION 'remote_scorer_already_assigned';
    END IF;
  END IF;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.take_over_club_competition_match_remote_scoring(
  p_match_id uuid
)
RETURNS public.club_competition_match
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.prepare_club_competition_match_scoring(p_match_id, 'remote', true);
$$;

CREATE OR REPLACE FUNCTION public.set_club_competition_match_live_score(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer
)
RETURNS public.club_competition_match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_match public.club_competition_match%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF NOT public.is_club_competition_member(v_match.competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_match.status <> 'live' THEN
    RAISE EXCEPTION 'match_not_live';
  END IF;

  IF v_match.scoring_mode <> 'remote' THEN
    RAISE EXCEPTION 'match_not_remote_mode';
  END IF;

  IF v_match.authoritative_scorer_user_id IS NULL OR v_match.authoritative_scorer_user_id <> v_actor_id THEN
    RAISE EXCEPTION 'not_authoritative_scorer';
  END IF;

  IF p_score_a < 0 OR p_score_b < 0 THEN
    RAISE EXCEPTION 'score_must_be_non_negative';
  END IF;

  IF p_score_a > v_match.touch_limit OR p_score_b > v_match.touch_limit THEN
    RAISE EXCEPTION 'score_exceeds_touch_limit';
  END IF;

  UPDATE public.club_competition_match
  SET score_a = p_score_a,
      score_b = p_score_b
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_club_competition_match_score(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_mode text DEFAULT NULL
)
RETURNS public.club_competition_match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_match public.club_competition_match%ROWTYPE;
  v_competition_status public.club_competition_status;
  v_mode text;
  v_winner_participant_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_mode IS NOT NULL AND p_mode NOT IN ('remote', 'manual') THEN
    RAISE EXCEPTION 'invalid_scoring_mode';
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  SELECT c.status
  INTO v_competition_status
  FROM public.club_competition c
  WHERE c.id = v_match.competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT public.is_club_competition_member(v_match.competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_competition_status = 'finalised' THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  IF v_match.status IN ('canceled_withdrawal', 'annulled_withdrawal') THEN
    RAISE EXCEPTION 'match_not_editable';
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'match_already_completed';
  END IF;

  IF p_score_a < 0 OR p_score_b < 0 THEN
    RAISE EXCEPTION 'score_must_be_non_negative';
  END IF;

  IF p_score_a = p_score_b THEN
    RAISE EXCEPTION 'ties_not_allowed';
  END IF;

  IF p_score_a > v_match.touch_limit OR p_score_b > v_match.touch_limit THEN
    RAISE EXCEPTION 'score_exceeds_touch_limit';
  END IF;

  IF p_score_a <> v_match.touch_limit AND p_score_b <> v_match.touch_limit THEN
    RAISE EXCEPTION 'winning_score_must_hit_touch_limit';
  END IF;

  IF p_score_a >= v_match.touch_limit AND p_score_b >= v_match.touch_limit THEN
    RAISE EXCEPTION 'losing_score_must_be_below_touch_limit';
  END IF;

  v_mode := COALESCE(v_match.scoring_mode, p_mode, 'manual');

  IF v_mode = 'remote' THEN
    IF v_match.authoritative_scorer_user_id IS NULL THEN
      UPDATE public.club_competition_match
      SET authoritative_scorer_user_id = v_actor_id
      WHERE id = v_match.id
      RETURNING * INTO v_match;
    ELSIF v_match.authoritative_scorer_user_id <> v_actor_id THEN
      RAISE EXCEPTION 'not_authoritative_scorer';
    END IF;
  ELSIF v_match.status = 'live' THEN
    -- Once live starts, mode cannot switch.
    IF v_match.scoring_mode IS DISTINCT FROM v_mode THEN
      RAISE EXCEPTION 'scoring_mode_locked_once_live';
    END IF;
  END IF;

  v_winner_participant_id := CASE
    WHEN p_score_a > p_score_b THEN v_match.fencer_a_participant_id
    ELSE v_match.fencer_b_participant_id
  END;

  UPDATE public.club_competition_match
  SET scoring_mode = v_mode,
      status = 'completed',
      score_a = p_score_a,
      score_b = p_score_b,
      winner_participant_id = v_winner_participant_id,
      completed_at = now()
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_club_competition_match_scoring(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.take_over_club_competition_match_remote_scoring(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_competition_match_live_score(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_club_competition_match_score(uuid, integer, integer, text) TO authenticated;
