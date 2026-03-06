-- Club Competition V1 - Phase 6 (COMP-055 Match Integration Mapping)
-- Creates a 1:1 link between club_competition_match and core match rows,
-- persists competition metadata (competition_id/stage/round_label),
-- and keeps linked rows neutral for V1 visibility constraints.

CREATE TABLE IF NOT EXISTS public.club_competition_match_link (
  competition_match_id uuid PRIMARY KEY
    REFERENCES public.club_competition_match(id) ON DELETE CASCADE,
  core_match_id uuid NOT NULL UNIQUE
    REFERENCES public.match(match_id) ON DELETE CASCADE,
  competition_id uuid NOT NULL
    REFERENCES public.club_competition(id) ON DELETE CASCADE,
  stage public.club_competition_match_stage NOT NULL,
  round_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_competition_match_link_competition_idx
  ON public.club_competition_match_link (competition_id, stage);

DROP TRIGGER IF EXISTS update_club_competition_match_link_updated_at
  ON public.club_competition_match_link;
CREATE TRIGGER update_club_competition_match_link_updated_at
  BEFORE UPDATE ON public.club_competition_match_link
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.club_competition_match_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_access_club_competition_match_link
  ON public.club_competition_match_link;
CREATE POLICY service_role_full_access_club_competition_match_link
  ON public.club_competition_match_link
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_club_competition_match_link
  ON public.club_competition_match_link;
CREATE POLICY authenticated_select_club_competition_match_link
  ON public.club_competition_match_link
  FOR SELECT
  TO authenticated
  USING (public.is_club_competition_member(competition_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_club_competition_match_link(
  p_competition_match_id uuid
)
RETURNS public.club_competition_match_link
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.club_competition_match%ROWTYPE;
  v_competition public.club_competition%ROWTYPE;
  v_link public.club_competition_match_link%ROWTYPE;
  v_core_match_id uuid;
  v_fencer_a_name text := 'TBD';
  v_fencer_b_name text := 'TBD';
  v_score_a integer := 0;
  v_score_b integer := 0;
BEGIN
  SELECT *
  INTO v_match
  FROM public.club_competition_match
  WHERE id = p_competition_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_match_not_found';
  END IF;

  SELECT *
  INTO v_competition
  FROM public.club_competition
  WHERE id = v_match.competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF v_match.fencer_a_participant_id IS NOT NULL THEN
    SELECT p.display_name
    INTO v_fencer_a_name
    FROM public.club_competition_participant p
    WHERE p.id = v_match.fencer_a_participant_id;
  END IF;

  IF v_match.fencer_b_participant_id IS NOT NULL THEN
    SELECT p.display_name
    INTO v_fencer_b_name
    FROM public.club_competition_participant p
    WHERE p.id = v_match.fencer_b_participant_id;
  END IF;

  v_fencer_a_name := COALESCE(NULLIF(trim(v_fencer_a_name), ''), 'TBD');
  v_fencer_b_name := COALESCE(NULLIF(trim(v_fencer_b_name), ''), 'TBD');
  v_score_a := COALESCE(v_match.score_a, 0);
  v_score_b := COALESCE(v_match.score_b, 0);

  SELECT *
  INTO v_link
  FROM public.club_competition_match_link
  WHERE competition_match_id = v_match.id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.match (
      user_id,
      fencer_1_name,
      fencer_2_name,
      final_score,
      event_date,
      result,
      score_diff,
      match_type,
      weapon_type,
      source,
      is_complete,
      notes
    )
    VALUES (
      NULL, -- Neutral row to keep V1 club competition matches out of user history/stats surfaces.
      v_fencer_a_name,
      v_fencer_b_name,
      v_score_a,
      COALESCE(v_match.completed_at, v_match.updated_at, now()),
      NULL,
      v_score_a - v_score_b,
      'competition',
      v_competition.weapon,
      (
        CASE
        WHEN v_match.scoring_mode = 'remote' THEN 'remote'
        ELSE 'manual'
        END
      )::public.source_enum,
      v_match.status = 'completed',
      format('[club_competition:%s][competition_match:%s]', v_match.competition_id, v_match.id)
    )
    RETURNING match_id INTO v_core_match_id;

    INSERT INTO public.club_competition_match_link (
      competition_match_id,
      core_match_id,
      competition_id,
      stage,
      round_label
    )
    VALUES (
      v_match.id,
      v_core_match_id,
      v_match.competition_id,
      v_match.stage,
      v_match.round_label
    )
    RETURNING * INTO v_link;
  ELSE
    v_core_match_id := v_link.core_match_id;

    UPDATE public.club_competition_match_link
    SET competition_id = v_match.competition_id,
        stage = v_match.stage,
        round_label = v_match.round_label
    WHERE competition_match_id = v_match.id
    RETURNING * INTO v_link;
  END IF;

  UPDATE public.match
  SET fencer_1_name = v_fencer_a_name,
      fencer_2_name = v_fencer_b_name,
      final_score = v_score_a,
      event_date = COALESCE(v_match.completed_at, v_match.updated_at, now()),
      result = NULL,
      score_diff = v_score_a - v_score_b,
      match_type = 'competition',
      weapon_type = v_competition.weapon,
      source = (
        CASE
          WHEN v_match.scoring_mode = 'remote' THEN 'remote'
          ELSE 'manual'
        END
      )::public.source_enum,
      is_complete = v_match.status = 'completed',
      notes = format('[club_competition:%s][competition_match:%s]', v_match.competition_id, v_match.id)
  WHERE match_id = v_core_match_id;

  RETURN v_link;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_club_competition_match_sync_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_club_competition_match_link(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_competition_match_sync_link_after_insert
  ON public.club_competition_match;
CREATE TRIGGER on_club_competition_match_sync_link_after_insert
  AFTER INSERT ON public.club_competition_match
  FOR EACH ROW
  EXECUTE FUNCTION public.on_club_competition_match_sync_link();

DROP TRIGGER IF EXISTS on_club_competition_match_sync_link_after_update
  ON public.club_competition_match;
CREATE TRIGGER on_club_competition_match_sync_link_after_update
  AFTER UPDATE OF
    competition_id,
    stage,
    round_label,
    fencer_a_participant_id,
    fencer_b_participant_id,
    scoring_mode,
    status,
    score_a,
    score_b,
    completed_at
  ON public.club_competition_match
  FOR EACH ROW
  EXECUTE FUNCTION public.on_club_competition_match_sync_link();

DO $$
DECLARE
  v_match_id uuid;
BEGIN
  FOR v_match_id IN
    SELECT id
    FROM public.club_competition_match
  LOOP
    PERFORM public.sync_club_competition_match_link(v_match_id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_club_competition_match_link(uuid) TO authenticated;

COMMENT ON TABLE public.club_competition_match_link IS '1:1 mapping of club competition matches to core match rows with persisted competition stage metadata.';
