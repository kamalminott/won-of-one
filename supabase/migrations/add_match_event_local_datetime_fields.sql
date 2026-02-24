-- Store event-local date context so history grouping remains stable across timezones.
ALTER TABLE public.match
  ADD COLUMN IF NOT EXISTS event_timezone text,
  ADD COLUMN IF NOT EXISTS event_local_date date,
  ADD COLUMN IF NOT EXISTS event_local_time time;

CREATE INDEX IF NOT EXISTS match_user_event_local_date_idx
  ON public.match (user_id, event_local_date DESC);

COMMENT ON COLUMN public.match.event_timezone IS
  'IANA timezone where the event was logged (e.g. Europe/London).';
COMMENT ON COLUMN public.match.event_local_date IS
  'Calendar date of the event in event_timezone.';
COMMENT ON COLUMN public.match.event_local_time IS
  'Clock time of the event in event_timezone.';
