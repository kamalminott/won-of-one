-- Club Competition V1 - Phase 8 scoring rule fix
-- Allow match completion when one fencer is leading at time expiry.
-- Winner no longer must hit touch_limit; still no ties and scores cannot exceed touch_limit.

CREATE OR REPLACE FUNCTION public.override_club_competition_de_match_result(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_reason text
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
  v_winner uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 4 THEN
    RAISE EXCEPTION 'override_reason_required';
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.stage <> 'de' THEN
    RAISE EXCEPTION 'de_match_required';
  END IF;

  IF v_match.fencer_a_participant_id IS NULL OR v_match.fencer_b_participant_id IS NULL THEN
    RAISE EXCEPTION 'match_not_ready';
  END IF;

  IF NOT public.is_club_competition_organiser(v_match.competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT status
  INTO v_competition_status
  FROM public.club_competition
  WHERE id = v_match.competition_id;

  IF v_competition_status <> 'de_generated' THEN
    RAISE EXCEPTION 'de_not_editable_in_current_state';
  END IF;

  IF public.is_club_competition_de_downstream_started(v_match.id) THEN
    RAISE EXCEPTION 'downstream_match_started';
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

  v_winner := CASE
    WHEN p_score_a > p_score_b THEN v_match.fencer_a_participant_id
    ELSE v_match.fencer_b_participant_id
  END;

  INSERT INTO public.club_competition_match_audit (
    competition_id,
    match_id,
    actor_user_id,
    action,
    reason,
    from_status,
    to_status,
    from_score_a,
    from_score_b,
    to_score_a,
    to_score_b,
    from_winner_participant_id,
    to_winner_participant_id
  ) VALUES (
    v_match.competition_id,
    v_match.id,
    v_actor_id,
    'override_result',
    trim(p_reason),
    v_match.status,
    'completed',
    v_match.score_a,
    v_match.score_b,
    p_score_a,
    p_score_b,
    v_match.winner_participant_id,
    v_winner
  );

  UPDATE public.club_competition_match
  SET status = 'completed',
      scoring_mode = COALESCE(scoring_mode, 'manual'),
      score_a = p_score_a,
      score_b = p_score_b,
      winner_participant_id = v_winner,
      completed_at = now(),
      canceled_reason = NULL,
      annulled_reason = NULL
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  PERFORM public.apply_club_competition_de_winner_to_next_match(v_match.id, v_winner);
  PERFORM public.auto_complete_club_competition_de_byes(v_match.competition_id, 'bye', v_actor_id);

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

  IF v_match.stage = 'poule' AND v_competition_status IN ('rankings_locked', 'de_generated') THEN
    RAISE EXCEPTION 'poule_matches_locked_after_rankings';
  END IF;

  IF v_match.stage = 'de' AND v_competition_status <> 'de_generated' THEN
    RAISE EXCEPTION 'de_not_editable_in_current_state';
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
      completed_at = now(),
      canceled_reason = NULL,
      annulled_reason = NULL
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  IF v_match.stage = 'poule' AND v_competition_status IN ('poules_generated', 'poules_locked') THEN
    PERFORM public.recompute_club_competition_rankings(v_match.competition_id);
  ELSIF v_match.stage = 'de' THEN
    PERFORM public.apply_club_competition_de_winner_to_next_match(
      v_match.id,
      v_winner_participant_id
    );
    PERFORM public.auto_complete_club_competition_de_byes(
      v_match.competition_id,
      'bye',
      v_actor_id
    );
  END IF;

  RETURN v_match;
END;
$$;

GRANT EXECUTE ON FUNCTION public.override_club_competition_de_match_result(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_club_competition_match_score(uuid, integer, integer, text) TO authenticated;
