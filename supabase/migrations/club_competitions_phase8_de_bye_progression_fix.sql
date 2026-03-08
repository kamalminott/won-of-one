-- Club Competition V1 - Phase 8 DE bye progression fix
-- Prevent premature multi-round 15-0 auto-wins and represent byes without fake scores.

CREATE OR REPLACE FUNCTION public.club_competition_de_match_can_produce_winner(
  p_match_id uuid,
  p_visited uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.club_competition_match%ROWTYPE;
  v_prev_match_id uuid;
  v_next_visited uuid[];
BEGIN
  IF p_match_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_match_id = ANY(p_visited) THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id;

  IF NOT FOUND OR v_match.stage <> 'de' THEN
    RETURN false;
  END IF;

  IF v_match.winner_participant_id IS NOT NULL THEN
    RETURN true;
  END IF;

  IF v_match.fencer_a_participant_id IS NOT NULL
    OR v_match.fencer_b_participant_id IS NOT NULL
  THEN
    RETURN true;
  END IF;

  v_next_visited := array_append(p_visited, p_match_id);

  FOR v_prev_match_id IN
    SELECT m.id
    FROM public.club_competition_match m
    WHERE m.stage = 'de'
      AND m.advances_to_match_id = p_match_id
    ORDER BY m.advances_to_slot
  LOOP
    IF public.club_competition_de_match_can_produce_winner(v_prev_match_id, v_next_visited) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_complete_club_competition_de_byes(
  p_competition_id uuid,
  p_reason text DEFAULT 'bye',
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.club_competition_match%ROWTYPE;
  v_winner uuid;
  v_round_updates integer;
  v_total_updates integer := 0;
  v_missing_slot text;
  v_missing_feeder_match_id uuid;
  v_missing_side_can_produce boolean;
  v_effective_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'bye');
BEGIN
  LOOP
    v_round_updates := 0;

    FOR v_row IN
      SELECT *
      FROM public.club_competition_match m
      WHERE m.competition_id = p_competition_id
        AND m.stage = 'de'
        AND m.status = 'pending'
        AND (
          (m.fencer_a_participant_id IS NULL AND m.fencer_b_participant_id IS NOT NULL)
          OR (m.fencer_a_participant_id IS NOT NULL AND m.fencer_b_participant_id IS NULL)
        )
      ORDER BY m.de_round_index, m.de_match_number
      FOR UPDATE
    LOOP
      v_missing_slot := CASE
        WHEN v_row.fencer_a_participant_id IS NULL THEN 'a'
        ELSE 'b'
      END;

      SELECT m_prev.id
      INTO v_missing_feeder_match_id
      FROM public.club_competition_match m_prev
      WHERE m_prev.stage = 'de'
        AND m_prev.advances_to_match_id = v_row.id
        AND m_prev.advances_to_slot = v_missing_slot
      ORDER BY m_prev.de_round_index DESC, m_prev.de_match_number DESC
      LIMIT 1;

      IF v_missing_feeder_match_id IS NOT NULL THEN
        v_missing_side_can_produce := public.club_competition_de_match_can_produce_winner(
          v_missing_feeder_match_id
        );
        IF v_missing_side_can_produce THEN
          CONTINUE;
        END IF;
      END IF;

      v_winner := COALESCE(v_row.fencer_a_participant_id, v_row.fencer_b_participant_id);
      IF v_winner IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE public.club_competition_match
      SET status = 'completed',
          winner_participant_id = v_winner,
          score_a = NULL,
          score_b = NULL,
          completed_at = now(),
          scoring_mode = NULL,
          authoritative_scorer_user_id = NULL,
          canceled_reason = v_effective_reason,
          annulled_reason = NULL
      WHERE id = v_row.id
        AND status = 'pending';

      IF FOUND THEN
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
          v_row.competition_id,
          v_row.id,
          p_actor_user_id,
          'auto_bye',
          v_effective_reason,
          v_row.status,
          'completed',
          v_row.score_a,
          v_row.score_b,
          NULL,
          NULL,
          v_row.winner_participant_id,
          v_winner
        );

        PERFORM public.apply_club_competition_de_winner_to_next_match(v_row.id, v_winner);
        v_round_updates := v_round_updates + 1;
        v_total_updates := v_total_updates + 1;
      END IF;
    END LOOP;

    EXIT WHEN v_round_updates = 0;
  END LOOP;

  RETURN v_total_updates;
END;
$$;

-- Normalize already auto-bye-completed DE rows so UI/logic no longer shows fake 15-0 scores.
-- Finalised competitions are intentionally skipped because match edits are blocked by trigger.
UPDATE public.club_competition_match
SET score_a = NULL,
    score_b = NULL,
    scoring_mode = NULL,
    authoritative_scorer_user_id = NULL
WHERE stage = 'de'
  AND status = 'completed'
  AND canceled_reason = 'bye'
  AND competition_id IN (
    SELECT c.id
    FROM public.club_competition c
    WHERE c.status <> 'finalised'
  )
  AND (score_a IS NOT NULL OR score_b IS NOT NULL OR scoring_mode IS NOT NULL);

GRANT EXECUTE ON FUNCTION public.club_competition_de_match_can_produce_winner(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_club_competition_de_byes(uuid, text, uuid) TO authenticated;
