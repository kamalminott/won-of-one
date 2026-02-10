-- Add L96 to match_de_round enum for competition direct elimination rounds

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'match_de_round'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'match_de_round'
        AND e.enumlabel = 'L96'
    ) THEN
      ALTER TYPE public.match_de_round ADD VALUE 'L96' AFTER 'L128';
    END IF;
  END IF;
END $$;
