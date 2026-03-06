# Won Of One — Club Competition Flow (V1) Planning Tracker

## Document Control
- Status: Implementation in progress (Phase 1-8 core complete, Phase 8 validation pending)
- Last updated: 2026-03-01
- Product area: Competitions pillar
- Working rule: Any scope/behavior change must be logged in `Change Log` and, if architectural, in `Decision Log`

## 0) Context and Key Constraints

### What we are building
- A new core pillar in the bottom tab bar: `Competitions`
- Clubs can run a full fencing competition from phones:
- Quick join via QR / short code
- Randomized poules, with light manual adjustment
- Live match scoring via Remote or Manual
- Live rankings from poules
- Auto-generated DE tableau seeded from rankings (or random/manual if no poules)
- Live progress updates for participants
- Role management: Organiser / Participant
- Editable results with guardrails (two-person agreement can be staged in V1)

### What we are NOT building in V1
- Club separation / mixing logic
- Federation-grade referee rotation / strip management
- Public competition discovery
- Team events
- Complex dispute workflows / protests
- Multi-weapon events in one competition instance

### Design system constraints (match existing app)
- Dark surfaces: `#171717`, `#151718`, `#2A2A2A`, `#212121`
- Primary accent purple: `#8B5CF6`, `#6C5CE7`
- Light lavender borders/text: `#E9D7FF`, `rgba(200,166,255,...)`
- Text: white primary, muted gray secondary `#9D9D9D` or white with opacity
- Semantic colors:
- Win: `#10B981`
- Loss: `#EF4444` / `#FF7675`

## 1) Navigation + Screen Architecture (Competition Pillar)

### 1.1 Bottom tab update
- Existing: `Home`, `Remote`, `Training`, `Mindset`, `Profile`
- New: `Home`, `Remote`, `Training`, `Competitions`, `Mindset`, `Profile`

### 1.2 Competition stack under Competitions tab
- Competitions Hub (root)
- Create Competition
- Join Competition
- Competition Overview (main control page)
- Participants & Roles
- Poules
- Rankings
- DE Tableau (Bracket)
- Manual Score Entry
- Modals:
- Scoring Method Bottom Sheet (Remote vs Manual)
- Agreement Modal (two-person confirmation on edits)

Naming rule:
- Use `Competition Overview` (not `Dashboard`)

## 2) Roles and Permissions (V1)

### 2.1 Roles
- Organiser: creator + promoted users
- Participant: standard user
- Referee role deferred to V2

### 2.2 Role capabilities
Organiser can:
- Create competition
- View join code + QR
- Add/remove participants (during registration)
- Lock/unlock registration
- Generate poules
- Drag/drop poule assignments (before locking)
- Lock/unlock poules (with warnings)
- View rankings
- Lock rankings
- Generate DE tableau
- Override match results (admin)
- Mark participant withdrawn
- Finalise competition (freeze results)
- Promote participant to organiser
- Demote organiser to participant (except last organiser)

Participant can:
- Join competition
- View competition overview
- View poules / rankings / bracket
- Score matches (subject to scoring rules)
- See live progress

### 2.3 Safety rules
- Cannot demote the last organiser
- Organiser cannot leave unless another organiser exists
- Destructive structure changes require confirmation (unlock poules, regenerate bracket, etc.)

## 3) Data Model (Proposed Entities)

### 3.1 `Competition`
- `id`
- `name`
- `weapon` (`foil|epee|sabre`)
- `format` (`poules_only|poules_then_de|de_only`)
- `de_touch_limit` (`10|15`)
- `status` (`registration_open|registration_locked|poules_generated|poules_locked|rankings_locked|de_generated|finalised`)
- `join_code` (short code)
- `created_by_user_id`
- timestamps

### 3.2 `CompetitionParticipant`
- `id`
- `competition_id`
- `user_id` (required, authenticated users only in V1)
- `display_name`
- `role` (`organiser|participant`)
- `status` (`active|withdrawn|dns`)
- timestamps

### 3.3 `Pool`
- `id`
- `competition_id`
- `pool_label` (`A|B|C...`)
- timestamps

### 3.4 `PoolAssignment`
- `id`
- `pool_id`
- `participant_id`
- `position` (int)
- timestamps

### 3.5 `CompetitionMatch` (linked to existing `Match`)
- `id`
- `competition_id`
- `stage` (`poule|de`)
- `round_label` (DE: `L64|L32|L16|QF|SF|F`)
- `pool_id` (nullable for DE)
- `fencer_a_participant_id`
- `fencer_b_participant_id`
- `touch_limit` (`5|10|15`)
- `status` (`pending|live|completed`)
- `scoring_mode` (`remote|manual`)
- `authoritative_scorer_user_id` (nullable)
- `result_confirm_status` (`confirmed|pending_approval|rejected`)
- timestamps

### 3.6 `MatchEditRequest` (two-person agreement)
- `id`
- `competition_match_id`
- `proposed_score_a`
- `proposed_score_b`
- `requested_by_user_id`
- `approved_by_user_id` (nullable)
- `status` (`pending|approved|rejected`)
- timestamps

## 4) State Machines (Critical)

### 4.1 Competition status progression
- `registration_open`
- `registration_locked`
- `poules_generated`
- `poules_locked`
- `rankings_locked`
- `de_generated`
- `finalised`

V1 simplification allowed:
- UI can compress state display, but backend must still track lock/generation milestones.

### 4.2 Match status
- `pending -> live -> completed`
- Optional staged state:
- `completed_pending_approval` (if two-person confirmation required)

### 4.3 Authoritative scorer rules (Remote)
- On `Use Remote`:
- If no authoritative scorer: assign current user
- If scorer exists and current user differs: open view-only + show scorer identity
- Organiser can take over
- On completion: lock scorer context and mark `completed`

## 5) Screen-by-Screen Requirements

### 5.1 Competitions Hub (Root)
UI:
- Title: `Competition Hub`
- Sections: `Active`, `Past`
- Section semantics:
- `Active` = every competition not in `finalised` status
- `Past` = `finalised` competitions only
- Sort order:
- `Active`: latest activity first (`updated_at` descending)
- `Past`: most recently finalised first (`finalised_at` descending)
- CTAs: `Create Competition` (primary), `Join` (secondary)
- Card fields:
- Name
- Weapon
- Status badge
- Participant count
- Role badge
- Tap opens Competition Overview
- Finalised competition tap behavior:
- Opens Competition Overview in read-only mode (no editing actions)
- V1 scope guard:
- No search/filter on Hub in V1
- Realtime behavior (V1 locked):
- Hub list receives realtime updates for create/join/status transitions and participant counts
- Fallback refresh remains available via pull-to-refresh and screen focus refresh

Events:
- `competition_hub_viewed`
- `competition_opened`

### 5.2 Create Competition
Fields:
- Name
- Weapon
- Format (`poules only|poules+DE|DE only`)
- DE touch limit (`10|15`)
- Validation and editability rules (V1 locked):
- Duplicate competition names are allowed
- `join_code` is 6-digit numeric
- `join_code` must be unique among non-finalised competitions (regenerate on collision)
- Organiser can edit name/weapon/format/de-touch-limit only while registration is open and before poules are generated

After create:
- Generate `join_code`
- Generate QR deep-link payload containing `join_code` + `competition_id`
- Navigate to Competition Overview

Events:
- `competition_created`

### 5.3 Join Competition
Inputs:
- Code (6 digits)
- Scan QR
- Join
- Guardrails and policy (V1 locked):
- Failed attempts: max 5 invalid join attempts, then 5-minute cooldown
- QR validation: if `competition_id` and `join_code` do not match, reject as invalid/expired QR
- Registration-locked competitions: block new joins; existing participants retain access
- Finalised competitions: allow join/read-only access

Outcomes:
- Success: add participant, navigate to Competition Overview
- Error: invalid code message
- If finalised: competition opens in read-only mode

Events:
- `competition_join_attempt`
- `competition_join_success`
- `competition_join_error`

### 5.4 Competition Overview (Main)
Shared content:
- Competition name
- Status banner
- Role badge
- Participant count
- Progress block:
- current phase progress: `completed / total` in phase
- overall event progress: `completed / total` across all competition matches
- Navigation buttons:
- Participants & Roles
- Poules
- Rankings
- DE Tableau

Organiser-only:
- V1 interaction model (guided flow):
- show one primary "next step" action based on status (for example: `Lock Registration`, then `Generate Poules`, then `Lock Poules`, etc.)
- expose secondary controls in a `More Actions` entry point
- Future-ready requirement:
- keep backend/state permission support for full-controls mode (always-visible control list) so it can be enabled later with minimal UI change
- Finalised behavior:
- hide all organiser action buttons and show read-only/finalised banner

Participant-only:
- My stats:
- fights left
- W/L
- indicator
- current rank (if available)
- V1 interaction model:
- show only `My Next Match` on overview
- My next match card fields:
- opponent
- stage/round
- tap to scoring method selection
- Future-ready requirement:
- include support for an optional `All Upcoming Matches` list in overview data contract, but keep it hidden in V1 UI

Events:
- `competition_overview_viewed`
- `registration_locked`
- `registration_unlocked`
- `poules_generated`
- `rankings_locked`
- `de_generated`
- `competition_finalised`

### 5.5 Participants & Roles
List row fields:
- Avatar initial
- Display name
- Role badge
- Optional status (`active|withdrawn`)
- Action menu for organisers

Organiser actions:
- Promote to organiser
- Demote to participant (disabled for last organiser)
- Remove participant (registration open only)
- Mark withdrawn (during poules/DE)

Policy and guardrails (V1 locked):
- Removing participants is not allowed after registration is locked; organiser must use `Withdraw`
- Role changes are allowed throughout event lifecycle (except last organiser cannot be demoted)
- Participant self-leave is allowed only before registration is locked
- Withdrawn participants remain visible in the list with a `Withdrawn` badge

Events:
- `participant_promoted`
- `organiser_demoted`
- `participant_removed`
- `participant_withdrawn`

### 5.6 Poules screen
Content:
- Poule tabs (`A/B/C...`)
- Poule table columns:
- name
- wins
- losses
- indicator
- hits scored/received
- fights remaining
- Match list:
- fencer vs fencer
- status (`pending|live|completed`)
- tap match opens scoring method sheet

Organiser controls:
- Regenerate (only before any match scored)
- Drag/drop assignments (only before poules locked)
- Lock poules

Generation and lock rules (V1 locked):
- Target poule size is 6; balancing may produce poules of 5-7 as needed
- Initial assignment method: random shuffle of all active participants, then balanced split (pool-size difference max 1)
- Regenerate poules is allowed only before any poule match has been scored
- Manual drag/drop edits are allowed only before poules are locked
- Uneven counts are allowed; final poule sizes can differ by at most 1
- Withdrawal handling in poules (V1 locked):
- If a fencer withdraws mid-poule, remaining unplayed bouts are canceled/removed (no forfeit scores assigned)
- Already-completed bouts involving the withdrawn fencer are annulled for poule ranking purposes
- Affected upcoming bout rows show explicit `Canceled (Withdrawal)` status to opponents

Events:
- `poules_viewed`
- `poule_locked`
- `poule_regenerated`

### 5.7 Rankings screen
Content:
- Ranked list `1..N`
- Fields per participant:
- victories
- indicator
- hits scored
- hits received
- Tie-break caption: `Win% -> Indicator -> Hits -> Head-to-Head -> Random Draw`
- Auto-refresh after each poule match

Organiser controls:
- Lock rankings
- Generate DE (if format includes DE)

Policy and lock behavior (V1 locked):
- Withdrawn participants remain visible in rankings with `Withdrawn` badge
- Once rankings are locked, poule score edits are blocked
- Rankings update live after every completed poule match
- Rankings include a small note when withdrawal-annulment adjustments are applied
- Final tie-break fallback:
- If still tied after `Win% -> Indicator -> Hits`, apply `Head-to-Head`
- If still unresolved (for example unresolved multi-way tie), use random draw

Events:
- `rankings_viewed`
- `rankings_locked`

### 5.8 DE tableau screen
Content:
- Bracket rounds (`L32/L16/QF/SF/F`)
- Match card:
- fencer A / fencer B
- score if completed
- status
- tap match opens scoring method sheet
- Winner auto-advances

Organiser controls:
- Override result
- Mark withdrawal
- Optional reset match (warning)

Generation and control rules (V1 locked):
- Seeding source: locked rankings
- Byes: highest seeds receive auto-advance byes to next round
- Bronze/third-place match: not included in V1
- Reset completed DE match: allowed only if dependent next-round match has not started
- DE withdrawal: opponent auto-advances and result recorded as walkover/forfeit
- Override result: organiser-only, requires mandatory reason, and writes an audit log (old result, new result, changed by, timestamp, reason)

Events:
- `de_viewed`
- `de_match_scored`
- `de_winner_advanced`

### 5.9 Scoring method bottom sheet
Options:
- Use Remote (Live)
- Enter Score Manually
- Cancel

Rules and behavior (V1 locked):
- No default option pre-selected; user must explicitly choose Remote or Manual
- If match already has `scoring_mode` assigned, skip sheet and deep-link directly to that mode
- If match is live and scored by another user:
- open read-only live view and show `Scored by X` banner
- organiser may `Take Over` only through explicit confirmation modal
- Switching scoring mode is blocked once match is `live` (allowed only before first score)

Events:
- `scoring_method_sheet_opened`
- `scoring_method_selected`
- `remote_scoring_started`
- `scoring_takeover_initiated`
- `scoring_takeover_confirmed`

### 5.10 Manual score entry
Fields:
- score A
- score B

Behavior (V1 locked):
- Auto determine winner/loser
- Save marks match completed
- Cascades update to poules/rankings/bracket
- Validation:
- no ties allowed
- one side must equal match touch limit
- other side must be below touch limit
- Save UX:
- disable Save immediately on first tap and show saving state (prevents double-submit)
- Edit policy:
- post-submit edits are organiser-only through override flow (reason + audit log)
- Offline policy:
- block save when offline for live competition matches
- Agreement policy:
- two-person agreement is disabled by default in V1 (feature-flag ready)
- If two-person agreement is enabled later:
- create approval request
- show pending badge until resolved
- Post-save navigation:
- return to originating context (Poules/DE) and show success toast

Events:
- `manual_score_submitted`

### 5.11 Agreement modal (optional staged V1)
Triggers:
- Score edit
- Or all manual entry (if selected policy)

Flow:
- User A submits
- User B prompted to confirm
- Approve/reject

Events:
- `result_approval_requested`
- `result_approved`
- `result_rejected`

V1 rollout decision (locked):
- Agreement modal is staged OFF by default in V1 (feature-flag only)
- Default V1 behavior: organiser override with required reason + audit log; no two-person approval gate
- Post-V1 option: enable agreement modal for manual entry and/or result edits without schema changes

## 6) Integration With Existing Match System

### 6.1 Match history and stats integration
- `CompetitionMatch` will create/link to a regular `Match` record immediately (1:1 at creation time)
- V1 integration behavior (locked):
- Competition-linked matches are shown only inside Competition screens
- Competition-linked matches are excluded from existing Match History and global search surfaces in V1
- Competition-linked matches are excluded from training aggregates/stats in V1
- Opening a competition match may reuse normal Match Details, but with a read-only competition-context banner
- Metadata persistence (locked):
- Persist stage metadata now on underlying match records: `competition_id`, `stage`, `round_label` (while still hidden from Match History/global search in V1)
- Post-V1 target:
- Enable Match History/stats display for competition matches with explicit `competition` context filters
- Existing match details infrastructure remains reusable for competition-linked records
- Competition screens remain the aggregated source of truth (poules/rankings/DE)

## 7) Real-Time Requirements (Club V1)
- Live score updates
- Poule table updates
- Rankings updates
- Bracket updates

Suggested channels:
- `competition:{id}`
- `match:{id}` for active scoring

Conflict and sync model (V1 locked):
- Source of truth: server-authoritative; clients may show optimistic updates but must reconcile to server state
- Event ordering/idempotency: apply only newer updates (version or monotonic `updated_at`); ignore stale events
- Reconnect behavior: on reconnect, refetch full active match plus affected aggregates (poule table/rankings/bracket) before resuming realtime-only flow
- Conflict UX: if optimistic client state is corrected by server, show subtle `Score updated` notice
- Subscription scope policy:
- subscribe to `competition:{id}` for competition-level updates
- subscribe to `match:{id}` only while user is viewing/scoring that live match
- Retry/timeout policy:
- use bounded retries with exponential backoff
- after retry budget is exhausted, show user-facing error banner with explicit retry action

Analytics policy (V1 locked):
- Scope: core competition events only (existing named events + critical failure events)
- Payload discipline: IDs/status values only; no free-text notes payloads
- Error telemetry: critical failures only (join fail, save fail, realtime disconnect/reconnect, override fail)
- Delivery model: analytics is non-blocking (feature actions never wait on analytics success)
- Launch requirement: no new analytics dashboards required before V1 ship (event emission correctness only)

## 8) Recommended Build Order (Execution Phases)

### Phase 1: Foundations
- Add Competitions tab
- Add base competition navigation stack
- Build Competitions Hub static UI

### Phase 2: Create/Join
- Create Competition screen (persist + join code)
- Join Competition screen (code + QR)
- Competition Overview skeleton

### Phase 3: Participants & Roles
- Participants & Roles screen
- Promote/demote with minimum one organiser rule
- Registration lock/unlock

### Phase 4: Poules
- Randomized poule generation algorithm
- Poules screen + table
- Poule match generation
- Lock poules logic

### Phase 5: Scoring choices
- Scoring method bottom sheet
- Hook `Use Remote` into Remote flow with competition context
- Manual score entry screen

### Phase 5B: Remote unification
- Reuse the same full Remote surface for competition scoring
- Add competition-mode adapter/guardrails on shared Remote surface
- Route completion back into competition journey (not global match summary)

### Phase 6: Rankings + DE
- Ranking computation from poule results
- Rankings screen
- Lock rankings
- DE generation from rankings
- DE tableau screen + match navigation

### Phase 7: Finalisation
- Finalise competition
- Freeze edits
- Move competition from active to past

### Phase 8: Realtime polish
- Realtime match score updates
- Live refresh for poules/rankings/bracket
- Optional offline fail-safe

## 9) Testing Scenarios (Must Pass)

### Scenario A: 12 fencers, poules + DE
- Join by code
- Generate poules
- Score all poule matches
- Rankings update correctly
- Generate DE
- Score DE to completion
- Finalise

### Scenario B: Two users attempt remote scoring on same match
- First user becomes authoritative scorer
- Second user is view-only
- Organiser takeover works

### Scenario C: Participant withdraws mid-event
- Remaining pool matches handled by forfeit rule
- DE auto-advance behaves correctly

### Scenario D: Role transfer safety
- Promote second organiser
- Demote first organiser
- Last organiser demotion blocked

## 10) Sign-Off Gates (No Code Before These Are Approved)
- Gate 1: Scope and non-goals freeze
- Gate 2: State machine and lock/unlock rules freeze
- Gate 3: Data model + permission rules freeze
- Gate 4: Algorithm details freeze (poules/rankings/DE/withdrawals)
- Gate 5: Screen contracts + role gating freeze
- Gate 6: Realtime event protocol freeze
- Gate 7: Test scenarios and acceptance criteria freeze

## 11) Open Decisions Tracker
| ID | Topic | Current Status | Notes / Required Decision |
|---|---|---|---|
| D-01 | `CompetitionMatch` to existing `Match` linkage | Locked (V1) | Immediate 1:1 link at competition match creation; hidden from Match History/training surfaces in V1 |
| D-02 | Guest participants | Locked (V1) | No guests; authenticated users only |
| D-03 | Poule sizing and uneven counts | Locked (superseded by D-16) | See D-16 for finalized V1 sizing and balancing rules |
| D-04 | Ranking tie-break exact formulas | Locked (V1) | `Win% -> Indicator -> Hits -> Head-to-Head -> Random Draw` |
| D-05 | Withdrawal scoring convention | Locked (V1) | DE: opponent auto-advances via walkover/forfeit. Poules: unplayed bouts canceled, completed bouts vs withdrawn fencer annulled for ranking; no poule forfeit score injection |
| D-06 | DE byes and seeding policy | Locked (V1) | Seed from locked rankings; top seeds receive auto-advance byes |
| D-07 | Edit guardrail policy | Locked (V1) | DE/manual edits use organiser override with reason + audit log; two-person approval staged off behind feature flag |
| D-08 | Unlock behavior after downstream generation | Locked (V1) | Upstream unlock is blocked after downstream generation; post-V1 may allow reset-based unlock |
| D-09 | Realtime conflict resolution | Locked (V1) | Server-authoritative reconciliation, stale-event rejection, reconnect refetch, user-visible correction notice, scoped subscriptions (`competition` + active `match`), bounded backoff with retry banner |
| D-10 | Analytics event scope in V1 | Locked (V1) | Core events + critical failures only, ID/status payloads only, non-blocking analytics delivery, no dashboard build requirement for V1 launch |
| D-11 | Competitions Hub list behavior | Locked (V1) | Active/Past semantics, sorting, finalised read-only tap, no hub search/filter, realtime enabled |
| D-12 | Create/Join competition identity rules | Locked (V1) | Duplicate names allowed, 6-digit numeric join code, QR includes code+competition_id, pre-poule edit window only |
| D-13 | Join policy and abuse guardrails | Locked (V1) | 5-attempt cooldown, strict QR code/id match, block new joins after registration lock, allow finalised read-only join |
| D-14 | Competition Overview behavior | Locked (V1) | Participant sees My Next Match only (future-ready for all upcoming), organiser uses guided next-step CTA (future-ready full-controls mode), finalised hides actions, progress shows phase + overall |
| D-15 | Participants & Roles behavior | Locked (V1) | Removal blocked after registration lock (use withdraw), role changes allowed anytime with last-organiser protection, self-leave only before registration lock, withdrawn users stay visible with badge |
| D-16 | Poules generation and editing rules | Locked (V1) | Target size 6 with 5-7 balancing, random-shuffle balanced split, regenerate only before scoring, pre-lock drag/drop only, uneven counts allowed (max diff 1) |
| D-17 | Rankings behavior (non tie-break fallback) | Locked (V1) | Withdrawn stays visible in rankings, lock-rankings blocks poule edits, rankings auto-update after each completed poule match |
| D-18 | DE tableau behavior | Locked (V1) | Seeded from locked rankings, auto-byes for top seeds, no bronze match, conditional reset rule, DE withdrawal auto-advance via walkover/forfeit, override requires reason + audit log |
| D-19 | Scoring method bottom sheet behavior | Locked (V1) | Explicit mode selection, pre-set mode deep-link, read-only live view for non-authoritative users, confirmed organiser takeover, no live mode switching, detailed analytics events |
| D-20 | Manual score entry behavior | Locked (V1) | Strict score validation, save de-bounce UX, organiser-only post-submit edits via override, offline save blocked, agreement disabled by default, post-save return + toast |
| D-21 | Agreement modal rollout | Locked (V1) | Feature-flag only; disabled by default in V1, ready for post-V1 activation |
| D-22 | Match-system integration behavior | Locked (V1) | Competition-only visibility in V1, excluded from training/global surfaces, Match Details reusable with read-only competition banner, and stage metadata persisted now (`competition_id`, `stage`, `round_label`) |
| D-23 | Competition remote surface | Locked (V1) | Use the same full Remote experience as the Remote tab via shared UI/component architecture (no separate reduced remote UI for competitions) |
| D-24 | Competition remote controls scope | Locked (V1) | Keep officiating controls in competition mode (score +/- , timer/play-pause, period controls, cards, injury, priority, side swap, finish match, guarded edit-time); hide non-competition personalization/training flows (profile toggle, images, name-edit, reset-all variants, training summary routing) |
| D-25 | Competition remote completion routing | Locked (V1) | Completing a competition match returns to competition source screen (`Poules`/`DE`/`Overview`), not global match summary routes |
| D-26 | Competition remote data persistence scope | Locked (V1) | Do not map competition remote flow into training/global match-history pipeline in this increment; keep competition scoring authoritative in competition tables/RPCs |
| D-27 | Competition correction tools policy | Locked (V1) | Corrections happen via score +/- and guarded exact-score/time edit paths for authoritative scorer (or organiser after takeover); destructive reset shortcuts are disabled in competition mode |

## 12) Deep-Dive Backlog (Needs More Work)
| Area | Why it needs deeper work | Proposed output | Target phase |
|---|---|---|---|
| Poule generation | Fairness and uneven participant handling | Deterministic algorithm spec + test vectors | Phase 4 |
| Ranking engine | Tie-break correctness impacts seeding | Ranking rules spec + edge-case tests | Phase 6 |
| DE generator | Byes/advancement correctness critical | Bracket generation spec + fixtures | Phase 6 |
| Authoritative scorer | Realtime race conditions | Locking protocol and takeover rules | Phase 5/8 |
| Result edits | Data trust and auditability | Edit/approval policy + audit log behavior | Phase 5/7 |
| Withdrawal behavior | Impacts standings and bracket progression | Forfeit/advance rulebook | Phase 4/6 |

## 13) Decision Log
| Date | Decision ID | Decision | Why |
|---|---|---|---|
| 2026-02-24 | D-01 | Competition match creates/links to core `Match` immediately (1:1) | Simplifies flow, reduces migration risk, keeps technical consistency |
| 2026-02-24 | D-02 | Guest participation disabled in V1 | Simpler identity/permissions and cleaner realtime behavior |
| 2026-02-24 | D-08 | Block upstream unlock after downstream generation in V1 | Safer first release; avoids invalidation complexity |
| 2026-02-24 | D-04 | Ranking tie-break order locked to include head-to-head before random draw | Preserves competitive fairness by using direct bout outcome before chance |
| 2026-02-24 | D-05 | Withdrawal convention locked: DE walkover/forfeit; poule cancellation + annulment model | Aligns competition behavior with predictable withdrawal handling and avoids injecting artificial poule forfeit scores |
| 2026-02-24 | D-06 | DE byes and seeding locked to rankings-based seeding with automatic top-seed byes | Ensures deterministic bracket construction and eliminates manual bye ambiguity in V1 |
| 2026-02-24 | D-11 | Competitions Hub uses Active/Past split with deterministic sort and read-only finalised tap; realtime on hub list enabled | Keeps UX simple while keeping club state current without manual refresh |
| 2026-02-24 | D-12 | Create/Join identity rules locked (duplicate names allowed, 6-digit code, QR includes code+competition_id, edit window before poules) | Balances fast organiser setup with reliable join behavior and low V1 complexity |
| 2026-02-24 | D-13 | Join policies locked (5 invalid attempt cooldown, strict QR validation, lock-time join block, finalised read-only join) | Prevents abuse and ambiguity while preserving post-event visibility |
| 2026-02-24 | D-14 | Overview behavior locked with guided V1 UX and future-ready data/control hooks | Keeps V1 simple while minimizing future refactor for expanded visibility and control modes |
| 2026-02-24 | D-15 | Participants & Roles policies locked (post-lock removal blocked, role change timing, self-leave rule, withdrawn visibility) | Preserves organiser control and auditability without hiding participant state changes |
| 2026-02-24 | D-16 | Poules rules locked (size target, balancing, regenerate constraints, and edit window) | Keeps generation fair while protecting scoring integrity once bouts begin |
| 2026-02-24 | D-17 | Rankings policies locked for visibility, lock behavior, and live update timing | Ensures ranking state remains transparent and stable once organiser locks rankings |
| 2026-02-24 | D-18 | DE tableau policies locked for seeding/byes/bronze/reset/withdrawal plus reasoned-audit override | Keeps elimination bracket deterministic and preserves trust with explicit auditability on admin corrections |
| 2026-02-24 | D-19 | Scoring method bottom sheet behavior locked with confirmation-based takeover and analytics granularity | Reduces accidental control changes and improves observability of scoring-mode usage patterns |
| 2026-02-24 | D-20 | Manual score entry behavior locked for validation, save safety, edit governance, offline handling, and post-save navigation | Keeps manual entry reliable under match pressure while minimizing V1 sync and consistency risk |
| 2026-02-24 | D-21 | Agreement modal rollout locked as feature-flagged and off by default in V1 | Keeps V1 release simpler while preserving a low-friction path to two-person approval in a later increment |
| 2026-02-24 | D-22 | Match-system integration locked including immediate stage metadata persistence | Preserves a clean migration path by storing competition context now while keeping V1 surfaces intentionally scoped |
| 2026-02-24 | D-09 | Realtime conflict model fully locked including scoped subscriptions and bounded backoff retry UX | Completes deterministic live-state handling and operational safety without excessive channel load or silent failure loops |
| 2026-02-24 | D-10 | Analytics scope locked to core + critical failures with non-blocking delivery and no pre-launch dashboard dependency | Keeps V1 shipping focus on feature reliability while ensuring useful telemetry is still captured from day one |
| 2026-02-27 | D-23 | Competition remote uses the same full Remote experience (shared surface) | Preserves UX consistency and avoids user confusion from two different remote scoring experiences |
| 2026-02-27 | D-24 | Competition mode keeps officiating controls and hides only non-competition personalization/training flows | Preserves real competition refereeing capability while removing training-only behavior that can break event integrity |
| 2026-02-27 | D-25 | Competition remote completion returns to competition flow source | Keeps users in tournament context and avoids breaking progression through poules/DE |
| 2026-02-27 | D-26 | Competition remote persistence remains competition-scoped in this increment | Avoids training/history contamination and lowers integration risk while completing competition flow |
| 2026-02-27 | D-27 | Competition correction tools use guarded edit paths; destructive resets disabled | Supports real officiator correction needs without exposing high-risk reset shortcuts during live competition scoring |

## 14) Change Log
| Date | Change | Reason | Updated by |
|---|---|---|---|
| 2026-02-24 | Created initial V1 planning tracker from product brief | Establish single living source of truth before implementation | Codex |
| 2026-02-24 | Locked D-01, D-02, and D-08 and clarified V1 match-history visibility policy | Convert planning decisions into explicit implementation constraints | Codex |
| 2026-02-24 | Locked Hub behavior and enabled V1 realtime updates on Hub list | Align UX decisions and backend event requirements before page-by-page implementation planning | Codex |
| 2026-02-24 | Locked Create/Join identity and edit-window rules | Remove ambiguity around naming, join mechanism, and pre-poule mutability | Codex |
| 2026-02-24 | Locked Join Competition guardrails and access behavior | Clarify QR trust model, join throttling, and locked/finalised join access | Codex |
| 2026-02-24 | Locked Competition Overview UX decisions and future-ready mode requirements | Finalize V1 participant/organiser visibility and progress presentation while preserving easy expansion paths | Codex |
| 2026-02-24 | Locked Participants & Roles behavior and access guardrails | Finalize removal/withdraw semantics, role-change timing, self-leave constraints, and withdrawn list visibility | Codex |
| 2026-02-24 | Locked Poules generation and editing guardrails | Finalize size/balancing policy and pre-score/pre-lock modification limits for reliable poule setup | Codex |
| 2026-02-24 | Locked Rankings visibility, lock-effects, and update timing | Finalize ranking behavior rules prior to full DE generation planning | Codex |
| 2026-02-24 | Locked ranking tie-break fallback to Head-to-Head then Random Draw | Complete rankings decision set and close D-04 | Codex |
| 2026-02-24 | Locked DE tableau structural rules and organiser override audit requirement | Finalize elimination flow behavior while ensuring admin result corrections are reasoned and traceable | Codex |
| 2026-02-24 | Locked Scoring Method bottom-sheet behavior and event tracking scope | Finalize match-entry choice flow, control handoff safety, and analytics instrumentation boundaries | Codex |
| 2026-02-24 | Locked Manual Score Entry behavior and defaults | Finalize validation, save safety, offline constraint, edit control, and return-path UX for manual scoring | Codex |
| 2026-02-24 | Locked Agreement Modal rollout mode for V1 | Confirm feature remains staged off in V1 while preserving post-V1 activation path | Codex |
| 2026-02-24 | Fully locked Match-system integration rules including metadata persistence | Finalize V1 integration behavior and remove remaining ambiguity for match-level competition context storage | Codex |
| 2026-02-24 | Locked withdrawal handling model for poules and DE | Finalize D-05 with cancellation/annulment in poules and walkover in DE, plus explicit user-facing cancellation statuses | Codex |
| 2026-02-24 | Fully locked realtime conflict-resolution, subscription scope, and retry policy | Finalize V1 realtime behavior end-to-end for consistency, performance, and resilient user feedback on failures | Codex |
| 2026-02-24 | Fully locked analytics scope and launch expectations for V1 | Finalize telemetry boundaries and ensure analytics never blocks user actions or release timing | Codex |
| 2026-02-24 | Added phase-by-phase implementation ticket backlog (`COMP-001` to `COMP-075`) with dependencies and exit gates | Translate locked plan into execution-ready delivery units before implementation start | Codex |
| 2026-02-24 | Added ticket tick-tracking and marked Phase 1 implementation tickets complete | Keep implementation status visible directly in the plan as work is shipped | Codex |
| 2026-02-24 | Standardized all pending tickets and phase gates to explicit `[ ]` status | Ensure every implementation item can be ticked consistently as phases complete | Codex |
| 2026-02-24 | Added phase verification playbook with Phase 1 QA checklist and ongoing per-phase checklist rule | Ensure each phase has explicit, repeatable test coverage before gate sign-off | Codex |
| 2026-02-26 | Updated Competitions Hub visible title to `Competition Hub` | Align user-facing page heading with approved product wording | Codex |
| 2026-02-26 | Implemented Phase 2 Create/Join flows with persistence, join-code uniqueness, QR payload, cooldown guard, and access-state handling | Complete `COMP-010` to `COMP-015` and unlock next implementation phase | Codex |
| 2026-02-26 | Logged V1 QR rendering fallback to free endpoint service | Maintain delivery momentum despite restricted package/network install environment for local QR library | Codex |
| 2026-02-26 | Logged V1 QR scanner entry fallback to pasted payload modal | Preserve strict QR payload validation without adding new scanner dependency in restricted environment | Codex |
| 2026-02-26 | Fixed Competition Hub navigation route resolution for Create/Join/Overview paths | Prevent Expo Router `+not-found` on nested tab stack navigation | Codex |
| 2026-02-26 | Updated Join screen so `Scan QR` opens camera capture and attempts QR decode before manual fallback | Align user expectation for camera-first QR scanning while retaining robust fallback path | Codex |
| 2026-02-26 | Hid manual QR payload entry UI from Join screen | Keep participant-facing join flow simple: camera scan or 6-digit code only | Codex |
| 2026-02-26 | Implemented Phase 3 participants/roles management, organiser role guardrails, registration lock controls, and self-leave/remove policies | Complete `COMP-020` to `COMP-023` and lock core permission workflows before poules phase | Codex |
| 2026-02-26 | Implemented Phase 4 poules data model + RPC flows, poules table/match UI, assignment editing controls, and poule lock workflow | Complete `COMP-030` to `COMP-034` and enable full poule generation/edit/lock flow before scoring phase | Codex |
| 2026-02-26 | Fixed join policy for non-member participant insert and added `/competition/join` deep-link redirect to Competitions Join screen | Resolve dev join failures (`Could not join...`) and external QR deep-link `+not-found` behavior | Codex |
| 2026-02-26 | Enabled deep-link auto-join attempt from external QR scan (with fallback to prefilled code flow) | Reduce friction so camera-scanned competition invites can join immediately in-app | Codex |
| 2026-02-26 | Fixed participant membership trigger RLS by making competition `updated_at` bump trigger `SECURITY DEFINER` | Prevent join/leave/participant mutations from failing when non-organisers cannot update `club_competition` directly | Codex |
| 2026-02-26 | Updated join insert flow to avoid `INSERT ... RETURNING` on participant creation | Prevent RLS read-policy edge case from blocking otherwise valid join inserts | Codex |
| 2026-02-26 | Updated Competition Overview scroll bottom padding to account for custom tab-bar overlay height | Prevent `Rankings` and `DE Tableau` navigation cards from being clipped behind the tab bar on small/tall-screen Android and iOS devices | Codex |
| 2026-02-26 | Hardened Competition Hub loading with timeout + try/finally fallback and user-visible retry message | Prevent indefinite spinner when hub fetch stalls or throws unexpectedly in unstable dev-network sessions | Codex |
| 2026-02-26 | Improved competition participant display-name resolution (profile/email fallback) and generic-name auto-upgrade on rejoin | Prevent participant rows from persisting placeholder labels like `Participant`/`Organiser` when user profile name is unavailable at join time | Codex |
| 2026-02-27 | Implemented Phase 5 scoring flows (mode sheet, remote authority/takeover, manual validation/offline guard, completion routing, staged agreement flag) | Complete `COMP-040` to `COMP-044` and unlock Rankings + DE implementation with stable scoring foundations | Codex |
| 2026-02-27 | Locked competition remote unification decisions (D-23 to D-26) | Confirmed sign-off to use shared full Remote surface in competition context with competition-safe constraints and routing | Codex |
| 2026-02-27 | Added implementation backlog for Phase 5B shared Remote unification (`COMP-045` to `COMP-049`) plus phase gate and verification checklist | Convert approved remote unification decisions into execution-ready tickets before implementation | Codex |
| 2026-02-27 | Refined competition remote control policy (added D-27 and expanded D-24) | Lock that officiating tools remain available in competition mode while destructive/personalization training flows are removed | Codex |
| 2026-02-27 | Implemented shared remote competition mode routing + RPC scoring integration + source-return navigation | Complete `COMP-045` to `COMP-048` implementation path and route competition remote flow through the full existing Remote surface | Codex |
| 2026-02-27 | Implemented Phase 6 rankings + DE core (rankings RPC/UI, rankings lock, seeded DE generation/byes, DE tableau scoring navigation, DE override/reset/walkover audit controls) | Complete `COMP-050` to `COMP-054` and unblock end-to-end elimination-stage progression | Codex |
| 2026-02-28 | Implemented Phase 6 match integration mapping (`COMP-055`) via core-match linkage table + sync triggers | Persist `competition_id/stage/round_label` metadata for club competition matches while keeping V1 visibility constrained to competition surfaces | Codex |
| 2026-02-28 | Implemented Phase 7 finalisation flow and read-only freeze pass (`COMP-060` to `COMP-062`) | Added finalise RPC + overview action, enforced server-side role-edit freeze after finalisation, and tightened read-only scoring entry behavior across competition screens | Codex |
| 2026-03-01 | Implemented Phase 8 realtime orchestration and resilience pass (`COMP-070` to `COMP-074`) | Added scoped competition/match subscriptions, stale-event rejection, reconnect refetch + correction notice, bounded backoff with retry banner, and critical failure telemetry for realtime/scoring failure paths | Codex |

## 15) Weekly Planning Checklist (Living)
- [ ] All open decisions reviewed this week
- [ ] New risks or blockers added to deep-dive backlog
- [ ] Any scope changes reflected in sections 0, 8, and 10
- [ ] Change log updated for every product/technical decision change

## 16) Implementation Ticket Breakdown (Phase-by-Phase)
Use this as the execution backlog for V1. All tickets below inherit locked decisions `D-01` to `D-26`.
Status key: `[x]` complete, `[ ]` pending.

### Phase 1: Foundations
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-001 | Add `Competitions` tab and route wiring | None | Tab appears in final tab order and opens competition stack root |
| [x] COMP-002 | Build competition stack shell and screen route map | COMP-001 | All required screens/routes exist and navigate correctly |
| [x] COMP-003 | Competitions Hub base UI (Active/Past sections + CTAs + card shell) | COMP-002 | Hub renders section headers, buttons, card layout, empty states |
| [x] COMP-004 | Competition domain types/interfaces/constants | COMP-001 | Shared types compile and are consumed by hub/create/join screens |

### Phase 2: Create/Join
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-010 | Create Competition form UI + validation | COMP-002, COMP-004 | Name/weapon/format/DE limit form works with locked rules |
| [x] COMP-011 | Competition create persistence + unique 6-digit join code generation | COMP-010 | Duplicate names allowed, code uniqueness enforced for non-finalised competitions |
| [x] COMP-012 | QR payload generation/render (`join_code` + `competition_id`) | COMP-011 | QR renders from deep-link payload (V1 uses free QR image endpoint fallback due no local QR package in current environment) |
| [x] COMP-013 | Join by code flow with 5-attempt cooldown | COMP-002, COMP-011 | Join success/failure paths work; cooldown triggers after 5 invalid attempts |
| [x] COMP-014 | Join by QR flow + strict code/id mismatch rejection | COMP-012, COMP-013 | Valid QR payload joins; mismatched QR rejected as invalid/expired (V1 scanner entry uses paste-payload modal fallback) |
| [x] COMP-015 | Join access-state handling (`registration_locked`, `finalised`) | COMP-013 | New joins blocked after registration lock; finalised opens read-only |

### Phase 3: Participants & Roles
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-020 | Participants & Roles screen UI + organiser action menu | COMP-002, COMP-011 | List shows role/status badges and action controls per permissions |
| [x] COMP-021 | Role transfer rules (min one organiser, demotion guardrails) | COMP-020 | Last organiser cannot be demoted; transfer rules enforced in UI/data layer |
| [x] COMP-022 | Registration lock/unlock controls + state transitions | COMP-020 | Lock/unlock works with confirmations and correct status changes |
| [x] COMP-023 | Remove/withdraw/self-leave policies | COMP-020, COMP-022 | Removal blocked after lock, self-leave pre-lock only, withdrawn remains visible |

### Phase 4: Poules
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-030 | Poule generation engine (random shuffle + balanced split) | COMP-022 | Target size and balancing constraints enforced (`6`, allow `5-7`, diff max 1) |
| [x] COMP-031 | Poule round-robin match generation | COMP-030 | Expected match set created for each poule and stored correctly |
| [x] COMP-032 | Poules screen table + match list UI | COMP-031 | Tabs, stats columns, match status pills, tap-to-score entry all functional |
| [x] COMP-033 | Regenerate/drag-drop/lock poules controls | COMP-032 | Regenerate pre-score only, drag-drop pre-lock only, lock action enforced |
| [x] COMP-034 | Poule withdrawal cancellation + annulment model | COMP-032 | Unplayed bouts canceled, completed bouts annulled for rankings, status labels shown |

### Phase 5: Scoring Choices
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-040 | Scoring Method Bottom Sheet behavior | COMP-032 | Explicit mode choice, pre-set mode deep-link, no default selection |
| [x] COMP-041 | Authoritative scorer control + confirmed organiser takeover | COMP-040 | Non-authoritative users read-only; takeover requires confirmation |
| [x] COMP-042 | Manual Score Entry validation + save safety + offline block | COMP-040 | Validation rules enforced, save de-bounced, offline save blocked |
| [x] COMP-043 | Manual save cascade + return navigation + success toast | COMP-042 | Save updates match state and returns user to correct source screen |
| [x] COMP-044 | Agreement modal feature-flag staging (off by default) | COMP-042 | Flag exists, modal path disabled by default, no effect on V1 flows |

### Phase 5B: Shared Remote Unification (Competition Context)
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-045 | Shared Remote surface extraction (single reusable UI for training + competition) | COMP-044 | Remote tab and competition flow render from shared Remote surface/component without visual regression |
| [x] COMP-046 | Competition-mode adapter + control matrix on shared Remote | COMP-045 | Competition mode keeps officiating controls (including cards and guarded time edit), hides non-competition personalization/training flows, and applies competition context fields as source of truth |
| [x] COMP-047 | Competition scoring transport integration inside shared Remote | COMP-046, COMP-041 | Competition mode uses competition scoring RPC flow (prepare/live/takeover/complete), supports guarded correction paths, and does not write training-match records |
| [x] COMP-048 | Competition navigation integration for shared Remote route | COMP-046 | `Use Remote` from poules/DE opens shared Remote in competition mode; back/complete returns user to source competition screen |
| [ ] COMP-049 | Unified remote analytics + guardrail telemetry | COMP-047, COMP-048 | Events include surface context (`training|competition`) and key authority transitions/errors are tracked non-blocking |

### Phase 6: Rankings + DE
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-050 | Rankings engine (tie-break stack + withdrawal adjustments) | COMP-034, COMP-042 | Ranking order matches locked tie-break and withdrawal rules |
| [x] COMP-051 | Rankings screen + lock rankings behavior | COMP-050 | Rankings render correctly; lock blocks further poule score edits |
| [x] COMP-052 | DE bracket generation from locked rankings with auto-byes | COMP-051 | Deterministic seeding and bye placement works for non-power-of-two counts |
| [x] COMP-053 | DE Tableau UI + round navigation | COMP-052 | Round columns/cards render and match states update correctly |
| [x] COMP-054 | DE control rules (override reason+audit, reset dependency guard, withdrawal walkover) | COMP-053 | Override writes audit record; reset blocked if downstream started; walkover auto-advance works |
| [x] COMP-055 | Match integration mapping (`competition_id`, `stage`, `round_label`) with V1 visibility constraints | COMP-042, COMP-052 | Metadata persisted; competition matches hidden from global history/search/training stats |

### Phase 7: Finalisation
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-060 | Finalise competition action + irreversible freeze rules | COMP-051, COMP-054 | Finalise transitions state and blocks edit actions |
| [x] COMP-061 | Read-only behavior pass across all screens | COMP-060 | Finalised competitions show view-only UX consistently |
| [x] COMP-062 | Active/Past movement + sort semantics (`updated_at`, `finalised_at`) | COMP-060, COMP-003 | Hub lists move/sort competitions per locked rules |

### Phase 8: Realtime + Analytics Polish
| Ticket | Scope | Depends On | Done Criteria |
|---|---|---|---|
| [x] COMP-070 | Realtime subscription orchestration (`competition` always + active `match`) | COMP-040, COMP-053 | Correct channels subscribe/unsubscribe by screen context |
| [x] COMP-071 | Server-authoritative reconciliation + stale-event rejection | COMP-070 | Out-of-order events do not regress UI state |
| [x] COMP-072 | Reconnect refetch workflow + optimistic correction notice | COMP-071 | Reconnect recovers canonical state; correction notice appears when needed |
| [x] COMP-073 | Retry policy with bounded exponential backoff + retry banner | COMP-071 | Failed realtime/write paths surface actionable retry UI after budget exhaustion |
| [x] COMP-074 | Analytics implementation (core + critical failures, non-blocking) | COMP-013, COMP-040, COMP-042, COMP-070 | Required events emit with ID/status payloads; failures never block user actions |
| [ ] COMP-075 | Scenario validation suite (A-D) + regression checklist | All prior phase tickets | Must-pass scenarios A-D verified and signed off |

### Phase Exit Gates
| Phase | Exit Condition |
|---|---|
| [x] 1 | Navigation + screen shells stable and routable |
| [x] 2 | Create/join usable end-to-end with QR and code guards |
| [x] 3 | Role and registration controls enforce all guardrails |
| [x] 4 | Poules generation/edit/lock and withdrawal behavior validated |
| [x] 5 | Scoring flows stable for remote/manual with authority controls |
| [ ] 5B | Competition flow uses shared full Remote surface with competition-safe constraints and routing |
| [ ] 6 | Rankings + DE generation/advancement behavior correct |
| [ ] 7 | Finalise and read-only behavior verified on all surfaces |
| [ ] 8 | Realtime consistency + analytics instrumentation + scenario pass complete |

## 17) Phase Verification Playbooks
Rule: when any phase is implemented, run that phase's checklist before ticking its exit gate.

### Phase 1 Verification (Foundations)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Open app to main tabs | Tabs show in order: `Home`, `Remote`, `Competition`, `Mindset`, `Profile` | [ ] |
| Confirm hidden tabs | `Training` tab is not visible in tab bar | [ ] |
| Open Competition tab | Opens Competitions Hub screen without crash | [ ] |
| Check Hub title | Title text is `Competition Hub` and does not overlap notch/Dynamic Island/status bar | [ ] |
| Check Hub sections | `Active` and `Past` sections render | [ ] |
| Check Hub CTAs | `Create Competition` and `Join` buttons render and are tappable | [ ] |
| Navigate to Create | Tap `Create Competition` and confirm Create screen opens | [ ] |
| Navigate to Join | Tap `Join` and confirm Join screen opens | [ ] |
| Return navigation | Back navigation from Create/Join returns to Hub correctly | [ ] |
| Smoke route stability | No console/runtime errors while switching between tab and stack screens | [ ] |

### Phase 2 Verification (Create/Join)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Open Create Competition screen | Name, weapon, format, DE touch limit controls render and are interactive | [ ] |
| Create validation (name) | Create is blocked and error shown when name has fewer than 2 chars | [ ] |
| Create success | Competition is created, unique 6-digit join code generated, and user lands on Overview | [ ] |
| Overview organiser invite block | Overview shows join code and QR for organiser | [ ] |
| Join by valid code | User joins successfully and is navigated to Overview | [ ] |
| Join invalid code attempts | After 5 invalid attempts, 5-minute cooldown message appears and join is blocked | [ ] |
| Join by QR valid payload | Valid QR payload (`competition_id` + `join_code`) joins successfully | [ ] |
| Join by QR mismatch | Mismatched `competition_id` and `join_code` is rejected as invalid/expired | [ ] |
| Join while registration locked | New user join is blocked; existing participant can still open competition | [ ] |
| Join finalised competition | Join succeeds and competition opens in read-only mode | [ ] |

### Phase 3 Verification (Participants & Roles)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Open Participants & Roles screen | List renders with name, avatar initials, role badge, and status badge | [ ] |
| Promote participant | Participant can be promoted to organiser by organiser user | [ ] |
| Demote organiser (non-last) | Organiser can be demoted when another organiser exists | [ ] |
| Demote last organiser | Action is blocked with clear error/message | [ ] |
| Registration lock from Overview | Organiser can lock registration with confirmation; status updates to `registration_locked` | [ ] |
| Registration unlock from Overview | Organiser can unlock registration with confirmation; status updates to `registration_open` | [ ] |
| Remove participant while open | Organiser can remove participant only when registration is open | [ ] |
| Remove participant while locked | Remove is blocked once registration is locked | [ ] |
| Self leave while open | Current user can leave during `registration_open` and returns to Hub | [ ] |
| Self leave while locked | Self-leave is blocked outside `registration_open` | [ ] |
| Withdraw status action timing | Withdraw/Set Active controls only available during allowed poule/DE statuses | [ ] |

### Phase 4 Verification (Poules)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Generate poules from locked registration | Organiser can generate from `registration_locked`; status transitions to `poules_generated` | [ ] |
| Balanced random split | Active participants are distributed with pool-size diff max `1` and around target size `6` | [ ] |
| Round-robin match creation | Each poule has full expected pairings and all matches start `pending` | [ ] |
| Poule tabs + table render | Tabs (`A/B/C...`) switch correctly; table shows `W/L/IND/HS/HR/LEFT` values | [ ] |
| Match list status pills | Match rows show status labels/colors including withdrawal statuses | [ ] |
| Regenerate before scoring | Regenerate works before scoring starts and rebuilds assignments/matches | [ ] |
| Regenerate after scoring | Regenerate is blocked after any poule scoring activity | [ ] |
| Assignment edit before lock | Organiser can reorder/move assignments while `poules_generated` and pre-score | [ ] |
| Assignment edit blocked conditions | Assignment edits are blocked once scoring starts or after lock | [ ] |
| Lock poules | Lock action moves status to `poules_locked` and blocks further assignment edits | [ ] |
| Withdrawal poule behavior | Pending/live matches with withdrawn fencer become `canceled_withdrawal`; completed become `annulled_withdrawal` | [ ] |

### Phase 5 Verification (Scoring Choices)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Scoring sheet appears for unconfigured match | Tapping a `pending` poule match with no scoring mode opens bottom sheet with `Use Remote`, `Enter Score Manually`, `Cancel` | [ ] |
| Existing mode deep-link bypasses sheet | Tapping a match that already has `scoring_mode` navigates directly to score entry screen | [ ] |
| Manual validation: tie blocked | Entering equal scores (e.g. `5-5`) shows error and blocks save | [ ] |
| Manual validation: touch limit required | Entering scores where neither side reaches touch limit is blocked with clear message | [ ] |
| Manual validation: max limit enforced | Entering score above touch limit is blocked | [ ] |
| Offline save blocked | With internet disabled, save attempt shows offline error and does not complete match | [ ] |
| Manual completion success path | Valid manual score completes match, updates row status/score, shows success toast/alert, and returns to source screen | [ ] |
| Remote authoritative assignment | First user choosing remote becomes authoritative scorer and can adjust live score | [ ] |
| Remote view-only protection | Second user opening same live remote match sees view-only state and cannot change score | [ ] |
| Organiser takeover confirmation | Organiser in view-only state can take over via confirmation and then edit live score | [ ] |
| Remote completion success path | Authoritative scorer can complete match with valid final score and match transitions to `completed` | [ ] |
| Agreement flag default-off behavior | With current config, no agreement modal blocks normal scoring flow | [ ] |

### Phase 5B Verification (Shared Remote Unification)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Competition remote launches shared full surface | Choosing `Use Remote` from competition match opens the same full Remote experience used by Remote tab | [ ] |
| Competition context header/metadata | Shared Remote in competition mode shows competition-context metadata (stage/source) and match-scoped participants correctly | [ ] |
| Competition-safe control matrix | Non-competition controls (profile toggle/image edit/reset-all and other non-competition mutation controls) are hidden/locked in competition mode | [ ] |
| Officiating controls retained | Cards, timer/play-pause, period controls, side swap, and finish actions remain available per authority rules in competition mode | [ ] |
| Guarded correction paths | Authoritative scorer (or organiser after takeover) can perform guarded score/time correction without exposing destructive reset shortcuts | [ ] |
| Authoritative scorer lock still enforced | First scorer gets authority; second user is read-only until organiser takeover | [ ] |
| Organiser takeover in shared remote | Organiser can take over scoring in shared Remote competition mode with confirmation | [ ] |
| Competition persistence isolation | Completing competition remote score does not create/update training/global match-history entries in this increment | [ ] |
| Competition return routing | Complete/back returns to source competition screen (`Poules`/`DE`/`Overview`) with refreshed match state | [ ] |
| Remote tab regression check | Training Remote tab behavior remains unchanged after shared-surface refactor | [ ] |

### Phase 7 Verification (Finalisation)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Finalise button visibility (organiser) | Organiser sees `Finalise Competition` on Overview only when competition is finalisation-ready | [ ] |
| Finalise blocked when not ready | Attempting finalise before ready state shows clear error message and does not change status | [ ] |
| Finalise success state | Status transitions to `finalised`, `finalised_at` is set, and finalise action becomes unavailable | [ ] |
| Overview read-only banner | Finalised competition shows read-only banner and no editable organiser actions | [ ] |
| Poules read-only enforcement | Poule match rows do not open scoring when finalised; UI indicates read-only | [ ] |
| DE read-only enforcement | DE cards show read-only hint and scoring/override/reset actions remain unavailable | [ ] |
| Manual scoring read-only enforcement | Manual/remote score entry screen shows read-only info and save/complete controls are disabled | [ ] |
| Participant role freeze | Promote/demote attempts after finalisation are blocked server-side with finalised error | [ ] |
| Hub movement semantics | Finalised competition is removed from `Active`, appears in `Past`, and `Past` sort follows `finalised_at DESC` | [ ] |

### Phase 8 Verification (Realtime + Analytics Polish)
Run on both iOS and Android where possible.

| Check | Expected Result | Pass/Fail |
|---|---|---|
| Competition screen scoped realtime | Overview/Participants/Poules/Rankings/DE auto-refresh when another device updates same competition | [ ] |
| Active match scoped realtime | Manual Score Entry live match updates from other scorer actions without manual refresh | [ ] |
| Stale-event rejection | Rapid out-of-order updates do not revert score/status backwards on UI | [ ] |
| Reconnect canonical recovery | After network drop + reconnect, screen refetches canonical state and remains in sync | [ ] |
| Correction notice UX | If local optimistic view differs after reconnect, subtle `Score updated` notice is shown | [ ] |
| Backoff retry banner | On forced realtime disconnect, reconnect attempts are bounded and banner communicates retry progress | [ ] |
| Retry exhausted CTA | After retry budget exhaustion, user sees actionable retry button and manual retry re-subscribes | [ ] |
| Critical failure analytics | Realtime disconnect/reconnect/exhausted and score save/takeover/override/reset failures emit analytics without blocking user flow | [ ] |
| Scenario A | 12 fencers flow completes end-to-end with live poule/ranking/DE propagation | [ ] |
| Scenario B | Two remote scorers conflict resolves by authority lock + organiser takeover + spectator live updates | [ ] |
| Scenario C | Withdrawal mid-event propagates to poules/DE/walkovers and live views without stale state | [ ] |
| Scenario D | Role transfer guardrails (promote/demote/last organiser block) hold under realtime updates | [ ] |
