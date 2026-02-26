-- Club Competition V1 - Participant trigger RLS fix
-- Ensures participant insert/update/delete trigger can bump competition.updated_at
-- without being blocked by club_competition update RLS.

CREATE OR REPLACE FUNCTION public.bump_club_competition_updated_at_from_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.club_competition
    SET updated_at = now()
    WHERE id = COALESCE(NEW.competition_id, OLD.competition_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.bump_club_competition_updated_at_from_participant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_club_competition_updated_at_from_participant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_club_competition_updated_at_from_participant() TO service_role;
