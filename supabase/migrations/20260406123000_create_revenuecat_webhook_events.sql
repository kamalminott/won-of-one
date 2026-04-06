create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  environment text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_revenuecat_webhook_events_processed_at
  on public.revenuecat_webhook_events (processed_at desc);

alter table public.revenuecat_webhook_events enable row level security;

drop policy if exists "service_role_full_access_revenuecat_webhook_events"
  on public.revenuecat_webhook_events;

create policy "service_role_full_access_revenuecat_webhook_events"
  on public.revenuecat_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.revenuecat_webhook_events is
  'Stores processed RevenueCat webhook ids and payloads for idempotency and audit.';
