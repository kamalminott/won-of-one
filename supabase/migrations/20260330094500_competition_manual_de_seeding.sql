-- DE-only competitions: allow organisers to manually seed participants on the rankings screen.

ALTER TABLE public.club_competition_participant
  ADD COLUMN IF NOT EXISTS manual_seed_order integer CHECK (manual_seed_order > 0);

CREATE INDEX IF NOT EXISTS club_competition_participant_competition_manual_seed_idx
  ON public.club_competition_participant (competition_id, manual_seed_order, created_at);

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
      row_number() OVER (
        ORDER BY
          CASE WHEN p.manual_seed_order IS NULL THEN 1 ELSE 0 END,
          p.manual_seed_order,
          p.created_at,
          p.id
      ),
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
  RETURN COALESCE(v_rows, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_club_competition_de_seeds(
  p_competition_id uuid,
  p_participant_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_competition public.club_competition%ROWTYPE;
  v_expected_count integer;
  v_supplied_count integer;
  v_distinct_count integer;
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

  IF v_competition.format <> 'de_only' THEN
    RAISE EXCEPTION 'manual_seeding_only_for_de_only';
  END IF;

  IF v_competition.status <> 'registration_locked' THEN
    RAISE EXCEPTION 'manual_seeding_requires_registration_locked';
  END IF;

  v_supplied_count := COALESCE(array_length(p_participant_ids, 1), 0);
  IF v_supplied_count = 0 THEN
    RAISE EXCEPTION 'manual_seeding_requires_full_order';
  END IF;

  SELECT COUNT(DISTINCT participant_id)
  INTO v_distinct_count
  FROM unnest(p_participant_ids) AS supplied(participant_id);

  IF v_distinct_count <> v_supplied_count THEN
    RAISE EXCEPTION 'manual_seeding_duplicate_participant';
  END IF;

  SELECT COUNT(*)
  INTO v_expected_count
  FROM public.club_competition_participant p
  WHERE p.competition_id = p_competition_id
    AND p.status <> 'dns';

  IF v_expected_count <> v_supplied_count THEN
    RAISE EXCEPTION 'manual_seeding_requires_full_order';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_participant_ids) AS supplied(participant_id)
    LEFT JOIN public.club_competition_participant p
      ON p.id = supplied.participant_id
      AND p.competition_id = p_competition_id
      AND p.status <> 'dns'
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'manual_seeding_participant_mismatch';
  END IF;

  UPDATE public.club_competition_participant p
  SET manual_seed_order = seeded.seed_rank
  FROM (
    SELECT participant_id, ordinality::integer AS seed_rank
    FROM unnest(p_participant_ids) WITH ORDINALITY AS supplied(participant_id, ordinality)
  ) AS seeded
  WHERE p.id = seeded.participant_id
    AND p.competition_id = p_competition_id;

  PERFORM public.recompute_club_competition_rankings(p_competition_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_club_competition_de_seeds(uuid, uuid[]) TO authenticated;

COMMENT ON COLUMN public.club_competition_participant.manual_seed_order IS
  'Optional organiser-controlled DE-only seed order used when recomputing rankings before lock.';

COMMENT ON FUNCTION public.reorder_club_competition_de_seeds(uuid, uuid[]) IS
  'Allows organisers to persist manual DE-only seed ordering while registration is locked.';
