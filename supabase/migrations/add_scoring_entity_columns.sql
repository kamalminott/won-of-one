-- Add stable scoring entity mapping for anonymous score progression

ALTER TABLE public.match_event
ADD COLUMN IF NOT EXISTS scoring_entity TEXT;

COMMENT ON COLUMN public.match_event.scoring_entity IS
  'Stable scoring entity (fencerA/fencerB) recorded at event time; used for anonymous progression.';

ALTER TABLE public.match
ADD COLUMN IF NOT EXISTS fencer_1_entity TEXT,
ADD COLUMN IF NOT EXISTS fencer_2_entity TEXT;

COMMENT ON COLUMN public.match.fencer_1_entity IS
  'Stable entity (fencerA/fencerB) that ended on the left (fencer_1) at match completion.';
COMMENT ON COLUMN public.match.fencer_2_entity IS
  'Stable entity (fencerA/fencerB) that ended on the right (fencer_2) at match completion.';
