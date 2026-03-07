-- Club Competition V1 - Phase 8 assignment move fix
-- Prevent UNIQUE(pool_id, position) collisions when reordering assignment positions.

CREATE OR REPLACE FUNCTION public.move_club_competition_pool_assignment(
  p_competition_id uuid,
  p_participant_id uuid,
  p_target_pool_id uuid,
  p_target_position integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition public.club_competition%ROWTYPE;
  v_source_assignment public.club_pool_assignment%ROWTYPE;
  v_source_pool_id uuid;
  v_source_position integer;
  v_target_pool_competition_id uuid;
  v_target_count integer;
  v_source_count integer;
  v_effective_target_position integer;
  v_has_scored_matches boolean;
  v_position_offset integer := 1000000;
  v_temp_position integer;
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
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition.status <> 'poules_generated' THEN
    RAISE EXCEPTION 'assignments_editable_only_before_poules_locked';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.club_competition_match m
    WHERE m.competition_id = p_competition_id
      AND m.stage = 'poule'
      AND (
        m.status IN ('live', 'completed', 'annulled_withdrawal')
        OR m.score_a IS NOT NULL
        OR m.score_b IS NOT NULL
      )
  )
  INTO v_has_scored_matches;

  IF v_has_scored_matches THEN
    RAISE EXCEPTION 'cannot_edit_assignments_after_scoring_started';
  END IF;

  SELECT a.*
  INTO v_source_assignment
  FROM public.club_pool_assignment a
  JOIN public.club_pool p ON p.id = a.pool_id
  WHERE p.competition_id = p_competition_id
    AND a.participant_id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  SELECT competition_id
  INTO v_target_pool_competition_id
  FROM public.club_pool
  WHERE id = p_target_pool_id;

  IF NOT FOUND OR v_target_pool_competition_id <> p_competition_id THEN
    RAISE EXCEPTION 'target_pool_invalid';
  END IF;

  v_source_pool_id := v_source_assignment.pool_id;
  v_source_position := v_source_assignment.position;

  PERFORM public.normalize_club_pool_assignment_positions(v_source_pool_id);
  IF v_source_pool_id <> p_target_pool_id THEN
    PERFORM public.normalize_club_pool_assignment_positions(p_target_pool_id);
  END IF;

  SELECT COUNT(*)
  INTO v_target_count
  FROM public.club_pool_assignment
  WHERE pool_id = p_target_pool_id;

  SELECT COUNT(*)
  INTO v_source_count
  FROM public.club_pool_assignment
  WHERE pool_id = v_source_pool_id;

  IF p_target_position IS NULL OR p_target_position < 1 THEN
    v_effective_target_position :=
      CASE
        WHEN v_source_pool_id = p_target_pool_id THEN v_source_count
        ELSE v_target_count + 1
      END;
  ELSE
    v_effective_target_position := p_target_position;
  END IF;

  v_temp_position := v_position_offset + v_source_position;

  IF v_source_pool_id = p_target_pool_id THEN
    v_effective_target_position := LEAST(GREATEST(v_effective_target_position, 1), v_source_count);

    IF v_effective_target_position <> v_source_position THEN
      -- Move source row out of the way first.
      UPDATE public.club_pool_assignment
      SET position = v_temp_position
      WHERE id = v_source_assignment.id;

      IF v_effective_target_position < v_source_position THEN
        -- Shift [target, source-1] down by +1 without unique collisions.
        UPDATE public.club_pool_assignment
        SET position = position + v_position_offset
        WHERE pool_id = v_source_pool_id
          AND position >= v_effective_target_position
          AND position < v_source_position;

        UPDATE public.club_pool_assignment
        SET position = position - (v_position_offset - 1)
        WHERE pool_id = v_source_pool_id
          AND position >= v_position_offset + v_effective_target_position
          AND position < v_position_offset + v_source_position;
      ELSE
        -- Shift [source+1, target] up by -1 without unique collisions.
        UPDATE public.club_pool_assignment
        SET position = position + v_position_offset
        WHERE pool_id = v_source_pool_id
          AND position <= v_effective_target_position
          AND position > v_source_position;

        UPDATE public.club_pool_assignment
        SET position = position - (v_position_offset + 1)
        WHERE pool_id = v_source_pool_id
          AND position <= v_position_offset + v_effective_target_position
          AND position > v_position_offset + v_source_position;
      END IF;

      UPDATE public.club_pool_assignment
      SET position = v_effective_target_position
      WHERE id = v_source_assignment.id;
    END IF;
  ELSE
    v_effective_target_position := LEAST(GREATEST(v_effective_target_position, 1), v_target_count + 1);

    -- Move source row out of the way first.
    UPDATE public.club_pool_assignment
    SET position = v_temp_position
    WHERE id = v_source_assignment.id;

    -- Source pool: shift positions after the removed row up by -1.
    UPDATE public.club_pool_assignment
    SET position = position + v_position_offset
    WHERE pool_id = v_source_pool_id
      AND position > v_source_position;

    UPDATE public.club_pool_assignment
    SET position = position - (v_position_offset + 1)
    WHERE pool_id = v_source_pool_id
      AND position > v_position_offset + v_source_position;

    -- Target pool: make room at insertion point by shifting >= target down by +1.
    UPDATE public.club_pool_assignment
    SET position = position + v_position_offset
    WHERE pool_id = p_target_pool_id
      AND position >= v_effective_target_position;

    UPDATE public.club_pool_assignment
    SET position = position - (v_position_offset - 1)
    WHERE pool_id = p_target_pool_id
      AND position >= v_position_offset + v_effective_target_position;

    UPDATE public.club_pool_assignment
    SET pool_id = p_target_pool_id,
        position = v_effective_target_position
    WHERE id = v_source_assignment.id;
  END IF;

  PERFORM public.normalize_club_pool_assignment_positions(v_source_pool_id);
  IF v_source_pool_id <> p_target_pool_id THEN
    PERFORM public.normalize_club_pool_assignment_positions(p_target_pool_id);
  END IF;

  PERFORM public.rebuild_poule_matches_for_competition(p_competition_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_club_competition_pool_assignment(uuid, uuid, uuid, integer) TO authenticated;
