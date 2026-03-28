-- Admin manual access messages
-- Adds an optional user-facing message to manual grants and exposes it via admin/user RPCs.

ALTER TABLE public.manual_access_grant
ADD COLUMN IF NOT EXISTS user_message text;

ALTER TABLE public.manual_access_grant
DROP CONSTRAINT IF EXISTS manual_access_grant_user_message_length;

ALTER TABLE public.manual_access_grant
ADD CONSTRAINT manual_access_grant_user_message_length
CHECK (user_message IS NULL OR char_length(user_message) <= 180);

COMMENT ON COLUMN public.manual_access_grant.user_message IS
  'Optional short in-app message shown to the granted user when manual access is active.';

DROP FUNCTION IF EXISTS public.get_current_manual_access_status();
CREATE FUNCTION public.get_current_manual_access_status()
RETURNS TABLE (
  grant_id uuid,
  user_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  reason text,
  granted_by_user_id uuid,
  user_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id AS grant_id,
    g.user_id,
    g.starts_at,
    g.ends_at,
    g.reason,
    g.granted_by_user_id,
    g.user_message
  FROM public.manual_access_grant g
  WHERE g.user_id = v_actor_id
    AND g.revoked_at IS NULL
    AND g.starts_at <= now()
    AND g.ends_at > now()
  ORDER BY g.ends_at DESC
  LIMIT 1;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_search_access_users(text, integer);
CREATE FUNCTION public.admin_search_access_users(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  has_active_access boolean,
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  access_reason text,
  access_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_query text := NULLIF(trim(p_query), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF v_query IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH user_source AS (
    SELECT
      au.id AS user_id,
      COALESCE(apu.email, au.email) AS email,
      NULLIF(apu.name, '') AS name
    FROM auth.users au
    LEFT JOIN public.app_user apu
      ON apu.user_id = au.id
  )
  SELECT
    us.user_id,
    us.email,
    us.name,
    active_grant.id IS NOT NULL AS has_active_access,
    active_grant.starts_at AS access_starts_at,
    active_grant.ends_at AS access_ends_at,
    active_grant.reason AS access_reason,
    active_grant.user_message AS access_message
  FROM user_source us
  LEFT JOIN LATERAL (
    SELECT
      g.id,
      g.starts_at,
      g.ends_at,
      g.reason,
      g.user_message
    FROM public.manual_access_grant g
    WHERE g.user_id = us.user_id
      AND g.revoked_at IS NULL
      AND g.starts_at <= now()
      AND g.ends_at > now()
    ORDER BY g.ends_at DESC
    LIMIT 1
  ) active_grant ON true
  WHERE
    us.user_id::text ILIKE '%' || v_query || '%'
    OR COALESCE(us.email, '') ILIKE '%' || v_query || '%'
    OR COALESCE(us.name, '') ILIKE '%' || v_query || '%'
  ORDER BY
    CASE
      WHEN us.user_id::text = v_query THEN 0
      WHEN lower(COALESCE(us.email, '')) = lower(v_query) THEN 1
      WHEN lower(COALESCE(us.name, '')) = lower(v_query) THEN 2
      WHEN us.user_id::text ILIKE v_query || '%' THEN 3
      WHEN COALESCE(us.email, '') ILIKE v_query || '%' THEN 4
      WHEN COALESCE(us.name, '') ILIKE v_query || '%' THEN 5
      ELSE 6
    END,
    COALESCE(active_grant.ends_at, '-infinity'::timestamptz) DESC,
    COALESCE(us.name, us.email, us.user_id::text) ASC
  LIMIT v_limit;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_grant_manual_access(uuid, integer, text, timestamptz, timestamptz);
CREATE FUNCTION public.admin_grant_manual_access(
  p_target_user_id uuid,
  p_duration_days integer DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_user_message text DEFAULT NULL
)
RETURNS public.manual_access_grant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_starts_at timestamptz := COALESCE(p_starts_at, now());
  v_ends_at timestamptz;
  v_grant public.manual_access_grant%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_ends_at := COALESCE(
    p_ends_at,
    CASE
      WHEN p_duration_days IS NOT NULL THEN v_starts_at + make_interval(days => p_duration_days)
      ELSE NULL
    END
  );

  IF v_ends_at IS NULL THEN
    RAISE EXCEPTION 'ends_at_required';
  END IF;

  IF v_ends_at <= v_starts_at THEN
    RAISE EXCEPTION 'invalid_grant_window';
  END IF;

  UPDATE public.manual_access_grant
  SET revoked_at = now(),
      revoked_by_user_id = v_actor_id,
      revoked_reason = COALESCE(NULLIF(trim(p_reason), ''), 'replaced_by_new_grant')
  WHERE user_id = p_target_user_id
    AND revoked_at IS NULL
    AND ends_at > now();

  INSERT INTO public.manual_access_grant (
    user_id,
    granted_by_user_id,
    starts_at,
    ends_at,
    reason,
    user_message
  )
  VALUES (
    p_target_user_id,
    v_actor_id,
    v_starts_at,
    v_ends_at,
    NULLIF(trim(p_reason), ''),
    NULLIF(left(trim(p_user_message), 180), '')
  )
  RETURNING * INTO v_grant;

  RETURN v_grant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_manual_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_access_users(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_manual_access(uuid, integer, text, timestamptz, timestamptz, text) TO authenticated;
