# Achievements V1 Spec

## Status

Agreed product specification only.

No implementation should begin until this spec is reviewed and explicitly approved for build.

## Purpose

The achievements system exists to:

- improve retention
- celebrate user progress
- give users something to aim for
- encourage broader feature adoption across the app

The intended tone is mixed:

- performance-focused and credible
- motivating and rewarding
- not childish or overly game-like

## V1 Product Direction

### Scope

- Profile-first
- Private-first
- Real unlock logic in v1
- Narrow launch scope on a scalable foundation

### Why

- keeps v1 focused and easier to ship
- avoids unnecessary social/privacy complexity at launch
- lets the feature genuinely affect retention from day one
- reduces rework later

## Core Decisions

### Visibility

- Achievements live in the existing Profile area
- Profile shows a preview row/section
- Tapping opens a dedicated achievements screen

### Access

- Achievements are private in v1
- Sharing may come later, but not in v1

### Unlock Rules

- Unlock retroactively from existing data
- Once unlocked, achievements remain unlocked permanently
- Streak progress can reset for streak achievements, but unlocked achievements do not get removed
- Progress should update in real time after key actions where practical

### Locked State

- Most achievements should be visible while locked
- A small number of secret achievements can be hidden for surprise

### Structure

- Achievements should be tiered
- V1 should rely mostly on already tracked data
- Achievements should cover both athlete behavior and organizer behavior

## UX Recommendation

### Profile UX

The Profile page should include:

- an Achievements preview section
- a small summary such as total unlocked and current featured progress
- a CTA like `View all achievements`

### Full Achievements Screen

Use one screen with category sections, not tabs.

Recommended structure:

1. Header
2. Overall summary
3. Recent unlocks
4. Category sections
5. Achievement cards within each category

### Achievement Card Behavior

Each achievement card should support:

- locked or unlocked state
- tier display
- progress to next tier
- icon/badge
- title
- short description
- detail view on tap

### Card States

- Unlocked: full color, achieved tier highlighted
- In progress: partially lit with progress shown
- Locked: greyed out but visible
- Secret: hidden or shown as `???` until unlocked

### Detail View

Tapping an achievement should show:

- achievement name
- description
- category
- tiers
- current progress
- unlocked date if already earned

## Notification Behavior

### V1 Recommendation

Use a toast/banner hybrid, not a blocking modal for normal unlocks.

### Why

- rewarding without interrupting flow
- closer to strong modern mobile UX
- avoids over-notifying users

### Recommended Notification Rules

- normal unlock: lightweight toast/banner
- bigger milestone or rare achievement: richer banner treatment later if needed
- no full-screen modal in v1

### Recent Unlock History

Include a recent unlock history section.

Purpose:

- users can review what they unlocked
- missed toasts still feel permanent
- makes the system feel real and collectible

## Visual Direction

### Style

Premium sporty rather than cartoon-gamey.

### Badge Shape

Use a shared badge system with fencing-inspired symbols.

Recommended motifs:

- medals
- shields
- ribbons
- sport icons

### Color System

Use tier/rarity colors:

- Bronze
- Silver
- Gold
- Platinum

### Why

- immediately readable
- scalable
- easier to maintain visually
- more aligned with the app brand than bespoke art per achievement

### V1 Exclusions

- no pinned favorite achievements in v1

## Category Structure

V1 categories:

- Matches
- Competitions
- Training
- Goals
- Remote
- Profile

### Why

- maps directly to the current product
- easy for users to understand
- easy to expand later

### Category Completion

Show completion percentage per category.

## Data Strategy

### Recommended Model

Hybrid model:

- compute eligibility/progress from existing data where needed
- store unlocked achievements once earned

### Recommended Storage

Add a dedicated `user_achievements` table.

### Why

- supports unlock timestamps
- supports history
- avoids expensive recomputation for everything
- makes future expansion easier

### Suggested Stored Fields

- `id`
- `user_id`
- `achievement_key`
- `tier_key`
- `unlocked_at`
- `unlock_source`
- `progress_snapshot` if needed later
- `created_at`
- `updated_at`

### Definitions

- `unlocked_at`: when the user earned the achievement
- `unlock_source`: what action or event unlocked it, such as `match_saved`, `goal_completed`, or `competition_finalised`

### Progress Storage

Recommended approach for v1:

- store unlock state and unlocked tier
- compute partial progress live

### Admin Support

Manual/admin grants should be supported later, but do not need a v1 admin UI.

## Achievement System Rules

### Retroactive Unlocks

Yes.

If a user already earned an achievement before the feature launches, they should receive it.

### Tiering

Yes.

Reason:

- supports longer-term engagement
- gives users a next target
- avoids one-and-done value

### Permanence

Achievements stay unlocked forever once earned.

### Streak Logic

Streak progress can reset if the streak breaks, but unlocked tiers remain unlocked.

## Suggested V1 Achievement Count

Launch with approximately 20 to 30 achievements total.

### Why

- enough variety to feel meaningful
- not too many to overwhelm
- supports both short-term and long-term motivation

## Progression Strategy

### Early Motivation

Include easy early wins.

### Long-Term Motivation

Include a few hard long-term achievements.

### Discovery

Use achievements to encourage underused features.

### Prestige

Include a few rare/prestigious achievements.

## Suggested V1 Achievement Set

### Matches

- First Match Logged
- 10 Matches Logged
- 25 Matches Logged
- 50 Matches Logged
- First Win
- 10 Wins
- 25 Wins
- 3 Match Win Streak
- 5 Match Win Streak

### Competitions

- First Competition Joined
- 5 Competitions Joined
- First Competition Created
- First Competition Finalised
- First Competition Match Logged

### Training

- First Training Session Logged
- 7 Day Consistency
- 30 Sessions Logged

### Goals

- First Goal Set
- First Goal Completed
- 5 Goals Completed

### Remote

- First Remote Match
- 10 Remote Matches

### Profile

- Profile Completed

## Suggested Tier Examples

### Example: Match Master

- Bronze: 10 matches
- Silver: 25 matches
- Gold: 50 matches
- Platinum: 100 matches

### Example: Victory Hunter

- Bronze: 5 wins
- Silver: 15 wins
- Gold: 30 wins

### Example: Competitor

- Bronze: join 1 competition
- Silver: join 5 competitions
- Gold: join 10 competitions

## Social / Future Expansion

Not for v1, but design should support:

- shareable achievements later
- achievements tied to leaderboards/club competitions later
- featured achievement on profile later
- seasonal achievements later

## Practical Constraints

### Backend

Backend/schema changes are recommended in v1.

### Build Approach

Design for scalability, ship narrow.

### Inspiration

Reference inspiration:

- Strava
- Duolingo
- Nike Run Club
- Apple Fitness

## What To Avoid

- too many joke achievements
- achievements based on luck
- unclear unlock rules
- noisy modal-heavy notifications
- achievements that feel paywalled
- achievements impossible for most users

## Analytics Recommendation

Track at least:

- achievement unlocked
- tier reached
- category
- unlock source
- recent unlock viewed
- achievements screen viewed
- achievement detail opened

This will help measure:

- engagement
- drop-off
- retention impact
- feature discovery influence

## Recommended V1 Release Shape

V1 should include:

- profile achievements preview
- full achievements screen
- visible locked achievements
- some secret achievements
- tiered progress
- recent unlock history
- toast/banner unlock notifications
- retroactive unlocks
- dedicated achievement persistence

V1 should not include:

- public sharing
- featured achievement selection
- seasonal achievement system
- modal-heavy celebration flow
- advanced social comparison

## Final Summary

The agreed v1 direction is:

- private-first
- profile-first
- tiered
- retroactive
- mostly visible locked achievements
- based mostly on existing tracked data
- premium sporty visual design
- toast/banner notifications
- one dedicated achievements screen with category sections
- scalable backend foundation with stored unlocks

## Next Step

If this spec is approved, the next deliverable should be a technical implementation plan covering:

- UI structure
- database schema
- achievement definitions and keys
- unlock calculation strategy
- analytics events
- rollout sequence
