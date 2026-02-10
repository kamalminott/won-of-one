-- Activity calendar aggregation RPC
-- Returns per-day activity counts across:
-- 1) Competition matches
-- 2) Training matches
-- 3) Performance sessions (weekly_session_log)

CREATE OR REPLACE FUNCTION public.get_user_activity_calendar(
  p_start_date date,
  p_end_date date,
  p_timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  activity_date date,
  total_count integer,
  competition_match_count integer,
  training_match_count integer,
  performance_session_count integer,
  performance_activity_types text[]
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH match_days AS (
    SELECT
      (m.event_date AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'UTC'))::date AS activity_date,
      SUM(
        CASE
          WHEN (
            m.competition_id IS NOT NULL
            OR COALESCE(lower(m.match_type), '') = 'competition'
            OR m.phase IS NOT NULL
            OR m.de_round IS NOT NULL
          ) THEN 1 ELSE 0
        END
      )::int AS competition_match_count,
      SUM(
        CASE
          WHEN (
            m.competition_id IS NOT NULL
            OR COALESCE(lower(m.match_type), '') = 'competition'
            OR m.phase IS NOT NULL
            OR m.de_round IS NOT NULL
          ) THEN 0 ELSE 1
        END
      )::int AS training_match_count
    FROM public.match m
    WHERE m.user_id = auth.uid()
      AND m.is_complete = true
      AND m.event_date IS NOT NULL
      AND (m.event_date AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'UTC'))::date
        BETWEEN p_start_date AND p_end_date
    GROUP BY 1
  ),
  performance_days AS (
    SELECT
      w.session_date::date AS activity_date,
      COUNT(*)::int AS performance_session_count,
      ARRAY_AGG(DISTINCT w.activity_type ORDER BY w.activity_type)
        FILTER (WHERE w.activity_type IS NOT NULL AND w.activity_type <> '') AS performance_activity_types
    FROM public.weekly_session_log w
    WHERE w.user_id = auth.uid()
      AND w.session_date BETWEEN p_start_date AND p_end_date
    GROUP BY 1
  ),
  merged AS (
    SELECT
      COALESCE(m.activity_date, p.activity_date) AS activity_date,
      COALESCE(m.competition_match_count, 0) AS competition_match_count,
      COALESCE(m.training_match_count, 0) AS training_match_count,
      COALESCE(p.performance_session_count, 0) AS performance_session_count,
      COALESCE(p.performance_activity_types, ARRAY[]::text[]) AS performance_activity_types
    FROM match_days m
    FULL OUTER JOIN performance_days p ON p.activity_date = m.activity_date
  )
  SELECT
    merged.activity_date,
    (
      merged.competition_match_count
      + merged.training_match_count
      + merged.performance_session_count
    )::int AS total_count,
    merged.competition_match_count,
    merged.training_match_count,
    merged.performance_session_count,
    merged.performance_activity_types
  FROM merged
  ORDER BY merged.activity_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_activity_calendar(date, date, text) TO authenticated;

COMMENT ON FUNCTION public.get_user_activity_calendar(date, date, text)
IS 'Aggregates daily user activity for activity calendar (competition matches, training matches, performance sessions).';
