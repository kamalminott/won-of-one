-- Club Competition V1 - Phase 4 (Poules)
-- Adds poule tables, poule match table, and organiser-only RPCs for generation/edit/lock workflows.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_match_stage') THEN
    CREATE TYPE public.club_competition_match_stage AS ENUM ('poule', 'de');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_competition_match_status') THEN
    CREATE TYPE public.club_competition_match_status AS ENUM (
      'pending',
      'live',
      'completed',
      'canceled_withdrawal',
      'annulled_withdrawal'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.club_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.club_competition(id) ON DELETE CASCADE,
  pool_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, pool_label)
);

CREATE TABLE IF NOT EXISTS public.club_pool_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.club_pool(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.club_competition_participant(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, participant_id),
  UNIQUE (participant_id),
  UNIQUE (pool_id, position)
);

CREATE TABLE IF NOT EXISTS public.club_competition_match (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.club_competition(id) ON DELETE CASCADE,
  stage public.club_competition_match_stage NOT NULL,
  round_label text,
  pool_id uuid REFERENCES public.club_pool(id) ON DELETE CASCADE,
  fencer_a_participant_id uuid NOT NULL REFERENCES public.club_competition_participant(id) ON DELETE CASCADE,
  fencer_b_participant_id uuid NOT NULL REFERENCES public.club_competition_participant(id) ON DELETE CASCADE,
  touch_limit smallint NOT NULL CHECK (touch_limit IN (5, 10, 15)),
  status public.club_competition_match_status NOT NULL DEFAULT 'pending',
  scoring_mode text CHECK (scoring_mode IN ('remote', 'manual')),
  authoritative_scorer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  score_a smallint,
  score_b smallint,
  winner_participant_id uuid REFERENCES public.club_competition_participant(id) ON DELETE SET NULL,
  canceled_reason text,
  annulled_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fencer_a_participant_id <> fencer_b_participant_id),
  CHECK (
    (stage = 'poule' AND pool_id IS NOT NULL)
    OR (stage = 'de')
  )
);

CREATE INDEX IF NOT EXISTS club_pool_competition_idx
  ON public.club_pool (competition_id);

CREATE INDEX IF NOT EXISTS club_pool_assignment_pool_idx
  ON public.club_pool_assignment (pool_id, position);

CREATE INDEX IF NOT EXISTS club_pool_assignment_participant_idx
  ON public.club_pool_assignment (participant_id);

CREATE INDEX IF NOT EXISTS club_competition_match_competition_stage_idx
  ON public.club_competition_match (competition_id, stage, status);

CREATE INDEX IF NOT EXISTS club_competition_match_pool_idx
  ON public.club_competition_match (pool_id);

DROP TRIGGER IF EXISTS update_club_pool_updated_at ON public.club_pool;
CREATE TRIGGER update_club_pool_updated_at
  BEFORE UPDATE ON public.club_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_pool_assignment_updated_at ON public.club_pool_assignment;
CREATE TRIGGER update_club_pool_assignment_updated_at
  BEFORE UPDATE ON public.club_pool_assignment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_competition_match_updated_at ON public.club_competition_match;
CREATE TRIGGER update_club_competition_match_updated_at
  BEFORE UPDATE ON public.club_competition_match
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.club_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_pool_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_competition_match ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_access_club_pool ON public.club_pool;
CREATE POLICY service_role_full_access_club_pool
  ON public.club_pool
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_full_access_club_pool_assignment ON public.club_pool_assignment;
CREATE POLICY service_role_full_access_club_pool_assignment
  ON public.club_pool_assignment
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_full_access_club_competition_match ON public.club_competition_match;
CREATE POLICY service_role_full_access_club_competition_match
  ON public.club_competition_match
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_pool ON public.club_pool;
CREATE POLICY authenticated_select_club_pool
  ON public.club_pool
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

DROP POLICY IF EXISTS authenticated_select_club_pool_assignment ON public.club_pool_assignment;
CREATE POLICY authenticated_select_club_pool_assignment
  ON public.club_pool_assignment
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_pool p
      WHERE p.id = pool_id
        AND public.is_club_competition_member(p.competition_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS authenticated_select_club_competition_match ON public.club_competition_match;
CREATE POLICY authenticated_select_club_competition_match
  ON public.club_competition_match
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.normalize_club_pool_assignment_positions(
  p_pool_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY position, id) AS new_position
    FROM public.club_pool_assignment
    WHERE pool_id = p_pool_id
  )
  UPDATE public.club_pool_assignment a
  SET position = ordered.new_position
  FROM ordered
  WHERE a.id = ordered.id;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_poule_matches_for_competition(
  p_competition_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id uuid;
  v_participant_ids uuid[];
  v_match_count integer := 0;
  i integer;
  j integer;
BEGIN
  DELETE FROM public.club_competition_match
  WHERE competition_id = p_competition_id
    AND stage = 'poule';

  FOR v_pool_id IN
    SELECT id
    FROM public.club_pool
    WHERE competition_id = p_competition_id
    ORDER BY pool_label
  LOOP
    SELECT array_agg(participant_id ORDER BY position)
    INTO v_participant_ids
    FROM public.club_pool_assignment
    WHERE pool_id = v_pool_id;

    IF v_participant_ids IS NULL OR array_length(v_participant_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1..array_length(v_participant_ids, 1) LOOP
      EXIT WHEN i >= array_length(v_participant_ids, 1);
      FOR j IN (i + 1)..array_length(v_participant_ids, 1) LOOP
        INSERT INTO public.club_competition_match (
          competition_id,
          stage,
          pool_id,
          fencer_a_participant_id,
          fencer_b_participant_id,
          touch_limit,
          status
        ) VALUES (
          p_competition_id,
          'poule',
          v_pool_id,
          v_participant_ids[i],
          v_participant_ids[j],
          5,
          'pending'
        );
        v_match_count := v_match_count + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_club_competition_poules(
  p_competition_id uuid,
  p_regenerate boolean DEFAULT false
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
  v_pool_count integer;
  v_base_size integer;
  v_remainder integer;
  v_index integer := 0;
  v_current_pool_id uuid;
  v_pool_ids uuid[] := '{}';
  v_pool_size integer;
  v_pool_number integer;
  v_position integer;
  v_match_count integer;
  v_has_scored_matches boolean;
  v_pool_label text;
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

  IF p_regenerate THEN
    IF v_competition.status <> 'poules_generated' THEN
      RAISE EXCEPTION 'regenerate_only_when_poules_generated';
    END IF;
  ELSE
    IF v_competition.status <> 'registration_locked' THEN
      RAISE EXCEPTION 'generate_requires_registration_locked';
    END IF;
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
    RAISE EXCEPTION 'cannot_regenerate_after_scoring_started';
  END IF;

  SELECT array_agg(p.id ORDER BY random())
  INTO v_participant_ids
  FROM public.club_competition_participant p
  WHERE p.competition_id = p_competition_id
    AND p.status = 'active';

  v_participant_count := COALESCE(array_length(v_participant_ids, 1), 0);
  IF v_participant_count < 2 THEN
    RAISE EXCEPTION 'not_enough_active_participants';
  END IF;

  DELETE FROM public.club_pool
  WHERE competition_id = p_competition_id;

  v_pool_count := GREATEST(1, ROUND(v_participant_count::numeric / 6.0));
  v_pool_count := LEAST(v_pool_count, v_participant_count);
  v_base_size := FLOOR(v_participant_count::numeric / v_pool_count);
  v_remainder := MOD(v_participant_count, v_pool_count);

  FOR v_pool_number IN 1..v_pool_count LOOP
    v_pool_label :=
      CASE
        WHEN v_pool_number <= 26 THEN chr(64 + v_pool_number)
        ELSE 'P' || v_pool_number::text
      END;

    INSERT INTO public.club_pool (competition_id, pool_label)
    VALUES (p_competition_id, v_pool_label)
    RETURNING id INTO v_current_pool_id;

    v_pool_ids := array_append(v_pool_ids, v_current_pool_id);
  END LOOP;

  FOR v_pool_number IN 1..v_pool_count LOOP
    v_pool_size := v_base_size + CASE WHEN v_pool_number <= v_remainder THEN 1 ELSE 0 END;
    v_current_pool_id := v_pool_ids[v_pool_number];

    FOR v_position IN 1..v_pool_size LOOP
      v_index := v_index + 1;
      INSERT INTO public.club_pool_assignment (pool_id, participant_id, position)
      VALUES (
        v_current_pool_id,
        v_participant_ids[v_index],
        v_position
      );
    END LOOP;
  END LOOP;

  v_match_count := public.rebuild_poule_matches_for_competition(p_competition_id);

  UPDATE public.club_competition
  SET status = 'poules_generated'
  WHERE id = p_competition_id;

  RETURN jsonb_build_object(
    'pool_count', v_pool_count,
    'participant_count', v_participant_count,
    'match_count', v_match_count
  );
END;
$$;

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
    AND a.participant_id = p_participant_id;

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

  IF v_source_pool_id = p_target_pool_id THEN
    v_effective_target_position := LEAST(GREATEST(v_effective_target_position, 1), v_source_count);

    IF v_effective_target_position <> v_source_position THEN
      IF v_effective_target_position < v_source_position THEN
        UPDATE public.club_pool_assignment
        SET position = position + 1
        WHERE pool_id = v_source_pool_id
          AND position >= v_effective_target_position
          AND position < v_source_position;
      ELSE
        UPDATE public.club_pool_assignment
        SET position = position - 1
        WHERE pool_id = v_source_pool_id
          AND position <= v_effective_target_position
          AND position > v_source_position;
      END IF;

      UPDATE public.club_pool_assignment
      SET position = v_effective_target_position
      WHERE id = v_source_assignment.id;
    END IF;
  ELSE
    v_effective_target_position := LEAST(GREATEST(v_effective_target_position, 1), v_target_count + 1);

    UPDATE public.club_pool_assignment
    SET position = position - 1
    WHERE pool_id = v_source_pool_id
      AND position > v_source_position;

    UPDATE public.club_pool_assignment
    SET position = position + 1
    WHERE pool_id = p_target_pool_id
      AND position >= v_effective_target_position;

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

CREATE OR REPLACE FUNCTION public.lock_club_competition_poules(
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
    RAISE EXCEPTION 'poules_can_only_be_locked_from_generated_state';
  END IF;

  UPDATE public.club_competition
  SET status = 'poules_locked'
  WHERE id = p_competition_id
  RETURNING * INTO v_competition;

  RETURN v_competition;
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

  IF p_withdrawn THEN
    UPDATE public.club_competition_match m
    SET status = 'canceled_withdrawal',
        canceled_reason = 'withdrawal'
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
        annulled_reason = 'withdrawal'
    WHERE m.competition_id = p_competition_id
      AND m.stage = 'poule'
      AND m.status = 'completed'
      AND (
        m.fencer_a_participant_id = v_target.id
        OR m.fencer_b_participant_id = v_target.id
      );
  END IF;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_club_pool_assignment_positions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_poule_matches_for_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_competition_poules(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_club_competition_pool_assignment(uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_club_competition_poules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_competition_participant_withdrawn(uuid, uuid, boolean) TO authenticated;

COMMENT ON TABLE public.club_pool IS 'Competition poules generated for club competitions.';
COMMENT ON TABLE public.club_pool_assignment IS 'Participant assignment and order within each poule.';
COMMENT ON TABLE public.club_competition_match IS 'Club competition match records for poules/DE.';
