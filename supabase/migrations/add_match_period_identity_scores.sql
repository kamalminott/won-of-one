-- Add identity-based scores (entity-based) to match_period
ALTER TABLE public.match_period
  ADD COLUMN IF NOT EXISTS fencer_a_score integer,
  ADD COLUMN IF NOT EXISTS fencer_b_score integer;
