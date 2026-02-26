-- Club Competition V1 - Join policy fix
-- Allows authenticated users to join registration-open/finalised competitions
-- without requiring pre-existing membership visibility on club_competition rows.

CREATE OR REPLACE FUNCTION public.can_join_club_competition(
  p_competition_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_competition c
    WHERE c.id = p_competition_id
      AND c.status IN ('registration_open', 'finalised')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_join_club_competition(uuid) TO authenticated;

DROP POLICY IF EXISTS authenticated_insert_club_competition_participant
  ON public.club_competition_participant;

CREATE POLICY authenticated_insert_club_competition_participant
  ON public.club_competition_participant
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (
        role = 'organiser'
        AND EXISTS (
          SELECT 1
          FROM public.club_competition c
          WHERE c.id = competition_id
            AND c.created_by_user_id = auth.uid()
        )
      )
      OR (
        role = 'participant'
        AND public.can_join_club_competition(competition_id)
      )
    )
  );
