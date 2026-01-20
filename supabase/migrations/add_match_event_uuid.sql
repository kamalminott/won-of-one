-- Add event_uuid for idempotent match event sync
alter table if exists public.match_event
  add column if not exists event_uuid uuid;

create unique index if not exists match_event_event_uuid_unique
  on public.match_event (event_uuid);
