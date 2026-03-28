-- Admin active manual access list
-- Exposes the current set of users with active manual access grants.

CREATE OR REPLACE FUNCTION public.admin_list_active_access_users(
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
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_allowed';
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
    true AS has_active_access,
    active_grant.starts_at AS access_starts_at,
    active_grant.ends_at AS access_ends_at,
    active_grant.reason AS access_reason,
    active_grant.user_message AS access_message
  FROM user_source us
  JOIN LATERAL (
    SELECT
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
  ORDER BY
    active_grant.ends_at DESC,
    COALESCE(us.name, us.email, us.user_id::text) ASC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_active_access_users(integer) TO authenticated;
