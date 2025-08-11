Won-Of-One — Product Requirements (requirements.md)

Last updated: 11 Aug 2025 (Europe/London)Status: Draft v1.0 for build in Cursor

Purpose: Give Cursor/AI and the team one definitive, implementation-ready specification for the Won-Of-One app (mobile-first; companion web). This covers product scope, user stories, non‑functional requirements, data model, APIs, UI/UX, and acceptance criteria for V1. Future ideas are parked in Roadmap.

0) Product vision & positioning

Mission: A user-first training & competition platform built by athletes for athletes. Start with fencing, designed to expand to other sports without rework.

Core value:

Track training and mindset in one place.

Log matches live with a Fencing Remote and capture rich data.

Turn habits into streaks & goals to drive consistent practice.

Keep an opponent history so athletes prepare smarter.

Guiding principles: simple, quick-to-log, playful (gamified streaks), reliable offline-first capture with real-time sync, generic data model (sport-agnostic entities), privacy-first.

1) In-scope (V1)

Platforms: Mobile app (React Native) with a minimal companion web (Next.js) for admin & content.

Auth: Email/password + Social (Apple/Google). Guest mode allowed (local-only until account creation).

Core features:

Home/Dashboard: today’s plan, active goals, streaks, quick actions.

Training Tracker: create & log training sessions; attach drills; track time, volume, RPE; after‑action notes; tags (Focus Areas: Technical, Physical, Sparring, etc.).

Self‑Training ("Train Now"): quick ad‑hoc session creation → pick drills/routines → log reps/time; V1 excludes Training Library & Saved Routines pages.

Goals: set SMART-ish goals; progress bars; auto-progress via backend tagging of logged sessions.

Mindset Builder: quick mental mode selection (Pre‑Fight, Post‑Fight, Reset). Copy: “Choose your goal for this session” + prompt “How much time do you have?” → launch audio/video tools → log reflection.

Fencing Remote: live match logging; timer, cards, per‑fencer hit indicator;

Warning if a fencer’s score increments twice while timer is stopped.

Match Diary (aka Fight Diary): store matches, events, cards, timestamps; tie to opponents; streaks.

Opponent History: opponent profiles + head‑to‑head stats.

Notifications: goal nudges, streak reminders, session follow‑ups.

Admin Panel: content management (via Sanity CMS), manage featured drills/resources, moderate reports; basic data export.

Content: Sanity CMS for editorial content (articles, tips, playlists) surfaced in Mindset & Training.

Data: Relational DB (Postgres, via Supabase). Real‑time via websockets (Supabase Realtime). Storage for media (Supabase Storage).

Analytics: product analytics & event funneling (open-source or third‑party; see Non‑functional).

2) Out-of-scope (V1)

Training Library page (browse all drills) ❌

Saved Routines ❌

Full streaming/broadcasting suite (keep placeholders) ❌

Advanced community/social graphs ❌

Payments/subscriptions (placeholder hooks only) ❌

3) Users & personas (V1)

Athlete (Primary): logs training & matches; uses mindset tools; tracks goals & streaks; wants quick interaction.

Coach (Secondary): reviews athletes’ logs and stats (read‑only in V1, limited sharing).

Admin (Internal): curates content; moderates data; exports.

4) Non‑functional requirements

Performance:

Critical UI interactions < 100ms feedback.

Remote controls (timer, score) visible update < 200ms on good network.

Reliability: offline-first logging; queue + sync on reconnect; conflict policy defined below.

Security: OAuth 2.0/OIDC; hashed passwords (argon2/bcrypt); RLS on Supabase; least privilege; audit trails for admin actions.

Privacy: GDPR compliant; explicit consent for analytics; data export & delete‑me flows.

Accessibility: WCAG AA at minimum; color‑blind safe hit indicators.

Internationalization: string externalization; UIs support future languages.

5) Architecture

Client: React Native app (Expo), TypeScript, Zustand/Redux for state; Web: Next.js (TypeScript).

Backend: Supabase (Postgres + Auth + Realtime + Storage); Edge functions for custom logic.

CMS: Sanity for editorial content & Mindset resources; fetch via GROQ.

Realtime: Supabase channels for matches; optimistic UI.

Caching:

Client: normalized cache for entities;

HTTP: stale‑while‑revalidate for CMS/content;

Local: SQLite/AsyncStorage for offline queues.

Testing: unit (Jest), component (React Native Testing Library), E2E (Detox), API contract (Zod/TypeBox), load tests for realtime rooms.

6) Data model (relational)

Entities are sport‑agnostic with fencing‑specific fields optional.

6.1 Core tables

users

id (uuid, pk)

email (text, unique)

display_name (text)

avatar_url (text)

is_guest (bool)

created_at (timestamptz)

profiles (1:1 users)

user_id (uuid, pk, fk users.id)

primary_sport (text)

handedness (text)

country (text)

bio (text)

opponents

id (uuid, pk)

user_id (uuid, fk users.id) owner

name (text)

club (text)

country (text)

notes (text)

tags (text[])

matches

id (uuid, pk)

user_id (uuid, fk users.id)

opponent_id (uuid, fk opponents.id, nullable)

date (date)

competition (text)

weapon (text) epee/foil/sabre or sport discipline

result (text) W/L/D

score_for (int)

score_against (int)

duration_sec (int)

notes (text)

approved (bool)

match_events (ordered timeline)

id (uuid, pk)

match_id (uuid, fk matches.id)

ts_ms (bigint) client timestamp

type (text) hit_for, hit_against, card_yellow, card_red, start_timer, stop_timer, pause, resume, period_end, etc.

meta (jsonb) {"by":"A|B","reason":"corp","card_ref":"..."}

training_sessions

id (uuid, pk)

user_id (uuid, fk users.id)

date (date)

focus_area (text) Technical|Physical|Sparring|Mindset

title (text)

duration_min (int)

rpe (int) 1–10

notes (text)

tags (text[])

drills

id (uuid, pk)

name (text)

sport (text)

description (text)

metrics_schema (jsonb) how to measure: reps, sets, time, distance

is_featured (bool)

session_drills (M:N sessions↔drills)

id (uuid, pk)

session_id (uuid, fk training_sessions.id)

drill_id (uuid, fk drills.id)

sets (int)

reps (int)

time_sec (int)

load (numeric)

notes (text)

goals

id (uuid, pk)

user_id (uuid, fk users.id)

title (text)

type (text) count, time, streak, performance

target_value (numeric)

current_value (numeric) auto-calculated

unit (text) sessions, minutes, wins

due_date (date)

is_active (bool)

auto_progress_rule (jsonb) tags/focus/metric mapping

streaks (per user and dimension)

id (uuid, pk)

user_id (uuid, fk users.id)

dimension (text) global_training | by_focus | by_drill | by_match_type

key (text) e.g., drill_id, focus_area

current_count (int)

best_count (int)

last_incremented_at (date)

streak_events

id (uuid, pk)

streak_id (uuid, fk streaks.id)

occurred_on (date)

source (text) training_session | match | mindset

source_id (uuid)

mindset_tools (CMS-backed index)

id (uuid, pk)

title (text)

mode (text) Pre‑Fight|Post‑Fight|Reset

media_type (text) audio|video|text

duration_min (int)

intensity (text) light|medium|deep

cms_id (text) link to Sanity

mindset_sessions

id (uuid, pk)

user_id (uuid)

selected_goal (text)

mode (text)

time_budget_min (int)

tool_id (uuid, fk mindset_tools.id)

completed_at (timestamptz)

reflection (text)

fencing_remote_rooms (realtime)

id (uuid, pk)

match_id (uuid, fk matches.id)

status (text) open|closed

created_by (uuid, fk users.id)

match_approvals (optional workflow)

id (uuid, pk)

match_id (uuid, fk matches.id)

approver_user_id (uuid, fk users.id or null)

status (text) pending|approved|rejected

notes (text)

Indexes: composite on (user_id, date) for training_sessions & matches; GIN on tags; btree on (match_id, ts_ms).

6.2 Data rules

Streak increments once per UTC day per dimension. Grace for missed day is not applied in V1.

Auto‑goal progress: server function scans new session/match rows → matches auto_progress_rule → updates current_value (idempotent via unique (goal_id, source_id)).

Guest data stored locally; promote to account on signup (client performs merge via deterministic UUID v5 namespaces).

7) API & realtime contracts (high-level)

7.1 REST/Edge functions (examples)

POST /sessions → create session with drills payload.

POST /sessions/:id/drills → add drills to session.

POST /goals | PATCH /goals/:id.

POST /matches → creates match & opens realtime room.

POST /matches/:id/events → append event (server validates timer state; may emit warnings as events).

POST /mindset/sessions → start/complete a mindset session.

GET /opponents/:id → profile + stats.

7.2 Realtime channels

Channel: match:{match_id}

Events: timer:start|stop|pause|resume, score:for|against, card:yellow|red, warning:double-increment-while-stopped.

Payload: { by:"A|B", ts: number, meta?: {} }.

7.3 Validation

Zod schemas for all payloads; server re-validates; rate limit write endpoints.

8) Feature specs & acceptance criteria

8.1 Authentication & onboarding

User flows:

New → choose Guest or Sign In/Up.

Guest can fully log; on exit or share, prompt to save by creating account.

Acceptance:



8.2 Home / Dashboard

Widgets: Today’s plan, Active goals (top 3), Streaks summary (global + top focus), Quick actions: Train Now, Log Match, Mindset.

Acceptance:



8.3 Training Tracker

Create: title, date, focus_area, duration, RPE, tags; attach drills with per‑set metrics.

After‑action: notes; mark as complete.

Acceptance:



8.4 Self‑Training — Train Now

Flow: Pick focus → pick drills (search/typeahead) → log reps/time in one compact screen → save.

V1 exclusions: Training Library page, Saved Routines.

Acceptance:



8.5 Mindset Builder

Copy: “Choose your goal for this session” + “How much time do you have?”.

Mode tabs: Pre‑Fight, Post‑Fight, Reset; filter by time/intensity; play resource; optional reflection note.

Acceptance:



8.6 Fencing Remote (live logging)

UI: timer (start/stop/pause), score for A/B, per‑fencer hit indicator flash on increment, card buttons, period controls.

Guardrail: If score increment while timer stopped, allow once (for adjudicated point), but on a second increment without timer change → emit warning:double-increment-while-stopped event and show toast.

Acceptance:



8.7 Match Diary

Data: final score, events timeline, cards, notes, opponent link, competition.

Acceptance:



8.8 Opponent History

Profile: name/club/country/tags; head‑to‑head (W/L, point differential), notes.

Acceptance:



8.9 Goals & Streaks

Goals: create, edit, archive; progress bars; auto-progress rules (by tags/focus/drill).

Streaks: shown on Home and Training Tracker; dimensions per focus & drill.

Acceptance:



8.10 Notifications

Types: daily streak reminder (opt‑in), goal deadline reminder, post‑session reflection nudge.

Acceptance:



8.11 Admin Panel (web)

Functions: sign‑in; manage featured drills; edit CMS mappings; export CSV of sessions/matches; toggle flags.

Acceptance:



9) UI/UX guidelines

Style: modern, minimal, playful. Choose the lighter, gamified dashboard direction (inspired by prior design preference). Add streaks to keep users engaged.

Components: modular; reusable cards; progress bars; pills for tags.

Hit indicators: high contrast, non‑red/green dependent; distinct motion cue.

Copy tone: concise, motivational.

Accessibility: min 44pt tap targets; dynamic type.

10) Content (Sanity CMS)

Schemas: Article, Tip, Playlist, MindsetTool (mirrors DB), DrillGuide (editorial write‑ups), FeaturedCollections.

Delivery: GROQ queries; cache SWR; fallback to local seed if offline.

11) Caching & offline

Local store: all create/update operations append to an Outbox with a UUID.

Sync: exponential backoff; conflict = server last‑write‑wins but client preserves prior version in a history table for manual resolve.

SWR for read APIs with optimistic updates.

12) Security, privacy, compliance

Auth: Supabase Auth with Apple/Google; short‑lived JWT + refresh.

RLS: every table scoped by user_id except public references; admins via JWT claim role=admin.

PII: encrypted at rest; media access via signed URLs.

GDPR: export (JSON/CSV) and delete-my-data endpoints.

13) Analytics & telemetry

Events: app_open, session_create, session_complete, drill_add, goal_create, goal_progress_auto, streak_increment, match_create, match_event, mindset_complete, warning_double_increment.

KPIs: WAU/MAU, D1/D7 retention, avg sessions/week, goal completion rate, streak distribution.

Privacy: user opt‑in; sampling allowed.

14) Testing strategy

Unit: business rules for streaks, goals auto‑progress.

E2E: create session offline → sync; fencing remote multi‑client test; warning rule.

Contracts: Zod schemas shared client/server.

Load: 100 concurrent realtime clients per match room without event loss.

15) Release plan (V1)

Milestone A: Auth + Data model + Admin scaffolding.

Milestone B: Training Tracker + Goals + Streaks.

Milestone C: Self‑Training (Train Now) + Mindset Builder.

Milestone D: Fencing Remote + Match Diary + Opponent History.

Milestone E: Notifications + Analytics + Polishing + Accessibility.

16) Open questions / decisions

Do we need per‑weapon rule presets in Remote (periods, target score) for V1? Default to simple race to 15 + 3x3min optional.

Import from camera video timelines later? (deferred)

Sharing with coach in V1? Read‑only sharable link? (stretch)

17) Roadmap (post‑V1)

Training Library, Saved Routines; community programs.

Subscriptions & coach dashboards.

Device integrations (wearables, scoring boxes) and automated hit detection.

Deeper opponent scouting; recommendation engine.

18) Glossary

Train Now: the quick-entry Self‑Training flow (renamed from “Create New Session”).

Match Diary/Fight Diary: match log detail screen.

Fencing Remote: in‑app live match controller + logger.

Focus Area: the primary training intent: Technical, Physical, Sparring, Mindset.

19) Acceptance test checklist (summary)



Appendix A — Example SQL DDL (sketch)

create table if not exists users (
  id uuid primary key,
  email text unique,
  display_name text,
  avatar_url text,
  is_guest boolean default false,
  created_at timestamptz default now()
);

create table if not exists training_sessions (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  date date not null,
  focus_area text not null,
  title text,
  duration_min int,
  rpe int,
  notes text,
  tags text[],
  created_at timestamptz default now()
);

create table if not exists streaks (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  dimension text not null,
  key text,
  current_count int default 0,
  best_count int default 0,
  last_incremented_at date
);

create table if not exists matches (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  opponent_id uuid references opponents(id),
  date date not null,
  competition text,
  weapon text,
  result text,
  score_for int default 0,
  score_against int default 0,
  duration_sec int,
  notes text,
  approved boolean default false
);


