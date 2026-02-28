-- Club Competition V1 - Phase 6 (Rankings + DE)
-- Adds rankings engine/lock, DE tableau generation with byes, DE progression,
-- and organiser control guardrails (override + reset with audit).

ALTER TABLE public.club_competition_match
  ALTER COLUMN fencer_a_participant_id DROP NOT NULL,
  ALTER COLUMN fencer_b_participant_id DROP NOT NULL;

ALTER TABLE public.club_competition_match
  ADD COLUMN IF NOT EXISTS de_round_index integer,
  ADD COLUMN IF NOT EXISTS de_match_number integer,
  ADD COLUMN IF NOT EXISTS advances_to_match_id uuid REFERENCES public.club_competition_match(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advances_to_slot text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_competition_match_stage_requirements_v2_check'
      AND conrelid = 'public.club_competition_match'::regclass
  ) THEN
    ALTER TABLE public.club_competition_match
      ADD CONSTRAINT club_competition_match_stage_requirements_v2_check
      CHECK (
        (
          stage = 'poule'
          AND pool_id IS NOT NULL
          AND fencer_a_participant_id IS NOT NULL
          AND fencer_b_participant_id IS NOT NULL
        )
        OR (
          stage = 'de'
          AND pool_id IS NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_competition_match_advances_to_slot_check'
      AND conrelid = 'public.club_competition_match'::regclass
  ) THEN
    ALTER TABLE public.club_competition_match
      ADD CONSTRAINT club_competition_match_advances_to_slot_check
      CHECK (advances_to_slot IS NULL OR advances_to_slot IN ('a', 'b'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_competition_match_de_round_requirements_check'
      AND conrelid = 'public.club_competition_match'::regclass
  ) THEN
    ALTER TABLE public.club_competition_match
      ADD CONSTRAINT club_competition_match_de_round_requirements_check
      CHECK (
        stage <> 'de'
        OR (
          de_round_index IS NOT NULL
          AND de_round_index > 0
          AND de_match_number IS NOT NULL
          AND de_match_number > 0
          AND round_label IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS club_competition_match_de_round_idx
  ON public.club_competition_match (competition_id, stage, de_round_index, de_match_number);

CREATE INDEX IF NOT EXISTS club_competition_match_advances_to_idx
  ON public.club_competition_match (advances_to_match_id);

CREATE TABLE IF NOT EXISTS public.club_competition_ranking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.club_competition(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.club_competition_participant(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  bout_count integer NOT NULL DEFAULT 0 CHECK (bout_count >= 0),
  win_pct numeric(8,6) NOT NULL DEFAULT 0,
  indicator integer NOT NULL DEFAULT 0,
  hits_scored integer NOT NULL DEFAULT 0 CHECK (hits_scored >= 0),
  hits_received integer NOT NULL DEFAULT 0 CHECK (hits_received >= 0),
  is_withdrawn boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, participant_id),
  UNIQUE (competition_id, rank)
);

CREATE INDEX IF NOT EXISTS club_competition_ranking_competition_rank_idx
  ON public.club_competition_ranking (competition_id, rank);

DROP TRIGGER IF EXISTS update_club_competition_ranking_updated_at ON public.club_competition_ranking;
CREATE TRIGGER update_club_competition_ranking_updated_at
  BEFORE UPDATE ON public.club_competition_ranking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.club_competition_ranking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_access_club_competition_ranking ON public.club_competition_ranking;
CREATE POLICY service_role_full_access_club_competition_ranking
  ON public.club_competition_ranking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_competition_ranking ON public.club_competition_ranking;
CREATE POLICY authenticated_select_club_competition_ranking
  ON public.club_competition_ranking
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.club_competition_match_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.club_competition(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.club_competition_match(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  from_status public.club_competition_match_status,
  to_status public.club_competition_match_status,
  from_score_a integer,
  from_score_b integer,
  to_score_a integer,
  to_score_b integer,
  from_winner_participant_id uuid REFERENCES public.club_competition_participant(id) ON DELETE SET NULL,
  to_winner_participant_id uuid REFERENCES public.club_competition_participant(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_competition_match_audit_competition_idx
  ON public.club_competition_match_audit (competition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS club_competition_match_audit_match_idx
  ON public.club_competition_match_audit (match_id, created_at DESC);

ALTER TABLE public.club_competition_match_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_access_club_competition_match_audit ON public.club_competition_match_audit;
CREATE POLICY service_role_full_access_club_competition_match_audit
  ON public.club_competition_match_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_competition_match_audit ON public.club_competition_match_audit;
CREATE POLICY authenticated_select_club_competition_match_audit
  ON public.club_competition_match_audit
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.club_de_round_label(
  p_competitor_count integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_competitor_count >= 32 THEN
    RETURN 'L' || p_competitor_count::text;
  ELSIF p_competitor_count = 16 THEN
    RETURN 'L16';
  ELSIF p_competitor_count = 8 THEN
    RETURN 'QF';
  ELSIF p_competitor_count = 4 THEN
    RETURN 'SF';
  ELSIF p_competitor_count = 2 THEN
    RETURN 'F';
  END IF;

  RETURN 'L' || p_competitor_count::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_club_competition_rankings(
  p_competition_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition public.club_competition%ROWTYPE;
  v_rows integer;
BEGIN
  SELECT *
  INTO v_competition
  FROM public.club_competition
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  DELETE FROM public.club_competition_ranking
  WHERE competition_id = p_competition_id;

  IF v_competition.format = 'de_only' THEN
    INSERT INTO public.club_competition_ranking (
      competition_id,
      participant_id,
      rank,
      wins,
      losses,
      bout_count,
      win_pct,
      indicator,
      hits_scored,
      hits_received,
      is_withdrawn
    )
    SELECT
      p_competition_id,
      p.id,
      row_number() OVER (ORDER BY p.created_at, p.id),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      p.status = 'withdrawn'
    FROM public.club_competition_participant p
    WHERE p.competition_id = p_competition_id
      AND p.status <> 'dns';
  ELSE
    WITH participants AS (
      SELECT p.id, p.display_name, p.status
      FROM public.club_competition_participant p
      WHERE p.competition_id = p_competition_id
        AND p.status <> 'dns'
    ),
    completed_matches AS (
      SELECT
        m.fencer_a_participant_id,
        m.fencer_b_participant_id,
        COALESCE(m.score_a, 0) AS score_a,
        COALESCE(m.score_b, 0) AS score_b,
        m.winner_participant_id
      FROM public.club_competition_match m
      WHERE m.competition_id = p_competition_id
        AND m.stage = 'poule'
        AND m.status = 'completed'
        AND m.fencer_a_participant_id IS NOT NULL
        AND m.fencer_b_participant_id IS NOT NULL
    ),
    participant_matches AS (
      SELECT
        m.fencer_a_participant_id AS participant_id,
        m.score_a AS hits_scored,
        m.score_b AS hits_received,
        m.winner_participant_id
      FROM completed_matches m
      UNION ALL
      SELECT
        m.fencer_b_participant_id AS participant_id,
        m.score_b AS hits_scored,
        m.score_a AS hits_received,
        m.winner_participant_id
      FROM completed_matches m
    ),
    aggregated AS (
      SELECT
        p.id AS participant_id,
        p.display_name,
        p.status,
        COUNT(pm.participant_id)::integer AS bout_count,
        COUNT(*) FILTER (WHERE pm.winner_participant_id = p.id)::integer AS wins,
        COUNT(*) FILTER (
          WHERE pm.winner_participant_id IS NOT NULL
            AND pm.winner_participant_id <> p.id
        )::integer AS losses,
        COALESCE(SUM(pm.hits_scored), 0)::integer AS hits_scored,
        COALESCE(SUM(pm.hits_received), 0)::integer AS hits_received
      FROM participants p
      LEFT JOIN participant_matches pm
        ON pm.participant_id = p.id
      GROUP BY p.id, p.display_name, p.status
    ),
    ranked AS (
      SELECT
        a.*,
        CASE
          WHEN a.bout_count > 0 THEN (a.wins::numeric / a.bout_count::numeric)
          ELSE 0::numeric
        END AS win_pct,
        (a.hits_scored - a.hits_received) AS indicator,
        row_number() OVER (
          ORDER BY
            CASE
              WHEN a.bout_count > 0 THEN (a.wins::numeric / a.bout_count::numeric)
              ELSE 0::numeric
            END DESC,
            (a.hits_scored - a.hits_received) DESC,
            a.hits_scored DESC,
            a.display_name ASC,
            a.participant_id ASC
        ) AS rank
      FROM aggregated a
    )
    INSERT INTO public.club_competition_ranking (
      competition_id,
      participant_id,
      rank,
      wins,
      losses,
      bout_count,
      win_pct,
      indicator,
      hits_scored,
      hits_received,
      is_withdrawn
    )
    SELECT
      p_competition_id,
      r.participant_id,
      r.rank,
      r.wins,
      r.losses,
      r.bout_count,
      r.win_pct,
      r.indicator,
      r.hits_scored,
      r.hits_received,
      r.status = 'withdrawn'
    FROM ranked r;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_club_competition_rankings(
  p_competition_id uuid
)
RETURNS TABLE (
  competition_id uuid,
  participant_id uuid,
  rank integer,
  wins integer,
  losses integer,
  bout_count integer,
  win_pct numeric,
  indicator integer,
  hits_scored integer,
  hits_received integer,
  is_withdrawn boolean,
  display_name text,
  participant_status public.club_competition_participant_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition_status public.club_competition_status;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_club_competition_member(p_competition_id, v_actor_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT status
  INTO v_competition_status
  FROM public.club_competition
  WHERE id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition_status NOT IN ('rankings_locked', 'de_generated', 'finalised') THEN
    PERFORM public.recompute_club_competition_rankings(p_competition_id);
  END IF;

  RETURN QUERY
  SELECT
    r.competition_id,
    r.participant_id,
    r.rank,
    r.wins,
    r.losses,
    r.bout_count,
    r.win_pct,
    r.indicator,
    r.hits_scored,
    r.hits_received,
    r.is_withdrawn,
    p.display_name,
    p.status
  FROM public.club_competition_ranking r
  JOIN public.club_competition_participant p
    ON p.id = r.participant_id
  WHERE r.competition_id = p_competition_id
  ORDER BY r.rank ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_club_competition_rankings(
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
  v_pending_count integer;
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

  IF v_competition.status = 'rankings_locked' THEN
    RETURN v_competition;
  END IF;

  IF v_competition.format = 'de_only' THEN
    IF v_competition.status <> 'registration_locked' THEN
      RAISE EXCEPTION 'rankings_lock_requires_registration_locked_for_de_only';
    END IF;
  ELSE
    IF v_competition.status <> 'poules_locked' THEN
      RAISE EXCEPTION 'rankings_lock_requires_poules_locked';
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
  END IF;

  PERFORM public.recompute_club_competition_rankings(p_competition_id);

  UPDATE public.club_competition
  SET status = 'rankings_locked'
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
      v_winner := COALESCE(v_row.fencer_a_participant_id, v_row.fencer_b_participant_id);
      IF v_winner IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE public.club_competition_match
      SET status = 'completed',
          winner_participant_id = v_winner,
          score_a = CASE
            WHEN v_row.fencer_a_participant_id = v_winner THEN v_row.touch_limit
            ELSE 0
          END,
          score_b = CASE
            WHEN v_row.fencer_b_participant_id = v_winner THEN v_row.touch_limit
            ELSE 0
          END,
          completed_at = now(),
          scoring_mode = COALESCE(scoring_mode, 'manual'),
          canceled_reason = p_reason
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
          p_reason,
          v_row.status,
          'completed',
          v_row.score_a,
          v_row.score_b,
          CASE WHEN v_row.fencer_a_participant_id = v_winner THEN v_row.touch_limit ELSE 0 END,
          CASE WHEN v_row.fencer_b_participant_id = v_winner THEN v_row.touch_limit ELSE 0 END,
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
    WHERE current_match.id = p_match_id
      AND (
        next_match.status <> 'pending'
        OR next_match.score_a IS NOT NULL
        OR next_match.score_b IS NOT NULL
        OR next_match.winner_participant_id IS NOT NULL
      )
  );
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

  IF p_score_a <> v_match.touch_limit AND p_score_b <> v_match.touch_limit THEN
    RAISE EXCEPTION 'winning_score_must_hit_touch_limit';
  END IF;

  IF p_score_a >= v_match.touch_limit AND p_score_b >= v_match.touch_limit THEN
    RAISE EXCEPTION 'losing_score_must_be_below_touch_limit';
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

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_club_competition_match_editability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition_status public.club_competition_status;
BEGIN
  SELECT status
  INTO v_competition_status
  FROM public.club_competition
  WHERE id = NEW.competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_competition_status = 'finalised' THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;

  IF NEW.stage = 'poule'
    AND v_competition_status IN ('rankings_locked', 'de_generated', 'finalised')
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.score_a IS DISTINCT FROM NEW.score_a
      OR OLD.score_b IS DISTINCT FROM NEW.score_b
      OR OLD.winner_participant_id IS DISTINCT FROM NEW.winner_participant_id
      OR OLD.scoring_mode IS DISTINCT FROM NEW.scoring_mode
      OR OLD.authoritative_scorer_user_id IS DISTINCT FROM NEW.authoritative_scorer_user_id
      OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
      OR OLD.canceled_reason IS DISTINCT FROM NEW.canceled_reason
      OR OLD.annulled_reason IS DISTINCT FROM NEW.annulled_reason
    )
  THEN
    RAISE EXCEPTION 'poule_matches_locked_after_rankings';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_club_competition_match_editability_before_update ON public.club_competition_match;
CREATE TRIGGER guard_club_competition_match_editability_before_update
  BEFORE UPDATE ON public.club_competition_match
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_club_competition_match_editability();

CREATE OR REPLACE FUNCTION public.on_club_competition_de_match_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'de'
    AND NEW.status = 'completed'
    AND NEW.winner_participant_id IS NOT NULL
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.winner_participant_id IS DISTINCT FROM NEW.winner_participant_id
    )
  THEN
    PERFORM public.apply_club_competition_de_winner_to_next_match(
      NEW.id,
      NEW.winner_participant_id
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
  v_de_match public.club_competition_match%ROWTYPE;
  v_opponent_participant_id uuid;
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

  IF p_withdrawn THEN
    IF v_competition_status IN ('poules_generated', 'poules_locked') THEN
      UPDATE public.club_competition_match m
      SET status = 'canceled_withdrawal',
          canceled_reason = 'withdrawal',
          winner_participant_id = NULL,
          completed_at = NULL,
          score_a = NULL,
          score_b = NULL
      WHERE m.competition_id = p_competition_id
        AND m.stage = 'poule'
        AND m.status IN ('pending', 'live')
        AND (
          m.fencer_a_participant_id = v_target.id
          OR m.fencer_b_participant_id = v_target.id
        );

      UPDATE public.club_competition_match m
      SET status = 'annulled_withdrawal',
          winner_participant_id = NULL,
          annulled_reason = 'withdrawal',
          completed_at = NULL
      WHERE m.competition_id = p_competition_id
        AND m.stage = 'poule'
        AND m.status = 'completed'
        AND (
          m.fencer_a_participant_id = v_target.id
          OR m.fencer_b_participant_id = v_target.id
        );
    END IF;

    IF v_competition_status = 'de_generated' THEN
      FOR v_de_match IN
        SELECT *
        FROM public.club_competition_match m
        WHERE m.competition_id = p_competition_id
          AND m.stage = 'de'
          AND m.status IN ('pending', 'live')
          AND (
            m.fencer_a_participant_id = v_target.id
            OR m.fencer_b_participant_id = v_target.id
          )
        ORDER BY m.de_round_index, m.de_match_number
        FOR UPDATE
      LOOP
        v_opponent_participant_id := CASE
          WHEN v_de_match.fencer_a_participant_id = v_target.id THEN v_de_match.fencer_b_participant_id
          ELSE v_de_match.fencer_a_participant_id
        END;

        IF v_opponent_participant_id IS NULL THEN
          UPDATE public.club_competition_match
          SET status = 'canceled_withdrawal',
              canceled_reason = 'withdrawal',
              winner_participant_id = NULL,
              score_a = NULL,
              score_b = NULL,
              completed_at = NULL
          WHERE id = v_de_match.id;
        ELSE
          UPDATE public.club_competition_match
          SET status = 'completed',
              scoring_mode = COALESCE(scoring_mode, 'manual'),
              winner_participant_id = v_opponent_participant_id,
              score_a = CASE
                WHEN v_de_match.fencer_a_participant_id = v_opponent_participant_id THEN v_de_match.touch_limit
                ELSE 0
              END,
              score_b = CASE
                WHEN v_de_match.fencer_b_participant_id = v_opponent_participant_id THEN v_de_match.touch_limit
                ELSE 0
              END,
              completed_at = now(),
              canceled_reason = 'withdrawal_walkover',
              annulled_reason = NULL
          WHERE id = v_de_match.id;

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
            p_competition_id,
            v_de_match.id,
            v_actor_id,
            'walkover',
            'participant_withdrawn',
            v_de_match.status,
            'completed',
            v_de_match.score_a,
            v_de_match.score_b,
            CASE
              WHEN v_de_match.fencer_a_participant_id = v_opponent_participant_id THEN v_de_match.touch_limit
              ELSE 0
            END,
            CASE
              WHEN v_de_match.fencer_b_participant_id = v_opponent_participant_id THEN v_de_match.touch_limit
              ELSE 0
            END,
            v_de_match.winner_participant_id,
            v_opponent_participant_id
          );

          PERFORM public.apply_club_competition_de_winner_to_next_match(
            v_de_match.id,
            v_opponent_participant_id
          );
        END IF;
      END LOOP;

      PERFORM public.auto_complete_club_competition_de_byes(
        p_competition_id,
        'bye',
        v_actor_id
      );
    END IF;
  END IF;

  IF v_competition_status IN ('poules_generated', 'poules_locked') THEN
    PERFORM public.recompute_club_competition_rankings(p_competition_id);
  END IF;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_de_round_label(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_club_competition_rankings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_club_competition_rankings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_club_competition_rankings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_club_competition_de_winner_to_next_match(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_club_competition_de_byes(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_competition_de_tableau(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_competition_de_downstream_started(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_club_competition_de_match_result(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_club_competition_de_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_club_competition_match_score(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_competition_participant_withdrawn(uuid, uuid, boolean) TO authenticated;

COMMENT ON TABLE public.club_competition_ranking IS 'Computed rankings snapshot used for lock/de seeding in club competitions.';
COMMENT ON TABLE public.club_competition_match_audit IS 'Audit trail for DE override/reset/walkover actions.';
