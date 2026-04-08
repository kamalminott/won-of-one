-- Club Competition V1 - Bronze placement match support
-- Adds a competition-level placement mode, a bronze DE branch fed by semifinal losers,
-- and organiser controls to award unresolved bronze matches without fencing them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_placement_mode') THEN
    CREATE TYPE public.club_competition_placement_mode AS ENUM ('none', 'bronze_only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_de_branch') THEN
    CREATE TYPE public.club_competition_de_branch AS ENUM ('main', 'bronze');
  END IF;
END $$;

ALTER TABLE public.club_competition
  ADD COLUMN IF NOT EXISTS placement_mode public.club_competition_placement_mode NOT NULL DEFAULT 'none';

ALTER TABLE public.club_competition_match
  ADD COLUMN IF NOT EXISTS de_branch public.club_competition_de_branch NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS loser_advances_to_match_id uuid REFERENCES public.club_competition_match(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loser_advances_to_slot text;

UPDATE public.club_competition_match
SET de_branch = 'main'
WHERE de_branch IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_competition_match_loser_advances_to_slot_check'
      AND conrelid = 'public.club_competition_match'::regclass
  ) THEN
    ALTER TABLE public.club_competition_match
      ADD CONSTRAINT club_competition_match_loser_advances_to_slot_check
      CHECK (loser_advances_to_slot IS NULL OR loser_advances_to_slot IN ('a', 'b'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS club_competition_match_de_branch_idx
  ON public.club_competition_match (competition_id, stage, de_branch, de_round_index, de_match_number);

CREATE INDEX IF NOT EXISTS club_competition_match_loser_advances_to_idx
  ON public.club_competition_match (loser_advances_to_match_id);

CREATE OR REPLACE FUNCTION public.update_club_competition_placement_mode(
  p_competition_id uuid,
  p_placement_mode public.club_competition_placement_mode
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

  IF v_competition.status IN ('de_generated', 'finalised') THEN
    RAISE EXCEPTION 'placement_mode_locked_after_de_generation';
  END IF;

  IF v_competition.format = 'poules_only' AND p_placement_mode <> 'none' THEN
    RAISE EXCEPTION 'placement_matches_require_de';
  END IF;

  UPDATE public.club_competition
  SET placement_mode = p_placement_mode
  WHERE id = p_competition_id
  RETURNING * INTO v_competition;

  RETURN v_competition;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_club_competition_de_winner_to_next_match(
  p_match_id uuid,
  p_winner_participant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.club_competition_match%ROWTYPE;
  v_next public.club_competition_match%ROWTYPE;
BEGIN
  IF p_winner_participant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_match.stage <> 'de' OR v_match.advances_to_match_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_next
  FROM public.club_competition_match
  WHERE id = v_match.advances_to_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_next.status <> 'pending' THEN
    RETURN;
  END IF;

  IF v_match.advances_to_slot = 'a' THEN
    UPDATE public.club_competition_match
    SET fencer_a_participant_id = p_winner_participant_id
    WHERE id = v_next.id;
  ELSE
    UPDATE public.club_competition_match
    SET fencer_b_participant_id = p_winner_participant_id
    WHERE id = v_next.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_club_competition_de_loser_to_next_match(
  p_match_id uuid,
  p_loser_participant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.club_competition_match%ROWTYPE;
  v_next public.club_competition_match%ROWTYPE;
BEGIN
  IF p_loser_participant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_match.stage <> 'de' OR v_match.loser_advances_to_match_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_next
  FROM public.club_competition_match
  WHERE id = v_match.loser_advances_to_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_next.status <> 'pending' THEN
    RETURN;
  END IF;

  IF v_match.loser_advances_to_slot = 'a' THEN
    UPDATE public.club_competition_match
    SET fencer_a_participant_id = p_loser_participant_id
    WHERE id = v_next.id;
  ELSE
    UPDATE public.club_competition_match
    SET fencer_b_participant_id = p_loser_participant_id
    WHERE id = v_next.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_club_competition_de_downstream_started(
  p_match_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_competition_match current_match
    JOIN public.club_competition_match next_match
      ON next_match.id = current_match.advances_to_match_id
      OR next_match.id = current_match.loser_advances_to_match_id
    WHERE current_match.id = p_match_id
      AND (
        next_match.status <> 'pending'
        OR next_match.score_a IS NOT NULL
        OR next_match.score_b IS NOT NULL
        OR next_match.winner_participant_id IS NOT NULL
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_club_competition_de_tableau(
  p_competition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition public.club_competition%ROWTYPE;
  v_participant_ids uuid[];
  v_participant_count integer;
  v_bracket_size integer := 1;
  v_round_count integer := 0;
  v_seed_order integer[] := ARRAY[1, 2];
  v_next_seed_order integer[];
  v_mirror_base integer;
  v_seed integer;
  v_slot_index integer;
  v_seed_slots uuid[];
  v_round_index integer;
  v_matches_in_round integer;
  v_competitors_in_round integer;
  v_match_number integer;
  v_slot_a integer;
  v_slot_b integer;
  v_match_id uuid;
  v_bronze_match_id uuid;
  v_total_matches integer := 0;
  v_auto_advanced integer := 0;
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
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  IF v_competition.format = 'poules_only' THEN
    RAISE EXCEPTION 'format_excludes_de';
  END IF;

  IF v_competition.status <> 'rankings_locked' THEN
    RAISE EXCEPTION 'de_generation_requires_rankings_locked';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_competition_match m
    WHERE m.competition_id = p_competition_id
      AND m.stage = 'de'
  ) THEN
    RAISE EXCEPTION 'de_already_generated';
  END IF;

  SELECT array_agg(r.participant_id ORDER BY r.rank)
  INTO v_participant_ids
  FROM public.club_competition_ranking r
  WHERE r.competition_id = p_competition_id
    AND r.is_withdrawn = false;

  v_participant_count := COALESCE(array_length(v_participant_ids, 1), 0);
  IF v_participant_count < 2 THEN
    RAISE EXCEPTION 'not_enough_eligible_participants';
  END IF;

  IF v_competition.placement_mode = 'bronze_only' AND v_participant_count < 4 THEN
    RAISE EXCEPTION 'bronze_match_requires_four_participants';
  END IF;

  WHILE v_bracket_size < v_participant_count LOOP
    v_bracket_size := v_bracket_size * 2;
  END LOOP;

  IF v_bracket_size > 2 THEN
    WHILE array_length(v_seed_order, 1) < v_bracket_size LOOP
      v_next_seed_order := '{}';
      v_mirror_base := (array_length(v_seed_order, 1) * 2) + 1;

      FOREACH v_seed IN ARRAY v_seed_order LOOP
        v_next_seed_order := array_append(v_next_seed_order, v_seed);
        v_next_seed_order := array_append(v_next_seed_order, v_mirror_base - v_seed);
      END LOOP;

      v_seed_order := v_next_seed_order;
    END LOOP;
  END IF;

  IF v_bracket_size = 2 THEN
    v_seed_order := ARRAY[1, 2];
  END IF;

  v_seed_slots := array_fill(NULL::uuid, ARRAY[v_bracket_size]);

  FOR v_seed IN 1..v_participant_count LOOP
    v_slot_index := array_position(v_seed_order, v_seed);
    IF v_slot_index IS NOT NULL THEN
      v_seed_slots[v_slot_index] := v_participant_ids[v_seed];
    END IF;
  END LOOP;

  CREATE TEMP TABLE tmp_club_de_matches (
    round_index integer NOT NULL,
    match_number integer NOT NULL,
    match_id uuid NOT NULL,
    PRIMARY KEY (round_index, match_number)
  ) ON COMMIT DROP;

  v_competitors_in_round := v_bracket_size;
  WHILE v_competitors_in_round >= 2 LOOP
    v_round_count := v_round_count + 1;
    v_competitors_in_round := v_competitors_in_round / 2;
  END LOOP;

  FOR v_round_index IN 1..v_round_count LOOP
    v_matches_in_round := (v_bracket_size / (2 ^ v_round_index))::integer;
    v_competitors_in_round := (v_bracket_size / (2 ^ (v_round_index - 1)))::integer;

    FOR v_match_number IN 1..v_matches_in_round LOOP
      IF v_round_index = 1 THEN
        v_slot_a := ((v_match_number - 1) * 2) + 1;
        v_slot_b := v_slot_a + 1;

        INSERT INTO public.club_competition_match (
          competition_id,
          stage,
          de_branch,
          round_label,
          de_round_index,
          de_match_number,
          pool_id,
          fencer_a_participant_id,
          fencer_b_participant_id,
          touch_limit,
          status
        ) VALUES (
          p_competition_id,
          'de',
          'main',
          public.club_de_round_label(v_competitors_in_round),
          v_round_index,
          v_match_number,
          NULL,
          v_seed_slots[v_slot_a],
          v_seed_slots[v_slot_b],
          v_competition.de_touch_limit,
          'pending'
        )
        RETURNING id INTO v_match_id;
      ELSE
        INSERT INTO public.club_competition_match (
          competition_id,
          stage,
          de_branch,
          round_label,
          de_round_index,
          de_match_number,
          pool_id,
          fencer_a_participant_id,
          fencer_b_participant_id,
          touch_limit,
          status
        ) VALUES (
          p_competition_id,
          'de',
          'main',
          public.club_de_round_label(v_competitors_in_round),
          v_round_index,
          v_match_number,
          NULL,
          NULL,
          NULL,
          v_competition.de_touch_limit,
          'pending'
        )
        RETURNING id INTO v_match_id;
      END IF;

      INSERT INTO tmp_club_de_matches (round_index, match_number, match_id)
      VALUES (v_round_index, v_match_number, v_match_id);

      v_total_matches := v_total_matches + 1;
    END LOOP;
  END LOOP;

  FOR v_round_index IN 1..(v_round_count - 1) LOOP
    FOR v_match_number IN 1..((v_bracket_size / (2 ^ v_round_index))::integer) LOOP
      UPDATE public.club_competition_match m
      SET advances_to_match_id = next_round.match_id,
          advances_to_slot = CASE
            WHEN MOD(v_match_number, 2) = 1 THEN 'a'
            ELSE 'b'
          END
      FROM tmp_club_de_matches current_round
      JOIN tmp_club_de_matches next_round
        ON next_round.round_index = v_round_index + 1
       AND next_round.match_number = ((v_match_number + 1) / 2)
      WHERE current_round.round_index = v_round_index
        AND current_round.match_number = v_match_number
        AND m.id = current_round.match_id;
    END LOOP;
  END LOOP;

  IF v_competition.placement_mode = 'bronze_only' THEN
    INSERT INTO public.club_competition_match (
      competition_id,
      stage,
      de_branch,
      round_label,
      de_round_index,
      de_match_number,
      pool_id,
      fencer_a_participant_id,
      fencer_b_participant_id,
      touch_limit,
      status
    ) VALUES (
      p_competition_id,
      'de',
      'bronze',
      'Bronze',
      v_round_count,
      2,
      NULL,
      NULL,
      NULL,
      v_competition.de_touch_limit,
      'pending'
    )
    RETURNING id INTO v_bronze_match_id;

    UPDATE public.club_competition_match m
    SET loser_advances_to_match_id = v_bronze_match_id,
        loser_advances_to_slot = CASE
          WHEN semifinal.match_number = 1 THEN 'a'
          ELSE 'b'
        END
    FROM tmp_club_de_matches semifinal
    WHERE semifinal.round_index = v_round_count - 1
      AND semifinal.match_number IN (1, 2)
      AND m.id = semifinal.match_id;

    v_total_matches := v_total_matches + 1;
  END IF;

  UPDATE public.club_competition
  SET status = 'de_generated'
  WHERE id = p_competition_id;

  v_auto_advanced := public.auto_complete_club_competition_de_byes(
    p_competition_id,
    'bye',
    v_actor_id
  );

  RETURN jsonb_build_object(
    'participant_count', v_participant_count,
    'bracket_size', v_bracket_size,
    'round_count', v_round_count,
    'match_count', v_total_matches,
    'auto_advanced_count', v_auto_advanced
  );
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
        AND m.de_branch = 'main'
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
        AND m_prev.de_branch = 'main'
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
  v_loser uuid;
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

  IF COALESCE(v_match.de_branch, 'main') <> 'bronze' THEN
    RAISE EXCEPTION 'placement_match_required';
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
  v_loser := CASE
    WHEN v_winner = v_match.fencer_a_participant_id THEN v_match.fencer_b_participant_id
    ELSE v_match.fencer_a_participant_id
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
  PERFORM public.apply_club_competition_de_loser_to_next_match(v_match.id, v_loser);
  PERFORM public.auto_complete_club_competition_de_byes(v_match.competition_id, 'bye', v_actor_id);

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_club_competition_de_match(
  p_match_id uuid,
  p_reason text DEFAULT 'organiser_reset'
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

  IF v_match.stage <> 'de' THEN
    RAISE EXCEPTION 'de_match_required';
  END IF;

  IF v_match.status <> 'completed' THEN
    RAISE EXCEPTION 'match_not_completed';
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
    'reset_match',
    COALESCE(NULLIF(trim(p_reason), ''), 'organiser_reset'),
    v_match.status,
    'pending',
    v_match.score_a,
    v_match.score_b,
    NULL,
    NULL,
    v_match.winner_participant_id,
    NULL
  );

  UPDATE public.club_competition_match
  SET status = 'pending',
      score_a = NULL,
      score_b = NULL,
      winner_participant_id = NULL,
      completed_at = NULL,
      scoring_mode = NULL,
      authoritative_scorer_user_id = NULL,
      canceled_reason = NULL,
      annulled_reason = NULL
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  IF v_match.advances_to_match_id IS NOT NULL THEN
    IF v_match.advances_to_slot = 'a' THEN
      UPDATE public.club_competition_match
      SET fencer_a_participant_id = NULL
      WHERE id = v_match.advances_to_match_id
        AND status = 'pending';
    ELSE
      UPDATE public.club_competition_match
      SET fencer_b_participant_id = NULL
      WHERE id = v_match.advances_to_match_id
        AND status = 'pending';
    END IF;
  END IF;

  IF v_match.loser_advances_to_match_id IS NOT NULL THEN
    IF v_match.loser_advances_to_slot = 'a' THEN
      UPDATE public.club_competition_match
      SET fencer_a_participant_id = NULL
      WHERE id = v_match.loser_advances_to_match_id
        AND status = 'pending';
    ELSE
      UPDATE public.club_competition_match
      SET fencer_b_participant_id = NULL
      WHERE id = v_match.loser_advances_to_match_id
        AND status = 'pending';
    END IF;
  END IF;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_club_competition_de_match_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loser_participant_id uuid;
BEGIN
  IF NEW.stage = 'de'
    AND NEW.status = 'completed'
    AND NEW.winner_participant_id IS NOT NULL
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.winner_participant_id IS DISTINCT FROM NEW.winner_participant_id
    )
  THEN
    IF NEW.fencer_a_participant_id IS NOT NULL AND NEW.fencer_b_participant_id IS NOT NULL THEN
      v_loser_participant_id := CASE
        WHEN NEW.winner_participant_id = NEW.fencer_a_participant_id THEN NEW.fencer_b_participant_id
        ELSE NEW.fencer_a_participant_id
      END;
    ELSE
      v_loser_participant_id := NULL;
    END IF;

    PERFORM public.apply_club_competition_de_winner_to_next_match(
      NEW.id,
      NEW.winner_participant_id
    );
    PERFORM public.apply_club_competition_de_loser_to_next_match(
      NEW.id,
      v_loser_participant_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_competition_de_match_completed_after_update ON public.club_competition_match;
CREATE TRIGGER on_club_competition_de_match_completed_after_update
  AFTER UPDATE ON public.club_competition_match
  FOR EACH ROW
  EXECUTE FUNCTION public.on_club_competition_de_match_completed();

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
  v_loser_participant_id uuid;
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
  v_loser_participant_id := CASE
    WHEN v_winner_participant_id = v_match.fencer_a_participant_id THEN v_match.fencer_b_participant_id
    ELSE v_match.fencer_a_participant_id
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
    PERFORM public.apply_club_competition_de_loser_to_next_match(
      v_match.id,
      v_loser_participant_id
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

CREATE OR REPLACE FUNCTION public.award_club_competition_de_match_walkover(
  p_match_id uuid,
  p_winner_participant_id uuid,
  p_reason text DEFAULT 'walkover_award'
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
  v_loser_participant_id uuid;
  v_effective_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'walkover_award');
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

  IF v_match.stage <> 'de' THEN
    RAISE EXCEPTION 'de_match_required';
  END IF;

  IF v_match.fencer_a_participant_id IS NULL OR v_match.fencer_b_participant_id IS NULL THEN
    RAISE EXCEPTION 'match_not_ready';
  END IF;

  IF p_winner_participant_id NOT IN (v_match.fencer_a_participant_id, v_match.fencer_b_participant_id) THEN
    RAISE EXCEPTION 'winner_participant_not_in_match';
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

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'match_already_completed';
  END IF;

  IF public.is_club_competition_de_downstream_started(v_match.id) THEN
    RAISE EXCEPTION 'downstream_match_started';
  END IF;

  v_loser_participant_id := CASE
    WHEN p_winner_participant_id = v_match.fencer_a_participant_id THEN v_match.fencer_b_participant_id
    ELSE v_match.fencer_a_participant_id
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
    'award_walkover',
    v_effective_reason,
    v_match.status,
    'completed',
    v_match.score_a,
    v_match.score_b,
    CASE
      WHEN p_winner_participant_id = v_match.fencer_a_participant_id THEN v_match.touch_limit
      ELSE 0
    END,
    CASE
      WHEN p_winner_participant_id = v_match.fencer_b_participant_id THEN v_match.touch_limit
      ELSE 0
    END,
    v_match.winner_participant_id,
    p_winner_participant_id
  );

  UPDATE public.club_competition_match
  SET status = 'completed',
      scoring_mode = 'manual',
      score_a = CASE
        WHEN p_winner_participant_id = v_match.fencer_a_participant_id THEN v_match.touch_limit
        ELSE 0
      END,
      score_b = CASE
        WHEN p_winner_participant_id = v_match.fencer_b_participant_id THEN v_match.touch_limit
        ELSE 0
      END,
      winner_participant_id = p_winner_participant_id,
      completed_at = now(),
      canceled_reason = v_effective_reason,
      annulled_reason = NULL,
      authoritative_scorer_user_id = NULL
  WHERE id = v_match.id
  RETURNING * INTO v_match;

  PERFORM public.apply_club_competition_de_winner_to_next_match(v_match.id, p_winner_participant_id);
  PERFORM public.apply_club_competition_de_loser_to_next_match(v_match.id, v_loser_participant_id);
  PERFORM public.auto_complete_club_competition_de_byes(v_match.competition_id, 'bye', v_actor_id);

  RETURN v_match;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_club_competition_placement_mode(uuid, public.club_competition_placement_mode) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_club_competition_de_loser_to_next_match(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_competition_de_tableau(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_club_competition_de_byes(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_club_competition_de_match_result(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_club_competition_de_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_club_competition_match_score(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_club_competition_de_match_walkover(uuid, uuid, text) TO authenticated;
