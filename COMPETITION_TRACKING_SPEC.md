# Competition Tracking (Won Of One) - Implementation Reference

## Overview
- Extend match tracking to support competitions without disrupting training flow.
- A competition groups multiple matches (poule + direct elimination) under a single event (one date).
- Matches can belong to at most one competition.

## Goals
- Minimal friction when logging matches.
- No duplicate competitions for a user on the same date.
- Clear differentiation between training and competition matches.
- Enable competition + season level analytics.

## Core Concepts
### Competition
- Represents one event on one date.
- Fields:
  - id
  - user_id (owner)
  - name (string, user-defined)
  - date (date, local to user)
  - weapon_type (enum: foil, epee, sabre)  # competitions are single-weapon
  - type (enum: WorldCup, GrandPrix, National, Open, Other)
  - type_label (text, optional; only when type=Other)
  - preCompetitionNotes (text, optional)
  - postCompetitionNotes (text, optional)
  - placement (number, optional)
  - fieldSize (number, optional)
  - createdAt
  - updatedAt

### Match (extended)
- Matches remain the atomic unit.
- New fields:
  - competitionId (nullable FK)
  - phase (enum: POULE, DE, nullable)
  - deRound (enum: L64, L32, L16, QF, SF, F, nullable)
- Rules:
  - phase and deRound are only valid when competitionId is set.
  - deRound is only valid when phase === DE.
  - if competitionId is set, match_type must be 'competition'.

## Smart Competition Selector (Critical)
### UX Requirements
- Type-to-search input (not plain text).
- Searches existing competitions for the same user by:
  - name (fuzzy match)
  - date proximity
- Inline results list:
  - Existing competitions selectable.
  - If no match: show “+ Create new competition: <typed name>”.
- Once selected:
  - match stores competitionId
  - competition becomes active for the session/day
- Recent/Active suggestion:
  - If a competition exists for today, show it at top.
  - Subsequent matches can attach with one tap.

### Duplicate Prevention
- Normalize name for matching (trim, lower, collapse spaces).
- Enforce uniqueness per user + date + weapon_type + normalized_name.
- Selector must prefer existing competition over creating new.

## Add New Match Page (Changes)
### Existing Behavior (unchanged)
- Log a single match.
- Supports Training vs Competition.

### New Competition Behavior
When Event Type = Competition:
- Competition selector appears immediately after Event Type.
- Show Competition Selector (type-to-search).
- Allow create-or-reuse in place.
- Show Phase Selection:
  - Toggle: Poule | Direct Elimination
- Default Phase = Poule.
- Show DE Round (conditional):
  - Only if Phase === DE
  - Options: L64, L32, L16, QF, SF, F
- Notes/placement/field size are NOT collected here.

Editing rules:
- Competition + phase/deRound are editable when editing a match.
- Switching Event Type back to Training clears competition fields and returns to normal training UI.

## Match History Page (Changes)
### Visuals
- Replace “Training” pill with:
  - Training
  - Competition
- For competition matches where phase === DE:
  - Show round chip inline (L32, L16, etc.)
- Show “Poule” chip for poule matches.

### Grouping
- Group matches under collapsible Competition instances.
- Expand shows all fights in that competition.
- Training matches remain in the flat list (no grouping).
- Group header shows: Competition name + date + weapon + W/L.
- Default state: most recent competition expanded; others collapsed.
- Group ordering: by competition event_date (not last edited).
- Inside group: Poule first, then DE by round; each ordered by time.
- Single-match competitions still appear as a group.
- Competition matches without competition_id remain ungrouped Competition rows.

## Home – Recent Matches Carousel (Changes)
### Card Types
- Match card (unchanged)
- Competition card (new)

### Competition Card Content
- Competition name
- Date
- Weapon
- Overall W/L record
- Placement + percentile (if available)
- Competition pill

### Navigation
- Match card → Match Details
- Competition card → Competition Detail Page

Behavior:
- Mixed carousel (matches + competition cards).
- Competition cards ordered by competition date.
- Cap competition cards to 2.

## Competition Detail Page (New)
### Header Summary
- Competition name
- Type
- Date
- Weapon
- Placement (if set)
- Finish percentile (derived from placement / fieldSize)
- Overall W/L

### Fight Breakdown
- Grouped by:
  - Poule
  - Direct Elimination (by round)
- Each fight is tappable → Match Details page
- Fight row shows: opponent, score, W/L, phase/round chip.

### Notes
- Pre-Competition Notes and Post-Competition Notes use a Save button (consistent with other screens).

### Editing
- Header is display-only; use an Edit Competition action for changes (name/date/type/weapon/placement/field size).

### Actions
- Allow move match to another competition.
- Allow detach match from competition.
- Allow delete competition only if it has no matches (or after detach/move).

## Navigation Rules
- Match → Match Details (unchanged)
- Competition card/group → Competition Detail Page
- Competition Detail → tap fight → Match Details
- Back from Competition Detail preserves scroll position

## Data & Analytics
- Dedicated Analytics screen (training/competition separated by default).
- Full competition analytics enabled (W/L, finish percentile, DE depth trends).
- Season progression graphs are out of scope for now.
- Analytics computed on the fly (no precomputed summaries initially).

## Non-Goals (Out of Scope)
- Poule tables
- Bracket visualization
- Rankings / points
- Seeding
- Referee tracking
- Video

## One-Line Product Rule
- Matches capture moments.
- Competitions capture outcomes.

## Backfill Strategy (Existing Matches)
- No automatic backfill for historical competition matches.
- Older competition matches without competition_id remain ungrouped for now.

## Smart Selector – Final Decisions
- Active/Recent = most recently used competition.
- Persist active competition in AsyncStorage (suggestion only).
- Filter suggestions to current weapon.
- Show existing matches first; still allow create.
- Exact date matching only (no ±1 day).

## Analytics Screen (Proposed)
- Entry point: new Analytics screen (can be removed if not liked).
- Filter: Training | Competition | All (default Training).
- Summary cards: matches played, win rate, avg score diff, points for/against.
- Competition-only: best DE round, placement/percentile, competition list (tap → detail).

## Open Questions (Fill Before Build)
- Should competitions be weapon-specific or can one competition contain multiple weapons? (resolved: weapon-specific)
- How should multi-day events be handled (one competition per day vs date range)?
- If two competitions occur on the same day, how should “Recent/Active” be chosen? (resolved: most recently used)
