-- Extend the global leaderboard RPC with all-time wins and matches rankings.

CREATE INDEX IF NOT EXISTS match_completed_user_activity_idx
  ON public.match (user_id, event_date DESC)
  WHERE is_complete = true
    AND event_date IS NOT NULL
    AND user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_global_weekly_match_leaderboard(
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
  v_week_start_utc timestamptz := (date_trunc('week', now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC';
  v_next_reset_utc timestamptz := ((date_trunc('week', now() AT TIME ZONE 'UTC')) + interval '7 days') AT TIME ZONE 'UTC';
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN (
    WITH weekly_rows AS (
      SELECT
        m.user_id,
        COALESCE(NULLIF(btrim(apu.name), ''), 'Won Of One User') AS display_name,
        NULLIF(apu.profile_image_url, '') AS profile_image_url,
        COUNT(*)::int AS matches_played,
        COUNT(*) FILTER (WHERE COALESCE(m.is_win, false))::int AS wins,
        MAX(m.event_date) AS latest_activity_at
      FROM public.match m
      LEFT JOIN public.app_user apu
        ON apu.user_id = m.user_id
      WHERE m.user_id IS NOT NULL
        AND m.is_complete = true
        AND m.event_date IS NOT NULL
        AND m.event_date >= v_week_start_utc
        AND m.event_date < v_next_reset_utc
      GROUP BY
        m.user_id,
        COALESCE(NULLIF(btrim(apu.name), ''), 'Won Of One User'),
        NULLIF(apu.profile_image_url, '')
    ),
    all_time_rows AS (
      SELECT
        m.user_id,
        COALESCE(NULLIF(btrim(apu.name), ''), 'Won Of One User') AS display_name,
        NULLIF(apu.profile_image_url, '') AS profile_image_url,
        COUNT(*)::int AS matches_played,
        COUNT(*) FILTER (WHERE COALESCE(m.is_win, false))::int AS wins,
        MAX(m.event_date) AS latest_activity_at
      FROM public.match m
      LEFT JOIN public.app_user apu
        ON apu.user_id = m.user_id
      WHERE m.user_id IS NOT NULL
        AND m.is_complete = true
        AND m.event_date IS NOT NULL
      GROUP BY
        m.user_id,
        COALESCE(NULLIF(btrim(apu.name), ''), 'Won Of One User'),
        NULLIF(apu.profile_image_url, '')
    ),
    ordered_wins AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY
            wins DESC,
            matches_played DESC,
            latest_activity_at DESC,
            user_id ASC
        )::int AS rank,
        user_id,
        display_name,
        profile_image_url,
        wins,
        matches_played,
        latest_activity_at
      FROM weekly_rows
    ),
    ordered_matches AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY
            matches_played DESC,
            latest_activity_at DESC,
            user_id ASC
        )::int AS rank,
        user_id,
        display_name,
        profile_image_url,
        wins,
        matches_played,
        latest_activity_at
      FROM weekly_rows
    ),
    ordered_all_time_wins AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY
            wins DESC,
            matches_played DESC,
            latest_activity_at DESC,
            user_id ASC
        )::int AS rank,
        user_id,
        display_name,
        profile_image_url,
        wins,
        matches_played,
        latest_activity_at
      FROM all_time_rows
    ),
    ordered_all_time_matches AS (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY
            matches_played DESC,
            latest_activity_at DESC,
            user_id ASC
        )::int AS rank,
        user_id,
        display_name,
        profile_image_url,
        wins,
        matches_played,
        latest_activity_at
      FROM all_time_rows
    )
    SELECT jsonb_build_object(
      'week_start_utc', to_jsonb(v_week_start_utc),
      'week_end_utc', to_jsonb(v_next_reset_utc),
      'next_reset_utc', to_jsonb(v_next_reset_utc),
      'total_ranked_users', COALESCE((SELECT COUNT(*)::int FROM ordered_wins), 0),
      'all_time_total_ranked_users', COALESCE((SELECT COUNT(*)::int FROM ordered_all_time_wins), 0),
      'wins_leaderboard', jsonb_build_object(
        'entries',
          COALESCE(
            (
              SELECT jsonb_agg(to_jsonb(top_rows) ORDER BY top_rows.rank)
              FROM (
                SELECT *
                FROM ordered_wins
                ORDER BY rank
                LIMIT v_limit
              ) AS top_rows
            ),
            '[]'::jsonb
          ),
        'current_user_entry',
          (
            SELECT to_jsonb(current_row)
            FROM (
              SELECT *
              FROM ordered_wins
              WHERE user_id = v_actor_id
              LIMIT 1
            ) AS current_row
          )
      ),
      'matches_leaderboard', jsonb_build_object(
        'entries',
          COALESCE(
            (
              SELECT jsonb_agg(top_rows_json ORDER BY top_rows_rank)
              FROM (
                SELECT
                  to_jsonb(top_rows) AS top_rows_json,
                  top_rows.rank AS top_rows_rank
                FROM (
                  SELECT *
                  FROM ordered_matches
                  ORDER BY rank
                  LIMIT v_limit
                ) AS top_rows
              ) AS ranked_rows
            ),
            '[]'::jsonb
          ),
        'current_user_entry',
          (
            SELECT to_jsonb(current_row)
            FROM (
              SELECT *
              FROM ordered_matches
              WHERE user_id = v_actor_id
              LIMIT 1
            ) AS current_row
          )
      ),
      'all_time_wins_leaderboard', jsonb_build_object(
        'entries',
          COALESCE(
            (
              SELECT jsonb_agg(to_jsonb(top_rows) ORDER BY top_rows.rank)
              FROM (
                SELECT *
                FROM ordered_all_time_wins
                ORDER BY rank
                LIMIT v_limit
              ) AS top_rows
            ),
            '[]'::jsonb
          ),
        'current_user_entry',
          (
            SELECT to_jsonb(current_row)
            FROM (
              SELECT *
              FROM ordered_all_time_wins
              WHERE user_id = v_actor_id
              LIMIT 1
            ) AS current_row
          )
      ),
      'all_time_matches_leaderboard', jsonb_build_object(
        'entries',
          COALESCE(
            (
              SELECT jsonb_agg(top_rows_json ORDER BY top_rows_rank)
              FROM (
                SELECT
                  to_jsonb(top_rows) AS top_rows_json,
                  top_rows.rank AS top_rows_rank
                FROM (
                  SELECT *
                  FROM ordered_all_time_matches
                  ORDER BY rank
                  LIMIT v_limit
                ) AS top_rows
              ) AS ranked_rows
            ),
            '[]'::jsonb
          ),
        'current_user_entry',
          (
            SELECT to_jsonb(current_row)
            FROM (
              SELECT *
              FROM ordered_all_time_matches
              WHERE user_id = v_actor_id
              LIMIT 1
            ) AS current_row
          )
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_weekly_match_leaderboard(integer) TO authenticated;

COMMENT ON FUNCTION public.get_global_weekly_match_leaderboard(integer)
IS 'Returns global weekly and all-time leaderboard rankings for wins and matches played.';
